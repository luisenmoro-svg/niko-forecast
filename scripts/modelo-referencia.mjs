// Resultado de referencia del modelo.
//
// Corre `modelo.js` con entradas fijas y compara el resultado contra
// `scripts/modelo-referencia.json`. Si algo cambió, falla y dice qué.
//
//   node scripts/modelo-referencia.mjs           → escribe la referencia
//   node scripts/modelo-referencia.mjs --check   → la compara (sale 1 si cambió)
//
// Lo usa el workflow «Guardián del modelo» en cada push que toque modelo.js,
// scripts/ o supabase/. No bloquea el push: abre un issue con el diff.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calcularPronostico, calcularMeta } from '../modelo.js';
import { CFG } from '../config.js';

const REF = fileURLToPath(new URL('./modelo-referencia.json', import.meta.url));

// ---------- Entradas fijas ----------
// Deterministas a propósito: ni fechas de hoy, ni datos de Supabase. Lo único que
// se mide aquí es si el modelo, con las mismas entradas, da las mismas salidas.
const ritmos = CFG.ritmoEtapas;

const ESTADO_FIJO = {};
ritmos.forEach((r, i) => {
  // Valores arbitrarios pero estables, distintos entre etapas para que un error
  // de índice o de orden se note.
  ESTADO_FIJO[r.id] = { sitios: 10 + i * 7, kwp: (10 + i * 7) * 15 };
});

const ESFUERZOS = {
  'Planning levantamiento': 1.5, 'Ejecución levantamiento': 4,
  'Diseño y adicionales finales': 0.7, 'Costeo final Overhaul': 0.9,
  'Revisión de IX': 1, 'Disponibilidad': 0.5, 'Creación de rutas de instalación': 2,
  'Revisión de Ingenieria': 3.8, 'IX Aprobación diagrama unifilar': 1,
  'VoBo Scoop RFP': 0.5, 'Procurement Quote': 1, 'IX Quote': 1,
  'VoBo costo cotizado y OS': 0.5, 'Cierre de planeación': 1,
};
const SLA = {
  'Planning levantamiento': 5, 'Ejecución levantamiento': 3,
  'Diseño y adicionales finales': 2, 'Costeo final Overhaul': 1,
  'Revisión de IX': 2, 'Disponibilidad': 1, 'Creación de rutas de instalación': 3,
  'Revisión de Ingenieria': 2, 'IX Aprobación diagrama unifilar': 2,
  'VoBo Scoop RFP': 1, 'Procurement Quote': 2, 'IX Quote': 2,
  'VoBo costo cotizado y OS': 1, 'Cierre de planeación': 2,
};
const CAPACIDAD = {
  Planning: 80, LiveOps: 120, Design: 60, Quoting: 40, IX: 40,
  Procurement: 40, Product: 40, Engineering: 80,
};

const esfuerzo = (tipo, esRevision) => {
  const h = ESFUERZOS[tipo];
  if (h == null) return { h: null, fuente: 'sin dato' };
  return { h: esRevision ? h * 0.4 : h, fuente: 'referencia' };
};
const sla = tipo => SLA[tipo] ?? null;

