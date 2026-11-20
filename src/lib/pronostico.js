// Pronóstico por colas de capacidad y detección de olas.
// Portado VERBATIM del tablero estático. Ninguna fórmula cambió.
import { CFG } from '../../config.js';
import * as M_ from '../../modelo.js';
import { fmt, fmt1, pct, esc, sum, groupBy, MESES, toDay, isoDay, esHabil,
         habilesEntre, siguientesHabiles, HOY, DAY } from './fechas.js';

const NIKO_MODELO = M_;

export function notaLotes(e) {
  if (!e || e.fuente !== 'hubspot' || !e.lote) return '';
  const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const mes = MES[Number(e.lote.de.slice(5, 7)) - 1] || '';
  return `La entrada llega por lotes (${fmt.format(e.lote.sitios)} de ${fmt.format(e.total)} sitios en dos semanas de ${mes}); depende de cuándo se cargan listados, no de un flujo constante.`;
}

// Una sola frase para el ritmo real, use la medida de HubSpot o las fotos.
export function txtRitmo(e, largo) {
  if (!e) return 'no medible';
  const sit = n => `${fmt1.format(n)} ${n === 1 ? 'sitio' : 'sitios'} por semana`;
  if (e.fuente !== 'hubspot') return `${sit(e.sitios)}, medidos entre las últimas ${e.intervalos} fotos`;
  return sit(e.sitios)
    + (largo ? `, el promedio de las últimas ${e.ventana} semanas de entradas a levantamiento en HubSpot`
             + `; en las últimas 4 semanas entró casi nada (${fmt1.format(e.prom4)} por semana)` : '');
}

// Ritmo de entrada medido en HubSpot con las fechas de entrada a levantamiento.
// Promedio de las últimas 4 semanas. No depende de que haya fotos acumuladas.
export function entradaMedida(M) {
  const em = CFG.entradaMedida;
  if (!em || !em.semanas || em.semanas.length < 4) return null;
  const ult4 = em.semanas.slice(-4);
  const prom4 = sum(ult4, x => x.sitios) / ult4.length;
  // El valor principal es el promedio de 8 semanas: la entrada llega por lotes, así que
  // una ventana de 4 semanas puede caer entera en un valle y describir solo el valle.
  const ult8 = em.semanas.slice(-8);
  const prom8 = ult8.length >= 8 ? sum(ult8, x => x.sitios) / 8 : null;
  const prom = prom8 != null ? prom8 : prom4;
  const kwp = M.metricas.goal.sitios ? M.metricas.goal.kwp / M.metricas.goal.sitios : 15;
  // El lote: la mayor racha de dos semanas seguidas contra el total de la ventana.
  let lote = null;
  for (let i = 0; i + 1 < ult8.length; i++) {
    const par = ult8[i].sitios + ult8[i + 1].sitios;
    if (!lote || par > lote.sitios) lote = { sitios: par, de: ult8[i].semana };
  }
  const total = sum(ult8, x => x.sitios);
  return { fuente: 'hubspot', sitios: prom, prom4, prom8, ventana: ult8.length, total, lote,
           kwpPorSitio: kwp, serie: em.semanas, medidoEl: em.medidoEl,
           irregular: prom8 != null && prom8 > 0 && Math.abs(prom4 - prom8) / prom8 > 0.5 };
}

export function entradaReal(M) {
  const sem = M.semanas || [];
  if (sem.length < 2) return null;
  // Dos fotos pegadas no dan un ritmo semanal: hacen falta al menos 5 días entre la
  // primera y la última.
  const span = (toDay(sem[sem.length - 1].fecha) - toDay(sem[0].fecha)) / DAY;
  if (!(span >= 5)) return null;
  const desde = Math.max(1, sem.length - 4);
  let nuevos = 0, kwp = 0, intervalos = 0;
  for (let i = desde; i < sem.length; i++) {
    const antes = new Set((sem[i - 1].filas || []).map(r => r.deal_id));
    const entran = (sem[i].filas || []).filter(r => !antes.has(r.deal_id));
    nuevos += entran.length; kwp += sum(entran, r => r.kwp); intervalos++;
  }
  if (!intervalos) return null;
  return { sitios: nuevos / intervalos, kwpPorSitio: nuevos ? kwp / nuevos : 0, intervalos };
}

