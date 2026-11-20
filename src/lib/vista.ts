import { fmt, fmt1, isoDay } from './fechas.js';
import type { Unidad } from '../estado';
import type { OpcionesNum } from '../ui/primitivos';

// ---------------------------------------------------------------------------
// Ayudas de presentación portadas del tablero estático. La única diferencia es
// que la unidad (sitios / kWp) llega como parámetro en vez de leerse del
// ESTADO global. Las cuentas son las mismas.
// ---------------------------------------------------------------------------

export const v = (x: { sitios: number; kwp: number }, unidad: Unidad): string =>
  unidad === 'sitios' ? fmt.format(x.sitios) : fmt.format(x.kwp);

export const u = (unidad: Unidad, n?: number): string =>
  unidad === 'sitios' ? (n === 1 ? 'sitio' : 'sitios') : 'kWp';

export const nSitios = (n: number): string =>
  `${fmt.format(n)} ${n === 1 ? 'sitio' : 'sitios'}`;

/** En sitios es un conteo y se puede cotejar; en kWp es una suma y se explica. */
export const opU = (ds: any[], que: string, unidad: Unidad): OpcionesNum | undefined =>
  unidad === 'sitios'
    ? undefined
    : {
        explica: `Suma de kWp de ${fmt.format(ds.length)} ${ds.length === 1 ? 'sitio' : 'sitios'} ${que}: ${fmt1.format(ds.reduce((a, d) => a + (d.kwp || 0), 0))} kWp`,
        ordenar: 'kwp',
      };

export const opHoras = (ts: any[], que: string): OpcionesNum => ({
  explica: `Suma del esfuerzo del catálogo de ${fmt.format(ts.length)} ${ts.length === 1 ? 'ticket' : 'tickets'} ${que}: ${fmt1.format(ts.reduce((a, t) => a + (t.horas || 0), 0))} h`,
  ordenar: 'atraso',
});

export const opPct = (ts: any[], que: string): OpcionesNum => ({
  explica: `${fmt.format(ts.filter(t => t.edad <= t.sla).length)} de ${fmt.format(ts.length)} ${que} cerraron dentro de su SLA`,
  ordenar: 'atraso',
});

export const opMediana = (ts: any[], valor: number): OpcionesNum => ({
  explica: `Mediana de ${fmt1.format(valor)} días hábiles sobre ${fmt.format(ts.length)} ${ts.length === 1 ? 'ticket abierto' : 'tickets abiertos'}, ordenados por edad`,
  ordenar: 'edad',
  resaltar: (filas: any[]) => {
    const n = filas.length;
    return new Set(n % 2 ? [(n - 1) / 2] : [n / 2 - 1, n / 2]);
  },
});

export const opUtil = (ts: any[], quien: string, req: number, disp: number): OpcionesNum => ({
  explica: `${fmt1.format(req)} h requeridas entre ${fmt1.format(disp)} h disponibles de ${quien}. Los ${fmt.format(ts.length)} abiertos que forman las horas requeridas:`,
  ordenar: 'atraso',
});

// ---------------------------------------------------------------------------
// Fuente y fecha de actualización de cada sección.
// ---------------------------------------------------------------------------

export function cdmx(iso: string | null | undefined): string {
  if (!iso) return 'sin fecha';
  try {
    return new Date(iso).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }) + ' CDMX';
  } catch {
    return String(iso);
  }
}

export function fuenteHubspot(raw: any): string {
  const s = (raw.snaps || []).find((x: any) => x.snapshot_date === raw.ultima);
  return `HubSpot · foto del ${raw.ultima}, tomada el ${cdmx(s && s.creado)}`;
}

export function fuenteManual(filas: any[] | undefined, etiqueta: string): string {
  const fechas = (filas || []).map(f => f.actualizado_en).filter(Boolean).sort();
  const ultima = fechas[fechas.length - 1];
  return `Tickets Manual · ${etiqueta}${ultima ? ` · cargado el ${cdmx(ultima)}` : ' · sin fecha de carga'}`;
}

export { isoDay };
