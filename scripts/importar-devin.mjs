// Importa las fotos de Devin (foto_hubspot_*.json) a demanda_historica.
// Uso:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/importar-devin.mjs datos/devin/*.json
// Las fotos NO traen deals individuales: solo tipos_30d, un agregado de 30 días por
// tipo de ticket con su reparto por owner, resolución y pipeline.
import { readFile } from 'node:fs/promises';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!SUPABASE_URL || !KEY) { console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const archivos = process.argv.slice(2);
if (!archivos.length) { console.error('Pasa las rutas de los foto_hubspot_*.json'); process.exit(1); }

const filas = [];
for (const ruta of archivos) {
  let txt = await readFile(ruta, 'utf8');
  // Algunas copias vienen con escapes de markdown.
  txt = txt.replace(/\\\\"/g, '\\"').replace(/\\(?!["\\/bfnrtu])/g, '');
  let j;
  try { j = JSON.parse(txt); } catch (e) { console.error(`${ruta}: no es JSON válido (${e.message})`); continue; }
  if (!j.tipos_30d) { console.error(`${ruta}: sin tipos_30d, se omite`); continue; }
  const fecha = j.fecha;
  for (const [tipo, d] of Object.entries(j.tipos_30d)) {
    const pipeline = Object.keys(d.pipelines || {})[0] || '';
    // pipeline y resolucion forman parte de la llave: van con '' y nunca con null.
    filas.push({ fecha, tipo, owner: '(todos)', tickets: d.tickets || 0, pipeline, resolucion: '' });
    for (const [owner, n] of Object.entries(d.owners || {}))
      filas.push({ fecha, tipo, owner, tickets: n, pipeline, resolucion: '' });
    for (const [res, n] of Object.entries(d.resolution || {}))
      filas.push({ fecha, tipo, owner: '(todos)', tickets: n, pipeline, resolucion: res });
  }
  console.log(`${ruta}: ${Object.keys(j.tipos_30d).length} tipos del ${fecha}`);
}

for (let i = 0; i < filas.length; i += 500) {
  const parte = filas.slice(i, i + 500);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/demanda_historica?on_conflict=fecha,tipo,owner,pipeline,resolucion`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
               Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(parte),
  });
  if (!res.ok) { console.error(`Error al escribir: ${res.status} ${await res.text()}`); process.exit(1); }
}
console.log(`Listo: ${filas.length} filas en demanda_historica.`);