// Los que tendrían que entrar para sostener la meta, despejando hacia atrás las
// tasas de conversión de toda la cadena.
export function entradaMeta(M) {
  const metaMes = M.metricas.goal.sitios || 0;
  const conv = (CFG.ritmoEtapas || []).reduce((a, r) => a * (r.conversion == null ? 1 : r.conversion), 1);
  const porSemana = metaMes / 4.33;
  return { sitios: conv > 0 ? porSemana / conv : 0, conv,
           kwpPorSitio: metaMes ? (M.metricas.goal.kwp || 0) / metaMes : 0 };
}

// Esfuerzo de un tipo de ticket, en orden: catálogo → medido con cierres reales →
// SLA como último recurso. La procedencia viaja con el número y se muestra.
export function resolverEsfuerzo(M) {
  const cal = CFG.esfuerzoCalibrado || {};
  const minC = CFG.minCierresEsfuerzo || 10;
  // Esfuerzo medido: horas de la persona que lo cerró entre los cierres de ese tipo.
  const medido = {};
  const porTipo = groupBy(M.tickets.filter(t => t.cerrado28 && t.tipo), t => t.tipo);
  for (const [tipo, ts] of Object.entries(porTipo)) {
    if (ts.length < minC) continue;
    const owners = [...new Set(ts.map(t => t.owner_id))].map(id => M.personas.find(p => p.owner_id === id)).filter(Boolean);
    if (!owners.length) continue;
    const horas = sum(owners, p => p.fte * p.jornada_h * p.foco * 20);
    const cerradosDeEsos = M.tickets.filter(t => t.cerrado28 && owners.some(p => p.owner_id === t.owner_id)).length;
    if (!cerradosDeEsos) continue;
    medido[tipo] = horas / cerradosDeEsos;
  }
  const catPorTipo = {};
  for (const c of (M.catalogo || [])) catPorTipo[c.tipo] = c;
  return function (tipo, esRevision) {
    const c = catPorTipo[tipo];
    const campo = esRevision ? 'esfuerzo_rev_h' : 'esfuerzo_prod_h';
    if (cal[tipo] != null && !esRevision) return { h: cal[tipo], fuente: 'calibrado' };
    const v = c && c[campo] != null && c[campo] !== '' ? Number(c[campo]) : null;
    if (v != null && !isNaN(v)) return { h: v, fuente: 'catálogo' };
    if (medido[tipo] != null) return { h: medido[tipo], fuente: 'medido' };
    const sla = c && c.sla_dias != null && c.sla_dias !== '' ? Number(c.sla_dias) : null;
    // Último recurso: el SLA como duración. La etapa deja de poder mostrar saturación.
    if (sla != null && !isNaN(sla) && sla > 0) return { h: sla * 8, fuente: 'según SLA', porSla: true };
    return { h: null, fuente: 'sin dato' };
  };
}

// Quién puede tomar cada tipo: SKILLS del motor, y si no, quién lo ha cerrado.
export function quienesPueden(M) {
  const skills = CFG.skills || {};
  const minS = CFG.minCierresSkill || 3;
  const porTipo = groupBy(M.tickets.filter(t => t.cerrado28 && t.tipo && t.owner_id), t => t.tipo);
  return function (tipo) {
    if (skills[tipo] && skills[tipo].length) return { ids: skills[tipo], fuente: 'skills' };
    const ts = porTipo[tipo] || [];
    const cuenta = {};
    for (const t of ts) cuenta[t.owner_id] = (cuenta[t.owner_id] || 0) + 1;
    const ids = Object.keys(cuenta).filter(id => cuenta[id] >= minS);
    return { ids, fuente: ids.length ? 'quien lo cierra' : 'nadie' };
  };
}