function calcular() {
  const pron = calcularPronostico({
    ritmos,
    estado: ESTADO_FIJO,
    capSemana: CAPACIDAD,
    esfuerzo,
    sla,
    horasPara: (tipo, equipo) => ({
      h: (CAPACIDAD[equipo] || 0) / 2,
      quienes: { ids: ['ref-1', 'ref-2'], fuente: 'referencia' },
    }),
    nuevos: { sitios: 8, kwpPorSitio: 15 },
    semanas: CFG.semanasPronostico || 10,
    ajustes: {},
  });

  const meta = calcularMeta({
    ritmos,
    metaSemana: 80 / 4.33,
    kwpPorSitio: 15,
    esfuerzo,
    sla,
    tasaPuntaAPunta: (CFG.tasaDesdeLevantamiento || {}).observada ?? null,
  });

  // Se guarda lo que de verdad importa: los números, no los objetos auxiliares.
  return {
    version: 1,
    pronostico: {
      semanas: pron.semanas.map(w => ({
        etiqueta: w.etiqueta,
        sitios: w.sitios,
        kwp: w.kwp,
        instalados: w.instalados,
        porEtapa: w.porEtapa,
        traza: Object.fromEntries(Object.entries(w.traza).map(([id, t]) => [id, {
          cod: t.cod, inicio: r1(t.inicio), llegaron: r1(t.llegaron),
          salieron: r1(t.salieron), perdidos: r1(t.perdidos),
          nuevos: r1(t.nuevos), fin: t.fin, conversion: t.conversion,
          deFuentes: t.deFuentes, modo: (t.porque || {}).modo,
        }])),
      })),
      sinEsfuerzo: pron.sinEsfuerzo,
      sinSla: pron.sinSla,
      sinQuien: pron.sinQuien,
      cuellos: (pron.cuellos || []).map(c => ({
        nombre: c.nombre, cap: r1(c.cap), dem: (c.dem || []).map(r1), colas: c.colas,
      })),
    },
    meta: {
      entradaSemana: r1(meta.entradaSemana),
      entradaFuente: meta.entradaFuente,
      necesita: (meta.necesita || []).map(n => ({
        cod: n.cod, sitios: r1(n.sitios), entranSemana: r1(n.entranSemana),
        dias: r1(n.dias), conversion: n.conversion,
      })),
      horasEquipo: redondearObj(meta.horasEquipo),
      horasTipo: redondearObj(meta.horasTipo),
    },
  };
}

function r1(x) {
  if (x == null || typeof x !== 'number') return x;
  return Math.round(x * 1000) / 1000;
}
function redondearObj(o) {
  if (!o) return o;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r1(v)]));
}

// ---------- Diff legible ----------
function diferencias(a, b, ruta = '', out = []) {
  if (out.length >= 40) return out;
  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb) { out.push(`${ruta}: ${ta} → ${tb}`); return out; }
  if (ta === 'object') {
    const claves = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of claves) {
      if (!(k in a)) { out.push(`${ruta}.${k}: no existía → ${JSON.stringify(b[k])}`); continue; }
      if (!(k in b)) { out.push(`${ruta}.${k}: ${JSON.stringify(a[k])} → desapareció`); continue; }
      diferencias(a[k], b[k], `${ruta}.${k}`, out);
    }
  } else if (ta === 'array') {
    if (a.length !== b.length) out.push(`${ruta}: ${a.length} elementos → ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diferencias(a[i], b[i], `${ruta}[${i}]`, out);
  } else if (a !== b) {
    out.push(`${ruta}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  }
  return out;
}

// ---------- Main ----------
const comprobar = process.argv.includes('--check');
const actual = calcular();

if (!comprobar) {
  writeFileSync(REF, JSON.stringify(actual, null, 2) + '\n', 'utf8');
  console.log(`Referencia escrita: ${REF}`);
  process.exit(0);
}

if (!existsSync(REF)) {
  console.error('No hay referencia guardada. Corre `node scripts/modelo-referencia.mjs` y haz commit del JSON.');
  process.exit(1);
}

const esperado = JSON.parse(readFileSync(REF, 'utf8'));
const difs = diferencias(esperado, actual, 'modelo');

if (!difs.length) {
  console.log('El modelo da exactamente el mismo resultado que la referencia.');
  process.exit(0);
}

console.error(`El modelo cambió: ${difs.length} diferencia(s)${difs.length >= 40 ? ' (se muestran las primeras 40)' : ''}.\n`);
for (const d of difs) console.error('  ' + d);
console.error('\nSi el cambio es intencional, corre `node scripts/modelo-referencia.mjs` y haz commit del JSON actualizado.');
process.exit(1);
