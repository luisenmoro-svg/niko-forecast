// Formato, números y días hábiles (hora CDMX).
// Portado tal cual del tablero estático: no se tocó ninguna cuenta.

export const DAY = 864e5;
export const fmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
export const fmt1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
export const pct = v => (v == null || !isFinite(v)) ? '—' : fmt.format(v * 100) + ' %';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sum = (a, f = x => x) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const groupBy = (a, f) => a.reduce((m, x) => { const k = f(x); (m[k] ||= []).push(x); return m; }, {});
export const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ====================== Días hábiles (hora CDMX) ======================
// Los días se representan como milisegundos UTC a medianoche.
export function toDay(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return Date.parse(v + 'T00:00:00Z');
  const t = typeof v === 'number' ? v : Date.parse(v);
  if (isNaN(t)) return null;
  const d = new Date(t - 6 * 36e5);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
export const isoDay = t => new Date(t).toISOString().slice(0, 10);
export let FERIADOS = new Set();
export function setFeriados(s) { FERIADOS = s; }
export function esHabil(t) { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6 && !FERIADOS.has(t); }
export function habilesEntre(a, b) { // desde a (incluido) hasta b (excluido)
  if (a == null || b == null) return null;
  const [s, e] = a <= b ? [a, b] : [b, a];
  let n = 0; for (let t = s; t < e; t += DAY) if (esHabil(t)) n++;
  return a <= b ? n : -n;
}
export function siguientesHabiles(desde, n) { const out = []; let t = desde; while (out.length < n) { if (esHabil(t)) out.push(t); t += DAY; } return out; }
export const HOY = toDay(Date.now());