export function pronostico(M, sim, opciones) {
  const S = sim || {};
  const O = opciones || {};
  const ritmos = CFG.ritmoEtapas || [];

  const eMedida = entradaMedida(M), eFotos = entradaReal(M), eMeta = entradaMeta(M);
  const eReal = eMedida || eFotos;   // HubSpot manda; las fotos son el respaldo
  const pedido = S.entrada || 'real';
  const hayHistoria = !!eReal;
  const modoEntrada = pedido === 'meta' ? 'meta' : (hayHistoria ? 'real' : 'sin-historia');
  const nuevos = modoEntrada === 'real' ? eReal : eMeta;

  const esfuerzo = resolverEsfuerzo(M);
  const puede = quienesPueden(M);
  const factor = (S.focoFactor == null ? 1 : S.focoFactor);

  // Horas por semana de cada persona, con los ajustes del simulador.
  const horasPersona = {};
  for (const p of M.personas) {
    const porDia = M.dias.length ? p.dispH / M.dias.length : 0;
    horasPersona[p.owner_id] = porDia * factor * 5;
  }
  // Personas extra: se agregan como capacidad suelta del equipo.
  const extraEquipo = {};
  for (const [eq, n] of Object.entries(S.extraPersonas || {})) extraEquipo[eq] = n * 8 * 0.8 * 5;

  // Reparto: cada persona divide su semana entre las filas que puede tomar, en
  // proporción al tamaño de cada fila.
  let repartoPersona = {};
  const fijarColas = (colas, estado) => {
    repartoPersona = {};
    const tamanos = {};   // tipo -> sitios esperando
    for (const lista of Object.values(colas)) for (const c of lista)
      tamanos[c.tipo] = (tamanos[c.tipo] || 0) + ((estado[c.etapa.id] || {}).sitios || 0);
    const tiposDe = {};
    for (const tipo of Object.keys(tamanos)) {
      for (const id of puede(tipo).ids) (tiposDe[id] = tiposDe[id] || []).push(tipo);
      // El revisor tiene su propia fila del mismo tipo.
      for (const id of (CFG.revisores || {})[tipo] || []) (tiposDe[id] = tiposDe[id] || []).push(tipo + ' · revisión');
    }
    for (const tipo of Object.keys(tamanos)) tamanos[tipo + ' · revisión'] = tamanos[tipo];
    for (const [id, tipos] of Object.entries(tiposDe)) {
      const total = sum(tipos, t => tamanos[t] || 0);
      for (const t of tipos) {
        const parte = total > 0 ? (tamanos[t] || 0) / total : 1 / tipos.length;
        repartoPersona[t] = (repartoPersona[t] || 0) + (horasPersona[id] || 0) * parte;
      }
    }
  };
  const revisores = CFG.revisores || {};
  const horasPara = (tipo, equipo, etapaId, w, esRevision) => {
    const q = esRevision && revisores[tipo] ? { ids: revisores[tipo], fuente: 'revisores' } : puede(tipo);
    const clave = esRevision && revisores[tipo] ? tipo + ' · revisión' : tipo;
    if (q.ids.length) return { h: (repartoPersona[clave] || 0) + (extraEquipo[equipo] || 0), quienes: q };
    // Sin personas identificadas, se usa la capacidad del equipo entero.
    const eq = M.equipos.find(x => x.nombre === equipo);
    const porDia = eq && M.dias.length ? eq.dispH / M.dias.length : 0;
    return { h: porDia * factor * 5 + (extraEquipo[equipo] || 0), quienes: { ids: [], fuente: 'equipo completo' } };
  };

  const capSemana = {};
  for (const e of M.equipos) {
    const porDia = M.dias.length ? e.dispH / M.dias.length : 0;
    capSemana[e.nombre] = porDia * factor * 5 + (extraEquipo[e.nombre] || 0);
  }
  const estado = {};
  for (const e of M.porEtapa) estado[e.etapa_id] = { sitios: e.sitios, kwp: e.kwp };

  const slaDe = tipo => {
    const c = (M.catalogo || []).find(x => x.tipo === tipo);
    const v = c && c.sla_dias != null && c.sla_dias !== '' ? Number(c.sla_dias) : null;
    return v == null || isNaN(v) ? null : v;
  };

  const comun = {
    ritmos, capSemana, nuevos, semanas: CFG.semanasPronostico || 10,
    ajustes: { multEsfuerzo: S.multEsfuerzo, diasEtapa: S.diasEtapa },
    esfuerzo, sla: slaDe, horasPara, fijarColas,
  };
  const R = NIKO_MODELO.calcularPronostico({ ...comun, estado: { ...estado } });
  // La promesa: lo mismo pero suponiendo que cada ticket cierra en su SLA.
  const Prom = O.sinPromesa ? null : NIKO_MODELO.calcularPronostico({
    ...comun, estado: { ...estado }, promesa: true,
    horasPara: () => ({ h: 0, quienes: { ids: [] } }),
  });

  // Etapas cuyo ritmo salió del SLA por falta de esfuerzo: no pueden mostrar saturación.
  const porSla = [];
  for (const r of ritmos) for (const t of (r.tickets || [])) {
    const e2 = esfuerzo(t.tipo, t.revision);
    if (e2.porSla) porSla.push(`${r.cod} · ${t.tipo}`);
  }

  // El plan de ensueño: hacia atrás desde la meta mensual.
  const metaMes = (S.meta != null ? S.meta : M.metricas.goal.sitios) || 0;
  const kwpPorSitio = M.metricas.goal.sitios ? M.metricas.goal.kwp / M.metricas.goal.sitios : 15;
  const Meta = NIKO_MODELO.calcularMeta({
    ritmos, metaSemana: metaMes / 4.33, kwpPorSitio,
    semanas: CFG.semanasPronostico || 10, sla: slaDe, esfuerzo,
    tasaPuntaAPunta: (CFG.tasaDesdeLevantamiento || {}).observada,
  });

  return { ...R, promesa: Prom, meta: Meta, metaMes, capSemana, entrada: nuevos, modoEntrada,
           eReal, eMedida, eFotos, eMeta, hayHistoria, porSla, esfuerzoDe: esfuerzo, quienesPueden: puede };
}

