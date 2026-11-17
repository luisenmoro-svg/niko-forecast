// Foto diaria de HubSpot → Supabase.
// Corre en GitHub Actions (ver .github/workflows/sync.yml) o local con:
//   HUBSPOT_TOKEN=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-hubspot.mjs
// Node 20+ (usa fetch nativo). Sin dependencias.

const env = process.env;
const HUBSPOT_TOKEN = req('HUBSPOT_TOKEN');
const SUPABASE_URL = req('SUPABASE_URL').replace(/\/$/, '');
const SERVICE_KEY = req('SUPABASE_SERVICE_ROLE_KEY');

const TIPO_PROP = env.TICKET_TYPE_PROPERTY || 'qt_tipo_solicitud';
// Lista en orden de prioridad: se toma la primera propiedad con valor.
// Del dato más firme (As-Built) al más temprano (preliminar).
const KWP_PROPS = (env.DEAL_KWP_PROPERTY || [
  'tamano_sistema_as_built_kwp_dc',
  'tamano_de_sistema__kwp___final_',
  'tamano_de_sistema__kwp__cotizacion',
  'sunvoy___project_size_kwp__final___number_',
  'tamano_de_sistema__kwp___preliminar_',
].join(',')).split(',').map(s => s.trim()).filter(Boolean);
const INSTALL_PROP = env.DEAL_INSTALL_DATE_PROPERTY || 'fecha_de_instalacion__';
const DEAL_PIPELINES = (env.DEAL_PIPELINE_IDS || '160230047,917378954,71905038')
  .split(',').map(s => s.trim()).filter(Boolean);
const DIAS_CERRADOS = Number(env.CLOSED_LOOKBACK_DAYS || 120);

function req(name) {
  const v = env[name];
  if (!v) { console.error(`Falta la variable ${name}`); process.exit(1); }
  return v;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Fecha de hoy en CDMX (UTC-6, sin horario de verano desde 2022)
const hoyCDMX = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);

