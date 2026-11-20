// Carga de datos: Supabase, elección de semanas y el juego de datos de ejemplo.
// Portado VERBATIM del tablero estático.
import { DAY, toDay, isoDay, esHabil, siguientesHabiles, groupBy, HOY, setFeriados } from './fechas.js';

let sb = null;
/** El cliente lo inyecta la app; así este módulo no sabe nada de React ni del navegador. */
export function usarCliente(cliente) { sb = cliente; }

export async function traerTodo(tabla, columnas, filtro) {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    let q = sb.from(tabla).select(columnas).range(desde, desde + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
// La tabla puede no existir todavía: sin ella, cada persona va completa a su equipo.
export async function traerOpcional(tabla, columnas) {
  try { return await traerTodo(tabla, columnas); } catch (e) { return []; }
}
export function elegirSemanas(fechas, t0) {
  const ordenadas = [...fechas].sort();
  const inicio = t0 && ordenadas.includes(t0) ? t0 : ordenadas[0];
  const posteriores = ordenadas.filter(f => f >= inicio);
  const out = [inicio];
  let objetivo = toDay(inicio);
  // un punto cada 5 días hábiles: la última foto disponible antes de cada corte
  for (;;) {
    let n = 0; let t = objetivo;
    while (n < 5) { t += DAY; if (esHabil(t)) n++; }
    objetivo = t;
    const candidata = posteriores.filter(f => toDay(f) <= objetivo).pop();
    if (toDay(posteriores[posteriores.length - 1]) < objetivo) break;
    if (candidata && candidata !== out[out.length - 1]) out.push(candidata);
  }
  const ultima = posteriores[posteriores.length - 1];
  if (ultima && ultima !== out[out.length - 1]) out.push(ultima);
  return out;
}
export async function cargarSupabase(t0) {
  const [catalogo, personas, ausencias, feriados, metas, etapas, snaps] = await Promise.all([
    traerTodo('catalogo', '*'), traerTodo('personas', '*'),
    traerTodo('ausencias', '*', q => q.gte('fecha', isoDay(HOY))),
    traerTodo('feriados', '*'), traerTodo('metas', '*'), traerTodo('etapas_deal', '*'),
    traerTodo('snapshots', 'snapshot_date,creado', q => q.order('snapshot_date')),
  ]);
  const personaEquipos = await traerOpcional('persona_equipos', '*');
  const pronosGuardados = await traerOpcional('pronosticos', 'semana_fecha,etapa_id,sitios,kwp');
  if (!snaps.length) throw new Error('Todavía no hay fotos de HubSpot. Corre el workflow «Foto de HubSpot» en GitHub Actions.');
  setFeriados(new Set(feriados.map(f => toDay(f.fecha))));
  const fechas = snaps.map(s => s.snapshot_date);
  const ultima = fechas[fechas.length - 1];
  const semanas = elegirSemanas(fechas, t0);
  const [deals, tickets, series] = await Promise.all([
    traerTodo('deals_snapshot', '*', q => q.eq('snapshot_date', ultima)),
    traerTodo('tickets_snapshot', '*', q => q.eq('snapshot_date', ultima)),
    traerTodo('deals_snapshot', 'snapshot_date,deal_id,etapa_id,kwp,segmento', q => q.in('snapshot_date', semanas)),
  ]);
  return { catalogo, personas, ausencias, feriados, metas, etapas, deals, tickets, series, semanas, fechas, ultima, snaps, personaEquipos, pronosGuardados };
}

// ====================== Datos: ejemplo ======================
export function datosEjemplo() {
  let semilla = 11;
  const rnd = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const feriados = ['2026-11-16', '2026-12-25', '2027-01-01', '2027-02-01', '2027-03-15'].map(fecha => ({ fecha }));
  setFeriados(new Set(feriados.map(f => toDay(f.fecha))));
  const seg = 'Enterprise';
  const codigos = ['2.01', '2.02', '2.04', '2.06', '2.08', '2.10', '2.12', '2.13', '2.14', '2.15'];
  const etapas = codigos.map((c, i) => ({ etapa_id: 'e' + c, etiqueta: c, pipeline: seg, orden: i, es_instalado: c === '2.15' }));
  const catalogo = [
    { tipo: 'Batch run', segmento: seg, equipo: 'Quoting', unidad: 'sitio', sla_dias: 1, esfuerzo_prod_h: 0.3, estado: 'supuesto' },
    { tipo: 'Diseño y adicionales finales - enterprise', segmento: seg, equipo: 'Design', unidad: 'ticket', sla_dias: 2, esfuerzo_prod_h: 0.7, esfuerzo_rev_h: 0.3, estado: 'firme' },
    { tipo: 'Ingeniería de detalle BT enterprise', segmento: seg, equipo: 'Engineering', unidad: 'ticket', sla_dias: 2, esfuerzo_prod_h: 4, estado: 'supuesto' },
    { tipo: 'IX Aprobación diagrama unifilar', segmento: seg, equipo: 'IX', unidad: 'ticket', sla_dias: 0.125, esfuerzo_prod_h: 1, estado: 'supuesto' },
    { tipo: 'Revisión de ingeniería LiveOps', segmento: seg, equipo: 'LiveOps', unidad: 'ticket', sla_dias: 0.125, esfuerzo_prod_h: 1, estado: 'supuesto' },
    { tipo: 'Costeo final - enterprise', segmento: seg, equipo: 'Quoting', unidad: 'ticket', sla_dias: 1, esfuerzo_prod_h: 2, estado: 'supuesto' },
    { tipo: 'Planeación Instalación', segmento: seg, equipo: 'Planning', unidad: 'ticket', sla_dias: 10, esfuerzo_prod_h: null, estado: 'por_definir' },
  ];
  const tipoPorEtapa = { '2.02': 0, '2.04': 1, '2.06': 2, '2.08': 3, '2.10': 4, '2.12': 5, '2.13': 6 };
  const personas = [
    { owner_id: 'd1', nombre: 'Diseño 1', equipo: 'Design', fte: 1, jornada_h: 8, foco: 0.9 },
    { owner_id: 'd2', nombre: 'Diseño 2 (revisa)', equipo: 'Design', fte: 1, jornada_h: 8, foco: 0.5 },
    { owner_id: 'q1', nombre: 'Costeo 1', equipo: 'Quoting', fte: 1, jornada_h: 8, foco: 0.8 },
    { owner_id: 'g1', nombre: 'Ingeniería 1', equipo: 'Engineering', fte: 1, jornada_h: 8, foco: 0.9 },
    { owner_id: 'g2', nombre: 'Ingeniería 2', equipo: 'Engineering', fte: 1, jornada_h: 8, foco: 0.9 },
    { owner_id: 'g3', nombre: 'Ingeniería 3', equipo: 'Engineering', fte: 1, jornada_h: 8, foco: 0.9 },
    { owner_id: 'x1', nombre: 'Interconexión 1', equipo: 'IX', fte: 1, jornada_h: 8, foco: 0.7 },
    { owner_id: 'l1', nombre: 'LiveOps 1', equipo: 'LiveOps', fte: 1, jornada_h: 8, foco: 0.6 },
    { owner_id: 'p1', nombre: 'Planeación 1', equipo: 'Planning', fte: 1, jornada_h: 8, foco: 0.8 },
  ];
  const dueños = groupBy(personas, p => p.equipo);
  const proximos = siguientesHabiles(HOY + 7 * DAY, 3);
  const ausencias = proximos.map(d => ({ owner_id: 'x1', fecha: isoDay(d), horas: 8, fuente: 'factorial' }));
  const metas = [{ mes: isoDay(Date.UTC(new Date(HOY).getUTCFullYear(), new Date(HOY).getUTCMonth(), 1)), sitios: 80, kwp: 1200 }];

  const deals = [];
  const pesos = [14, 12, 16, 22, 18, 30, 26, 12, 10, 14];
  let id = 1000;
  codigos.forEach((c, i) => {
    for (let k = 0; k < pesos[i]; k++) {
      const off = Math.round(2 + (codigos.length - 1 - i) * 3 + rnd() * 18);
      const fecha = rnd() < 0.85 ? isoDay(HOY + (c === '2.15' ? -Math.round(rnd() * 14) : off) * DAY) : null;
      deals.push({ deal_id: String(id++), nombre: `${pick(['SIX', 'NETO', 'MOD'])} sitio ${id}`, segmento: seg, etapa_id: 'e' + c, kwp: Math.round((6 + rnd() * 24) * 10) / 10, fecha_instalacion: fecha });
    }
  });
  const tickets = [];
  let tid = 5000;
  for (const d of deals) {
    const c = d.etapa_id.slice(1); const ti = tipoPorEtapa[c];
    if (ti == null) continue;
    const cdef = catalogo[ti];
    const equipo = dueños[cdef.equipo];
    const owner = rnd() < 0.72 ? equipo[0] : pick(equipo);
    const edad = Math.round(rnd() * (cdef.equipo === 'IX' ? 22 : 12));
    tickets.push({ ticket_id: String(tid++), asunto: d.nombre, tipo: cdef.tipo, segmento: seg, equipo: cdef.equipo,
      etapa_ticket: cdef.esfuerzo_rev_h && rnd() < 0.3 ? 'Under review' : pick(['New', 'In progress']),
      owner_id: owner.owner_id, creado: new Date(HOY - edad * 1.4 * DAY + 15 * 36e5).toISOString(), cerrado: null, deal_ids: [d.deal_id], sitios: 1 });
  }
  for (let k = 0; k < 160; k++) {
    const cdef = pick(catalogo); const owner = pick(dueños[cdef.equipo]);
    const fin = HOY - Math.round(rnd() * 27) * DAY; const dur = Math.round(rnd() * 6) * DAY;
    tickets.push({ ticket_id: String(tid++), asunto: 'Cerrado', tipo: cdef.tipo, segmento: seg, equipo: cdef.equipo, etapa_ticket: 'Closed',
      owner_id: owner.owner_id, creado: new Date(fin - dur + 15 * 36e5).toISOString(), cerrado: new Date(fin + 20 * 36e5).toISOString(), deal_ids: [], sitios: 1 });
  }
  // fotos semanales hacia atrás: cada semana los sitios estaban una etapa antes con cierta probabilidad
  const semanas = []; let t = HOY;
  for (let i = 0; i < 7; i++) { semanas.unshift(isoDay(t)); let n = 0; while (n < 5) { t -= DAY; if (esHabil(t)) n++; } }
  const series = [];
  semanas.forEach((fecha, i) => {
    const atras = semanas.length - 1 - i;
    for (const d of deals) {
      let idx = codigos.indexOf(d.etapa_id.slice(1));
      for (let k = 0; k < atras; k++) if (rnd() < 0.35) idx--;
      if (idx < 0) continue;
      series.push({ snapshot_date: fecha, deal_id: d.deal_id, etapa_id: 'e' + codigos[idx], kwp: d.kwp, segmento: seg });
    }
  });
  return { catalogo, personas, ausencias, feriados, metas, etapas, deals, tickets, series, semanas, fechas: semanas, ultima: semanas[semanas.length - 1],
    snaps: semanas.map(f => ({ snapshot_date: f, creado: new Date(toDay(f) + 13 * 36e5).toISOString() })), pronosGuardados: [] };
}