// ====================== Olas: dónde hay que prepararse ======================
// Una ola es un grupo de sitios que hoy están en una etapa y que, al avanzar, van a
// caer sobre un paso que no da abasto. Todo sale del mismo pronóstico.
export function olas(M, P) {
  if (!P || !P.semanas.length) return [];
  const ritmos = CFG.ritmoEtapas || [];
  const nombrePersona = id => (M.personas.find(p => p.owner_id === id) || {}).nombre || id;
  const etiqueta = id => (M.porEtapa.find(e => e.etapa_id === id) || {}).etiqueta || id;
  const out = [];

  ritmos.forEach((r, i) => {
    if (r.modo !== 'cola') return;
    // La semana en la que más sitios llegan a esta etapa.
    let mejor = null;
    P.semanas.forEach((w, wi) => {
      const t = w.traza[r.id];
      if (t && t.llegaron > (mejor ? mejor.llegaron : 0)) mejor = { llegaron: t.llegaron, wi, t };
    });
    if (!mejor || mejor.llegaron < 1) return;
    const t = mejor.t, p = t.porque || {};
    if (p.modo !== 'cola' || !p.cuello) return;
    const cuello = p.cuello;
    // Solo es alerta si el paso no alcanza a absorber lo que llega.
    const capacidadSemana = cuello.caben;
    if (capacidadSemana >= mejor.llegaron) return;

    const origen = ritmos[i - 1];
    const sitiosOrigen = origen ? (M.porEtapa.find(e => e.etapa_id === origen.id) || {}).sitios || 0 : 0;
    const destino = ritmos[i + 1];
    const quienes = (cuello.quienes && cuello.quienes.ids) || [];
    const unaPersona = quienes.length === 1;

    // Retraso contra la promesa: semanas que tarda la capacidad menos las que promete el SLA.
    const semCap = capacidadSemana > 0 ? mejor.llegaron / capacidadSemana : Infinity;
    const promTraza = P.promesa && P.promesa.semanas[mejor.wi] && P.promesa.semanas[mejor.wi].traza[r.id];
    const semProm = promTraza && promTraza.porque.fraccion > 0 ? 1 / promTraza.porque.fraccion : 1;
    const retrasoDias = Number.isFinite(semCap) ? Math.max(0, Math.round((semCap - semProm) * 5)) : null;

    // Desfase contra el mes comprometido. Aproximación: dentro de la etapa los sitios
    // avanzan por orden de fecha_instalacion (los más urgentes primero), así que el que
    // está en la posición k sale en la semana ceil(k / lo que sale por semana).
    const enEtapa = [...((M.porEtapa.find(e => e.etapa_id === r.id) || {}).ds || [])]
      .filter(d => d.fecha_instalacion)
      .sort((a, b) => String(a.fecha_instalacion).localeCompare(String(b.fecha_instalacion)));
    const fuera = [];
    if (capacidadSemana > 0) {
      enEtapa.forEach((d, k) => {
        const semanaSalida = Math.ceil((k + 1) / capacidadSemana);
        const salida = siguientesHabiles(HOY, semanaSalida * 5).pop();
        const f = toDay(d.fecha_instalacion);
        if (f == null) return;
        // Fin del mes comprometido de ese sitio.
        const dd = new Date(f);
        const finMes = Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth() + 1, 1) - DAY;
        if (salida > finMes) fuera.push({ ...d, salidaEstimada: isoDay(salida) });
      });
    } else {
      fuera.push(...enEtapa);
    }
    const kwpPorSitio = t.fin > 0 ? t.kwpFin / t.fin : 0;
    const seQuedan = Math.max(0, mejor.llegaron - capacidadSemana);
    out.push({
      cod: r.cod, etapaId: r.id, etiqueta: etiqueta(r.id),
      origenCod: origen ? origen.cod : null, sitiosOrigen,
      destinoCod: destino ? destino.cod : 'instalación',
      semana: mejor.wi + 1, llegan: mejor.llegaron,
      paso: cuello.tipo, equipo: cuello.equipo, sacaPorSemana: capacidadSemana,
      quienes, unaPersona, quienFuente: (cuello.quienes || {}).fuente,
      sinCapacidad: !!cuello.sinCapacidad,
      retrasoDias, seQuedan, kwp: seQuedan * kwpPorSitio,
      desfase: fuera, desfaseKwp: sum(fuera, d => d.kwp || 0),
      traza: t,
    });
  });
  return out.sort((a, b) => (b.desfaseKwp || b.kwp) - (a.desfaseKwp || a.kwp));
}

