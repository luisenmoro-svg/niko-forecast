import { useEffect, type ReactNode, type MouseEvent } from 'react';
import { CFG } from '../../config.js';
import { fmt, fmt1 } from '../lib/fechas.js';
import { DEMO } from '../lib/entorno';
import { useEstado, type Carga, type TipoPanel } from '../estado';
import { DEF } from '../lib/definiciones';

// ---------------------------------------------------------------------------
// ⓘ  Cada métrica dice qué es. Funciona con cursor, teclado y toque.
// El globo se dibuja con ::after a partir de data-def (ver src/index.css), igual
// que en el tablero anterior; aquí solo se monta el botón.
// ---------------------------------------------------------------------------

export function Info({ id, texto }: { id?: keyof typeof DEF; texto?: string }) {
  const t = texto ?? (id ? DEF[id] : undefined);
  if (!t) return null;
  return (
    <button
      className="info"
      type="button"
      aria-label={texto ? 'Cómo se calcula' : 'Qué es esto'}
      data-def={t}
      onClick={alternarInfo}
    >
      i
    </button>
  );
}

/** En toque no hay hover: el clic fija el globo y lo ancla si se sale de pantalla. */
function alternarInfo(ev: MouseEvent<HTMLButtonElement>) {
  const b = ev.currentTarget;
  const abierto = b.classList.contains('abierto');
  document.querySelectorAll('.info.abierto').forEach(x => x.classList.remove('abierto'));
  if (abierto) return;
  const r = b.getBoundingClientRect();
  b.classList.remove('anc-izq', 'anc-der');
  if (r.left < 140) b.classList.add('anc-izq');
  else if (window.innerWidth - r.right < 140) b.classList.add('anc-der');
  b.classList.add('abierto');
}

/** Cierra los globos fijados al tocar fuera o con Esc. */
export function useCerrarInfos() {
  useEffect(() => {
    const fuera = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest('.info')) return;
      document.querySelectorAll('.info.abierto').forEach(x => x.classList.remove('abierto'));
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') document.querySelectorAll('.info.abierto').forEach(x => x.classList.remove('abierto'));
    };
    document.addEventListener('click', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('click', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Vínculos a HubSpot. Todo ticket y todo sitio enlaza a su registro.
// ---------------------------------------------------------------------------

function hsUrl(obj: string, id: unknown): string | null {
  return (CFG as any).hubspotPortalId && !DEMO && id
    ? `https://app.hubspot.com/contacts/${(CFG as any).hubspotPortalId}/record/${obj}/${encodeURIComponent(String(id))}`
    : null;
}

function Enlace({ obj, id, children }: { obj: string; id: unknown; children: ReactNode }) {
  const u = hsUrl(obj, id);
  if (!u) return <>{children}</>;
  return <a href={u} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export function HsTicket({ id, texto }: { id: unknown; texto?: ReactNode }) {
  return <Enlace obj="0-5" id={id}>{texto ?? String(id ?? '')}</Enlace>;
}

export function HsDeal({ id, texto }: { id: unknown; texto?: ReactNode }) {
  return <Enlace obj="0-3" id={id}>{texto ?? String(id ?? '')}</Enlace>;
}

// ---------------------------------------------------------------------------
// Número clicable. Dos clases, como antes:
//  - conteo: el panel debe tener exactamente tantos registros como dice la cifra.
//  - derivado (mediana, promedio, %, horas, días): no se cuenta, se explica.
// Si no hay lista detrás, se escribe el número y ya: no se vuelve clicable.
// ---------------------------------------------------------------------------

export interface OpcionesNum {
  explica?: string | null;
  ordenar?: string | null;
  resaltar?: ((filas: any[]) => Set<number>) | null;
}

export function Num({
  texto, titulo, registros, tipo = 'tickets', opciones,
}: {
  texto: ReactNode;
  titulo: string;
  registros?: any[] | null;
  tipo?: TipoPanel;
  opciones?: OpcionesNum;
}) {
  const { abrirPanel } = useEstado();
  const lista = registros || [];
  if (!lista.length) return <>{texto}</>;
  return (
    <BotonNum
      carga={{
        titulo, tipo, registros: lista,
        mostrado: typeof texto === 'string' || typeof texto === 'number' ? String(texto) : undefined,
        explica: opciones?.explica ?? null,
        ordenar: opciones?.ordenar ?? null,
        resaltar: opciones?.resaltar ?? null,
      }}
      onOpen={abrirPanel}
    >
      {texto}
    </BotonNum>
  );
}

/** Número cuyo panel no es una lista sino una explicación armada a mano. */
export function NumPanel({ carga, children }: { carga: Carga; children: ReactNode }) {
  const { abrirPanel } = useEstado();
  return <BotonNum carga={carga} onOpen={abrirPanel}>{children}</BotonNum>;
}

function BotonNum({
  carga, onOpen, children,
}: {
  carga: Carga;
  onOpen: (c: Carga, origen?: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <button
      className="num"
      type="button"
      onClick={e => onOpen(carga, e.currentTarget)}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pastillas de estado: siempre con texto, no solo color.
// ---------------------------------------------------------------------------

export function PillSla({ t }: { t: any }) {
  if (t.estadoSla === 'vencido') return <span className="pill bad">Vencido</span>;
  if (t.estadoSla === 'riesgo') return <span className="pill warn">En riesgo</span>;
  if (t.estadoSla === 'ok') return <span className="pill ok">A tiempo</span>;
  return <span className="pill mute">Sin SLA</span>;
}

export const slaTxt = (d: number | null | undefined): string =>
  d == null ? '—' : d < 1 ? `${fmt1.format(d * 8)} h` : `${fmt1.format(d)} d`;

/** Lo que no está firmado en el catálogo se subraya con puntos. */
export function MarcaSupuesto({ firme, children }: { firme?: boolean; children: ReactNode }) {
  if (firme) return <>{children}</>;
  return <span className="supuesto" title="Valor del catálogo aún no firmado">{children}</span>;
}

// ---------------------------------------------------------------------------
// Cifra del bloque de arriba (Goal / Forecast / Real / Delta).
// ---------------------------------------------------------------------------

export function Cifra({
  clase, n, l, s, mk,
}: { clase: string; n: ReactNode; l: ReactNode; s: ReactNode; mk?: string }) {
  return (
    <div className={`cifra ${clase}`}>
      <div className="l">{mk ? <i className={`mk ${mk}`} aria-hidden="true" /> : null}{l}</div>
      <div className="n">{n}</div>
      <div className="s">{s}</div>
    </div>
  );
}

export { fmt, fmt1 };
