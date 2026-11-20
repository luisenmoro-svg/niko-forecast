import {
  createContext, useContext, useMemo, useState, useCallback, type ReactNode,
} from 'react';
import { isoDay, HOY } from './lib/fechas.js';
import { CFG } from '../config.js';

// ---------------------------------------------------------------------------
// Estado de la vista. Es el mismo objeto ESTADO del tablero estático, partido en
// dos: lo que el usuario elige (controles, simulador) y lo que se deriva de ahí.
// El simulador cambia SOLO su propia rama; nunca toca los datos.
// ---------------------------------------------------------------------------

export type Unidad = 'sitios' | 'kwp';
export type Tab = 'flujo' | 'cap';

export interface Sim {
  meta: number | null;
  focoFactor: number;
  multEsfuerzo: number;
  extraPersonas: Record<string, number>;
  diasEtapa: Record<string, number>;
  entrada?: 'real' | 'meta';
}

export const SIM0: Sim = {
  meta: null, focoFactor: 1, multEsfuerzo: 1, extraPersonas: {}, diasEtapa: {},
};

export interface EstadoVista {
  tab: Tab;
  unidad: Unidad;
  horizonte: number;
  mes: string;
  segmento: string | null;
  t0: string | null;
  sim: Sim;
  simOn: boolean;
}

export const ESTADO_INICIAL: EstadoVista = {
  tab: 'flujo',
  unidad: 'sitios',
  horizonte: (CFG as any).horizonteDias || 10,
  mes: isoDay(HOY).slice(0, 7),
  segmento: null,
  t0: null,
  sim: { ...SIM0, extraPersonas: {}, diasEtapa: {} },
  simOn: false,
};

/** ¿El simulador está cambiando algo? Equivale al `simActivo()` del tablero anterior. */
export function simActivo(e: EstadoVista): boolean {
  return e.simOn;
}

// ---------------------------------------------------------------------------
// Panel de detalle. En el tablero estático había un registro global (DRILL) con
// un id por número; aquí el botón lleva su propio contenido y lo entrega al
// abrirse. Es el mismo comportamiento, sin el registro intermedio.
// ---------------------------------------------------------------------------

export type TipoPanel =
  | 'tickets' | 'sitios' | 'delta' | 'desglose' | 'instalados' | 'entrada' | 'meta';

export interface Carga {
  titulo: string;
  tipo: TipoPanel;
  registros?: any[];
  mostrado?: string;
  explica?: string | null;
  ordenar?: string | null;
  resaltar?: ((filas: any[]) => Set<number>) | null;
  /** Campos propios de cada tipo de panel. */
  desglose?: any;
  traza?: any;
  etapaEtiqueta?: string;
  inst?: any;
  e?: any;
  n?: any;
  P?: any;
}

interface Ctx {
  estado: EstadoVista;
  set: (parche: Partial<EstadoVista>) => void;
  setSim: (parche: Partial<Sim>) => void;
  resetSim: () => void;
  panel: Carga | null;
  abrirPanel: (c: Carga, origen?: HTMLElement | null) => void;
  cerrarPanel: () => void;
  origen: HTMLElement | null;
}

const C = createContext<Ctx | null>(null);

export function ProveedorEstado({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoVista>(ESTADO_INICIAL);
  const [panel, setPanel] = useState<Carga | null>(null);
  const [origen, setOrigen] = useState<HTMLElement | null>(null);

  const set = useCallback((parche: Partial<EstadoVista>) => {
    setEstado(e => ({ ...e, ...parche }));
  }, []);

  const setSim = useCallback((parche: Partial<Sim>) => {
    setEstado(e => {
      const sim = { ...e.sim, ...parche };
      // simOn se deduce del contenido, igual que antes: si algo difiere del valor
      // neutro, el escenario está simulado y la vista lo avisa.
      const on = sim.meta != null
        || sim.focoFactor !== 1
        || sim.multEsfuerzo !== 1
        || Object.keys(sim.extraPersonas || {}).length > 0
        || Object.keys(sim.diasEtapa || {}).length > 0
        || (sim.entrada != null && sim.entrada !== 'real');
      return { ...e, sim, simOn: on };
    });
  }, []);

  const resetSim = useCallback(() => {
    setEstado(e => ({ ...e, sim: { ...SIM0, extraPersonas: {}, diasEtapa: {} }, simOn: false }));
  }, []);

  const abrirPanel = useCallback((c: Carga, o?: HTMLElement | null) => {
    setOrigen(o ?? null);
    setPanel(c);
  }, []);

  const cerrarPanel = useCallback(() => {
    setPanel(null);
    // Devolver el foco a quien abrió el panel, como antes.
    if (origen && document.body.contains(origen)) origen.focus();
    setOrigen(null);
  }, [origen]);

  const valor = useMemo<Ctx>(
    () => ({ estado, set, setSim, resetSim, panel, abrirPanel, cerrarPanel, origen }),
    [estado, set, setSim, resetSim, panel, abrirPanel, cerrarPanel, origen],
  );

  return <C.Provider value={valor}>{children}</C.Provider>;
}

export function useEstado(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error('useEstado fuera de ProveedorEstado');
  return c;
}

// ---------------------------------------------------------------------------
// Secciones colapsables. El estado se recuerda por persona en localStorage,
// siempre en try/catch: en modo privado el acceso puede lanzar.
// ---------------------------------------------------------------------------

const LLAVE = 'niko.secciones';

export function leerAbiertas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LLAVE) || '[]'));
  } catch {
    return new Set();
  }
}

export function guardarAbiertas(s: Set<string>) {
  try {
    localStorage.setItem(LLAVE, JSON.stringify([...s]));
  } catch {
    /* modo privado: no se recuerda, y no pasa nada */
  }
}