// ---------- HubSpot ----------
async function hs(path, body) {
  for (let intento = 0; intento < 6; intento++) {
    const res = await fetch(`https://api.hubapi.com${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * (intento + 1)); continue; }
    if (!res.ok) throw new Error(`HubSpot ${path} → ${res.status}: ${await res.text()}`);
    await sleep(120); // margen bajo el límite de la API de búsqueda
    return res.json();
  }
  throw new Error(`HubSpot ${path}: demasiados reintentos`);
}

async function searchAll(objeto, filterGroups, properties) {
  const out = [];
  let after;
  do {
    const r = await hs(`/crm/v3/objects/${objeto}/search`, {
      filterGroups, properties, limit: 100, after,
      sorts: [{ propertyName: 'hs_object_id', direction: 'ASCENDING' }],
    });
    out.push(...r.results);
    after = r.paging?.next?.after;
    if (out.length >= 10000 && after) {
      console.warn(`Aviso: la búsqueda de ${objeto} superó 10,000 resultados; HubSpot no devuelve más.`);
      break;
    }
  } while (after);
  return out;
}

// ---------- Supabase (REST con service role) ----------
async function sb(method, path, body, prefer = 'return=minimal') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path} → ${res.status}: ${await res.text()}`);
}
async function upsert(table, rows, onConflict) {
  for (const parte of chunk(rows, 500)) {
    await sb('POST', `${table}?on_conflict=${onConflict}`, parte, 'resolution=merge-duplicates,return=minimal');
  }
}

// ---------- Proceso ----------
async function main() {
  console.log(`Foto del ${hoyCDMX}`);

  // 1. Pipelines y etapas
  const [ticketPipes, dealPipes] = await Promise.all([
    hs('/crm/v3/pipelines/tickets'), hs('/crm/v3/pipelines/deals'),
  ]);
  const ticketPipeLabel = {}, ticketStage = {};
  for (const p of ticketPipes.results) {
    ticketPipeLabel[p.id] = p.label;
    for (const s of p.stages) ticketStage[s.id] = { label: s.label, cerrado: s.metadata?.ticketState === 'CLOSED' };
  }
  const dealPipeLabel = {}, etapas = [], etapasActivas = [];
  for (const p of dealPipes.results) {
    dealPipeLabel[p.id] = p.label;
    if (!DEAL_PIPELINES.includes(p.id)) continue;
    for (const s of p.stages) {
      etapas.push({ etapa_id: s.id, etiqueta: s.label, pipeline: p.label, orden: s.displayOrder });
      const perdido = s.metadata?.isClosed === 'true' && Number(s.metadata?.probability) === 0;
      if (!perdido) etapasActivas.push(s.id);
    }
  }
  // merge-duplicates solo actualiza las columnas enviadas: es_instalado no se pisa
  await upsert('etapas_deal', etapas, 'etapa_id');

  // 2. Tickets abiertos + cerrados en la ventana
  const desde = new Date(Date.now() - DIAS_CERRADOS * 864e5).toISOString();
  const tickets = await searchAll('tickets', [
    { filters: [{ propertyName: 'closed_date', operator: 'NOT_HAS_PROPERTY' }] },
    { filters: [{ propertyName: 'closed_date', operator: 'GTE', value: desde }] },
  ], ['subject', TIPO_PROP, 'hs_pipeline', 'hs_pipeline_stage', 'hubspot_owner_id',
      'createdate', 'closed_date', 'hs_lastmodifieddate']);
  console.log(`${tickets.length} tickets`);

  // 3. Deals asociados a cada ticket
  const ticketDeals = {};
  for (const parte of chunk(tickets.map(t => t.id), 100)) {
    const r = await hs('/crm/v4/associations/tickets/deals/batch/read', { inputs: parte.map(id => ({ id })) });
    for (const fila of r.results || []) ticketDeals[fila.from.id] = fila.to.map(x => String(x.toObjectId));
  }

  // 4. Deals activos de los pipelines + los que tengan tickets
  const dealProps = ['dealname', 'dealstage', 'pipeline', INSTALL_PROP, ...KWP_PROPS];
  const activos = [];
  for (const parte of chunk(etapasActivas, 90)) {
    activos.push(...await searchAll('deals', [{ filters: [
      { propertyName: 'pipeline', operator: 'IN', values: DEAL_PIPELINES },
      { propertyName: 'dealstage', operator: 'IN', values: parte },
    ] }], dealProps));
  }
  const deals = new Map(activos.map(d => [d.id, d]));
  const faltantes = [...new Set(Object.values(ticketDeals).flat())].filter(id => !deals.has(id));
  for (const parte of chunk(faltantes, 100)) {
    const r = await hs('/crm/v3/objects/deals/batch/read', { inputs: parte.map(id => ({ id })), properties: dealProps });
    for (const d of r.results || []) deals.set(d.id, d);
  }
  console.log(`${deals.size} deals`);

  // 5. Filas de la foto
  const filasDeals = [...deals.values()]
    .filter(d => DEAL_PIPELINES.includes(d.properties.pipeline))
    .map(d => ({
      snapshot_date: hoyCDMX,
      deal_id: d.id,
      nombre: d.properties.dealname,
      segmento: dealPipeLabel[d.properties.pipeline] || d.properties.pipeline,
      etapa_id: d.properties.dealstage,
      ...kwpDe(d.properties),
      fecha_instalacion: fecha(d.properties[INSTALL_PROP]),
    }));

  const filasTickets = tickets.map(t => {
    const p = t.properties;
    const etapa = ticketStage[p.hs_pipeline_stage] || {};
    const dealIds = ticketDeals[t.id] || [];
    const primerDeal = deals.get(dealIds[0]);
    return {
      snapshot_date: hoyCDMX,
      ticket_id: t.id,
      asunto: p.subject,
      tipo: p[TIPO_PROP],
      segmento: primerDeal ? (dealPipeLabel[primerDeal.properties.pipeline] || null) : null,
      equipo: ticketPipeLabel[p.hs_pipeline] || p.hs_pipeline,
      etapa_ticket: etapa.label || p.hs_pipeline_stage,
      owner_id: p.hubspot_owner_id || null,
      creado: p.createdate,
      cerrado: p.closed_date || (etapa.cerrado ? p.hs_lastmodifieddate : null),
      deal_ids: dealIds,
      sitios: Math.max(1, dealIds.length),
    };
  });

  // 6. Escribir (la foto del día se reemplaza si el script corre dos veces)
  await upsert('snapshots', [{ snapshot_date: hoyCDMX }], 'snapshot_date');
  await sb('DELETE', `deals_snapshot?snapshot_date=eq.${hoyCDMX}`);
  await sb('DELETE', `tickets_snapshot?snapshot_date=eq.${hoyCDMX}`);
  await upsert('deals_snapshot', filasDeals, 'snapshot_date,deal_id');
  await upsert('tickets_snapshot', filasTickets, 'snapshot_date,ticket_id');
  console.log(`Listo: ${filasDeals.length} deals y ${filasTickets.length} tickets guardados.`);
}

function kwpDe(props) {
  for (const prop of KWP_PROPS) {
    const v = num(props[prop]);
    if (v != null && v > 0) return { kwp: v, kwp_fuente: prop };
  }
  return { kwp: null, kwp_fuente: null };
}
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
function fecha(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const n = Number(v);
  const d = Number.isFinite(n) ? new Date(n) : new Date(v); // HubSpot puede mandar epoch en ms
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

main().catch(e => { console.error(e); process.exit(1); });
