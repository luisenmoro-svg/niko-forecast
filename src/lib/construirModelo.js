// Modelo de datos del tablero: recibe los datos crudos y calcula todo lo que se muestra.
// Portado VERBATIM del tablero estático. Ninguna fórmula cambió.
import { CFG } from '../../config.js';
import { DAY, fmt, fmt1, pct, esc, sum, median, groupBy, MESES,
         toDay, isoDay, setFeriados, esHabil, habilesEntre, siguientesHabiles, HOY } from './fechas.js';

export function construirModelo(raw, opciones) {
  const { horizonte, mes, segmento } = opciones;
  setFeriados(new Set(raw.feriados.map(f => toDay(f.fecha))));

  const cat = {};
  for (const c of raw.catalogo) cat[c.tipo + '|' + c.segmento] = c;
  const buscarCat = (tipo, seg) => cat[tipo + '|' + seg] || raw.catalogo.find(c => c.tipo === tipo) || null;

  const personas = {};
  for (const p of raw.personas.filter(p => p.activo !== false)) personas[p.owner_id] = { ...p };
  const ausencia = {};
  for (const a of raw.ausencias) ausencia[a.owner_id + '|' + toDay(a.fecha)] = Number(a.horas) || 0;

  const hace28 = HOY - 28 * DAY;
  const habiles28 = Math.max(1, habilesEntre(hace28, HOY));

  // --- Tickets
  const tickets = raw.tickets.map(t0 => {
    const t = { ...t0 };
    const c = buscarCat(t.tipo, t.segmento);
    t.cat = c;
    t.sla = c && c.sla_dias != null ? Number(c.sla_dias) : null;
    t.d0 = toDay(t.creado); t.d1 = toDay(t.cerrado);
    t.abierto = t.d1 == null;
    t.edad = habilesEntre(t.d0, t.d1 ?? HOY);
    const enRevision = /review|revisi/i.test(t.etapa_ticket || '');
    const h = c ? (enRevision ? c.esfuerzo_rev_h : c.esfuerzo_prod_h) : null;
    const mult = c && c.unidad === 'sitio' ? Math.max(1, Number(t.sitios) || 1) : 1;
    t.horas = h == null || h === '' || isNaN(h) ? null : Number(h) * mult;
    t.firme = !!c && c.estado === 'firme';
    t.estadoSla = t.sla == null ? 'sin' : t.edad > t.sla ? 'vencido' : t.edad >= 0.8 * t.sla ? 'riesgo' : 'ok';
    t.creado28 = t.d0 != null && t.d0 >= hace28;
    t.cerrado28 = t.d1 != null && t.d1 >= hace28;
    t.persona = personas[t.owner_id] || null;
    return t;
  });
  // Etapas inactivas (Inviable, Dormant, Churned): ni sus deals ni sus tickets cuentan.
  const etapaPorId = Object.fromEntries(raw.etapas.map(e => [e.etapa_id, e]));
  const inactiva = id => !!(etapaPorId[id] && etapaPorId[id].es_inactivo);
  const etapaDeDeal = Object.fromEntries(raw.deals.map(d => [d.deal_id, d.etapa_id]));
  // Solo si TODOS sus deals estan en etapa inactiva: un ticket compartido sigue contando.
  const soloDealsInactivos = t => (t.deal_ids || []).length > 0
    && t.deal_ids.every(id => inactiva(etapaDeDeal[id]));

  const abiertosTodos = tickets.filter(t => t.abierto);
  const ticketsInactivos = abiertosTodos.filter(soloDealsInactivos).map(t => ({
    ...t,
    etapaDeal: (t.deal_ids || []).map(id => (etapaPorId[etapaDeDeal[id]] || {}).etiqueta)
      .filter(Boolean).join(', '),
  }));
  const abiertos = abiertosTodos.filter(t => !soloDealsInactivos(t));

  // --- Capacidad por persona en el horizonte
  const dias = siguientesHabiles(HOY, horizonte);
  const capDia = (p, d) => p.fte * p.foco * Math.max(0, p.jornada_h - (ausencia[p.owner_id + '|' + d] || 0));
  for (const p of Object.values(personas)) {
    const mios = tickets.filter(t => t.owner_id === p.owner_id);
    const misAbiertos = mios.filter(t => t.abierto);
    p.lAbiertos = misAbiertos;
    p.backlogN = misAbiertos.length;
    p.backlogH = sum(misAbiertos, t => t.horas);
    p.sinEsfuerzo = misAbiertos.filter(t => t.horas == null).length;
    p.entradaDiaH = sum(mios.filter(t => t.creado28), t => t.horas) / habiles28;
    p.entradaDiaN = mios.filter(t => t.creado28).length / habiles28;
    p.salidaDiaN = mios.filter(t => t.cerrado28).length / habiles28;
    p.capPorDia = dias.map(d => capDia(p, d));
    p.dispH = sum(p.capPorDia);
    p.reqH = p.backlogH + p.entradaDiaH * dias.length;
    p.util = p.dispH > 0 ? p.reqH / p.dispH : null;
    const capMedia = p.dispH / dias.length;
    p.colaDias = capMedia > 0 ? p.backlogH / capMedia : Infinity;
    const neto = capMedia - p.entradaDiaH;
    p.diasVaciar = p.backlogH === 0 ? 0 : neto > 0 ? p.backlogH / neto : Infinity;
    const conHoras = mios.filter(t => t.horas != null);
    p.esfuerzoMedio = conHoras.length ? sum(conHoras, t => t.horas) / conHoras.length : null;
    p.ticketsQueCaben = p.esfuerzoMedio ? Math.floor(p.dispH / p.esfuerzoMedio) : null;
    p.ausenciasH = sum(dias, d => ausencia[p.owner_id + '|' + d] || 0);
    let b = p.backlogH; p.proyeccion = [b];
    for (const c of p.capPorDia) { b = Math.max(0, b + p.entradaDiaH - c); p.proyeccion.push(b); }
  }

  // --- Reparto de la capacidad de cada persona entre equipos
  // 1) persona_equipos manda. 2) un equipo con «/» y sin porcentajes se reparte según
  // la mezcla de pipelines de sus tickets de los últimos 28 días (queda como supuesto).
  // 3) en cualquier otro caso, toda su capacidad va a personas.equipo.
  const pePorOwner = groupBy(raw.personaEquipos || [], r => r.owner_id);
  for (const p of Object.values(personas)) {
    const filas = (pePorOwner[p.owner_id] || []).filter(r => Number(r.porcentaje) > 0);
    const total = sum(filas, r => Number(r.porcentaje));
    if (filas.length && total > 0) {
      p.pesos = {}; for (const r of filas) p.pesos[r.equipo] = (p.pesos[r.equipo] || 0) + Number(r.porcentaje) / total;
      p.pesosSupuestos = false;
    } else if ((p.equipo || '').includes('/')) {
      const partes = p.equipo.split('/').map(x => x.trim()).filter(Boolean);
      // Lo que la persona trabajó, no lo que se creó: los abiertos de hoy más los que
      // cerró en 28 días. Así cuenta la revisión que le llega por reasignación.
      const recientes = tickets.filter(t => t.owner_id === p.owner_id && t.equipo
        && (t.abierto || t.cerrado28));
      const porPipe = groupBy(recientes, t => t.equipo);
      const n = recientes.length;
      p.pesos = n
        ? Object.fromEntries(Object.entries(porPipe).map(([eq, ts]) => [eq, ts.length / n]))
        : Object.fromEntries(partes.map(x => [x, 1 / partes.length]));
      p.pesosSupuestos = true;
    } else {
      p.pesos = { [p.equipo]: 1 };
      p.pesosSupuestos = false;
    }
  }

  // --- Equipos: la demanda es del pipeline del ticket, la oferta son los pesos
  const demandaPorEquipo = groupBy(abiertos.filter(t => t.equipo), t => t.equipo);
  const entradaPorEquipo = groupBy(tickets.filter(t => t.creado28 && t.equipo), t => t.equipo);
  const salidaPorEquipo = groupBy(tickets.filter(t => t.cerrado28 && t.equipo), t => t.equipo);
  const nombresEquipo = [...new Set([
    ...Object.keys(demandaPorEquipo), ...Object.keys(entradaPorEquipo), ...Object.keys(salidaPorEquipo),
    ...Object.values(personas).flatMap(p => Object.keys(p.pesos)),
  ])].filter(Boolean).sort();

  const equipos = nombresEquipo.map(nombre => {
    // Personas que aportan capacidad a este equipo, con su fracción.
    const ps = Object.values(personas).filter(p => (p.pesos[nombre] || 0) > 0);
    const w = p => p.pesos[nombre] || 0;
    const abiertosEq = demandaPorEquipo[nombre] || [];
    const e = { nombre, personas: ps };
    e.supuesto = ps.some(p => p.pesosSupuestos);
    e.dispH = sum(ps, p => p.dispH * w(p));
    e.backlogH = sum(abiertosEq, t => t.horas);
    e.backlogN = abiertosEq.length;
    e.abiertos = abiertosEq;
    e.sinEsfuerzo = abiertosEq.filter(t => t.horas == null).length;
    e.entradaDiaH = sum(entradaPorEquipo[nombre] || [], t => t.horas) / habiles28;
    e.reqH = e.backlogH + e.entradaDiaH * dias.length;
    e.util = e.dispH > 0 ? e.reqH / e.dispH : null;
    e.entradaSem = (entradaPorEquipo[nombre] || []).length / habiles28 * 5;
    e.salidaSem = (salidaPorEquipo[nombre] || []).length / habiles28 * 5;
    const capDiaEq = dias.map((_, i) => sum(ps, p => p.capPorDia[i] * w(p)));
    let b = e.backlogH; e.proyeccion = [b];
    for (const c of capDiaEq) { b = Math.max(0, b + e.entradaDiaH - c); e.proyeccion.push(b); }
    const porOwner = groupBy(abiertosEq, t => t.owner_id);
    const topOwner = Object.entries(porOwner).sort((a, b) => b[1].length - a[1].length)[0];
    e.concentracion = e.backlogN && topOwner ? topOwner[1].length / e.backlogN : 0;
    e.top = topOwner ? (personas[topOwner[0]] || { nombre: topOwner[0] }) : { nombre: '—' };
    e.diaVacio = e.proyeccion.findIndex((v, i) => i > 0 && v === 0);
    e.alertas = [];
    if (e.util == null) e.alertas.push('Sin horas disponibles en el horizonte');
    else if (e.util > 1) e.alertas.push(`Faltan ${fmt.format(e.reqH - e.dispH)} h en ${dias.length} días hábiles`);
    if (e.entradaSem > e.salidaSem * 1.1 && e.entradaSem >= 1) e.alertas.push(`La fila crece: entran ${fmt1.format(e.entradaSem)} y salen ${fmt1.format(e.salidaSem)} por semana`);
    if (e.concentracion >= 0.7 && e.backlogN >= 5 && ps.length > 1) e.alertas.push(`${e.top.nombre} tiene ${pct(e.concentracion)} de los abiertos`);
    if (ps.length === 1 && e.backlogN >= 5) e.alertas.push(`Depende de una sola persona (${e.top.nombre})`);
    if (!ps.length && e.backlogN) e.alertas.push('Nadie tiene capacidad asignada a este pipeline');
    if (e.supuesto) e.alertas.push('Parte de la capacidad se repartió por la mezcla de tickets que esas personas trabajaron (abiertos hoy más cerrados en 28 días), no por porcentajes cargados');
    if (e.sinEsfuerzo) e.alertas.push(`${e.sinEsfuerzo} abiertos sin esfuerzo en el catálogo: la carga real es mayor`);
    e.sinDatos = e.backlogN > 0 && e.sinEsfuerzo === e.backlogN;
    e.nivel = e.sinDatos ? 'mute' : e.util == null || e.util > 1 ? 'bad' : e.util > 0.85 || e.alertas.length > 1 ? 'warn' : 'ok';
    return e;
  }).sort((a, b) => (b.util ?? 99) - (a.util ?? 99));
  const sinPersona = abiertos.filter(t => !t.persona);

  // --- Etapas y deals
  const etapas = raw.etapas.filter(e => (!segmento || e.pipeline === segmento) && !e.es_inactivo).sort((a, b) => a.orden - b.orden);
  const deals = raw.deals.filter(d => (!segmento || d.segmento === segmento) && !inactiva(d.etapa_id));
  const esInstalado = d => !!(etapaPorId[d.etapa_id] && etapaPorId[d.etapa_id].es_instalado);

  const porEtapa = etapas.map(e => {
    const ds = deals.filter(d => d.etapa_id === e.etapa_id).map(d => ({ ...d, etapaEtiqueta: e.etiqueta }));
    return { ...e, sitios: ds.length, kwp: sum(ds, d => d.kwp), ds };
  });

  // Evolución semanal: T0, 1S, 2S…
  const series = raw.series.filter(r => (!segmento || r.segmento === segmento) && !inactiva(r.etapa_id));
  const semanas = raw.semanas.map((fecha, i) => {
    const filas = series.filter(r => r.snapshot_date === fecha);
    const pe = {};
    for (const e of etapas) { const ds = filas.filter(r => r.etapa_id === e.etapa_id); pe[e.etapa_id] = { sitios: ds.length, kwp: sum(ds, d => d.kwp) }; }
    return { fecha, etiqueta: i === 0 ? 'T0' : `${i}S`, porEtapa: pe, filas, sitios: sum(Object.values(pe), x => x.sitios), kwp: sum(Object.values(pe), x => x.kwp) };
  });

  // --- Goal, forecast y real del mes
  const [anio, m] = mes.split('-').map(Number);
  const iniMes = Date.UTC(anio, m - 1, 1), finMes = Date.UTC(anio, m, 1);
  const metaRow = raw.metas.find(x => toDay(x.mes) === iniMes);
  const goal = metaRow ? { sitios: +metaRow.sitios, kwp: +metaRow.kwp } : (CFG.metaPorDefecto || { sitios: 80, kwp: 1200 });
  const comprometidos = deals.filter(d => { const f = toDay(d.fecha_instalacion); return f != null && f >= iniMes && f < finMes; });
  const ticketsPorDeal = {};
  for (const t of abiertos) for (const id of (t.deal_ids || [])) (ticketsPorDeal[id] ||= []).push(t);

  const evaluados = comprometidos.map(d => {
    const r = { deal: d, instalado: esInstalado(d) };
    const fecha = toDay(d.fecha_instalacion);
    r.diasRestantes = habilesEntre(HOY, fecha);
    if (r.instalado) { r.enForecast = true; r.motivo = 'Instalado'; return r; }
    const ts = ticketsPorDeal[d.deal_id] || [];
    if (!ts.length) { r.enForecast = r.diasRestantes >= 0; r.motivo = r.enForecast ? 'Sin tickets abiertos' : 'La fecha ya pasó y no está instalado'; r.supuesto = true; return r; }
    let peor = null;
    for (const t of ts) {
      const cola = t.persona ? t.persona.colaDias : Infinity;
      const restanteSla = Math.max(0, (t.sla ?? 0) - t.edad);
      const demora = cola + restanteSla;
      if (!peor || demora > peor.demora) peor = { t, demora, cola };
    }
    r.demora = peor.demora; r.cuello = peor.t;
    r.enForecast = peor.demora <= r.diasRestantes;
    r.motivo = !peor.t.persona ? `Owner fuera del modelo en ${peor.t.tipo}`
      : r.enForecast ? 'A tiempo con la capacidad actual'
      : `${peor.t.persona.equipo} (${peor.t.persona.nombre}): necesita ${fmt1.format(peor.demora)} días hábiles entre fila y SLA, y quedan ${r.diasRestantes}`;
    return r;
  });
  const enF = evaluados.filter(r => r.enForecast), reales = evaluados.filter(r => r.instalado);
  const conEtapa = d => ({ ...d, etapaEtiqueta: (etapaPorId[d.etapa_id] || {}).etiqueta });
  const metricas = {
    goal,
    plan: { sitios: comprometidos.length, kwp: sum(comprometidos, d => d.kwp) },
    forecast: { sitios: enF.length, kwp: sum(enF, r => r.deal.kwp) },
    real: { sitios: reales.length, kwp: sum(reales, r => r.deal.kwp) },
    fuera: evaluados.filter(r => !r.enForecast).sort((a, b) => (b.demora ?? 0) - (a.demora ?? 0)),
    // Listas exactas detrás de cada cifra, para el panel de detalle.
    listas: {
      plan: comprometidos.map(conEtapa),
      forecast: enF.map(r => conEtapa(r.deal)),
      real: reales.map(r => conEtapa(r.deal)),
    },
  };

  // --- Resumen de tickets por tipo
  const porTipo = Object.values(groupBy(tickets, t => t.tipo + '|' + (t.segmento || ''))).map(ts => {
    const ab = ts.filter(t => t.abierto), cer = ts.filter(t => t.cerrado28);
    const conSla = cer.filter(t => t.sla != null);
    return {
      tipo: ts[0].tipo, segmento: ts[0].segmento, equipo: ts[0].equipo, sla: ts[0].sla, firme: ts[0].firme,
      abiertos: ab.length,
      vencidos: ab.filter(t => t.estadoSla === 'vencido').length,
      riesgo: ab.filter(t => t.estadoSla === 'riesgo').length,
      edadMediana: median(ab.map(t => t.edad)),
      creados28: ts.filter(t => t.creado28).length, cerrados28: cer.length,
      cumplimiento: conSla.length ? conSla.filter(t => t.edad <= t.sla).length / conSla.length : null,
      horasBacklog: sum(ab, t => t.horas),
      // Listas exactas detrás de cada celda.
      lAbiertos: ab,
      lVencidos: ab.filter(t => t.estadoSla === 'vencido'),
      lRiesgo: ab.filter(t => t.estadoSla === 'riesgo'),
      lCreados28: ts.filter(t => t.creado28), lCerrados28: cer, lConSla: conSla,
    };
  }).sort((a, b) => b.abiertos - a.abiertos);

  const cerrados28 = tickets.filter(t => t.cerrado28 && t.sla != null);
  const lResumen = {
    abiertos, vencidos: abiertos.filter(t => t.estadoSla === 'vencido'),
    riesgo: abiertos.filter(t => t.estadoSla === 'riesgo'), cerrados28,
  };
  return {
    tickets, abiertos, personas: Object.values(personas), equipos, sinPersona, ticketsInactivos, dias,
    porEtapa, semanas, metricas, porTipo, lResumen, catalogo: raw.catalogo,
    resumen: {
      abiertos: abiertos.length,
      vencidos: abiertos.filter(t => t.estadoSla === 'vencido').length,
      riesgo: abiertos.filter(t => t.estadoSla === 'riesgo').length,
      sinSla: abiertos.filter(t => t.estadoSla === 'sin').length,
      cumplimiento: cerrados28.length ? cerrados28.filter(t => t.edad <= t.sla).length / cerrados28.length : null,
      sitiosT0: semanas[0]?.sitios ?? 0, kwpT0: semanas[0]?.kwp ?? 0,
    },
  };
}