export function fraseOla(o) {
  const quien = o.sinCapacidad
    ? `No hay nadie en la tabla de personas para ${esc(o.equipo)}, que es quien debería tomarlos; el pronóstico los mueve a ${fmt1.format(o.sacaPorSemana)} por semana según el SLA`
    : o.unaPersona
      ? `Los trabaja <b>una sola persona</b>, ${esc((o.quienesNombres || [])[0] || o.equipo)}, que saca ${fmt1.format(o.sacaPorSemana)} por semana`
      : `Los trabajan ${o.quienes.length} personas de ${esc(o.equipo)}, que sacan ${fmt1.format(o.sacaPorSemana)} por semana`;
  return `En <b>${esc(o.cod)}</b> se juntan <b>${fmt1.format(o.llegan)} sitios</b> en ${o.semana}S`
    + (o.origenCod ? `, que hoy vienen de ${esc(o.origenCod)}` : '')
    + `. ${quien}`
    + (o.retrasoDias ? `, así que el paso a ${esc(o.destinoCod)} se retrasa <b>${o.retrasoDias} ${o.retrasoDias === 1 ? 'día hábil' : 'días hábiles'}</b> contra la promesa` : '')
    + `. Se quedan fuera ${fmt1.format(o.seQuedan)} sitios y ${fmt.format(Math.round(o.kwp))} kWp`
    + (o.desfase && o.desfase.length
        ? `, y <b>${o.desfase.length} ${o.desfase.length === 1 ? 'sitio se sale' : 'sitios se salen'} de su mes de instalación</b> (${fmt.format(Math.round(o.desfaseKwp))} kWp).`
        : ', y ninguno se sale de su mes de instalación.');
}

