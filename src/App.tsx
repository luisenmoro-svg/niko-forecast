import { useEffect, useMemo, useState } from 'react';
import { DEMO } from './lib/entorno';
import { sb, salir, sesionValida } from './lib/supabase';
import { cargarSupabase, datosEjemplo } from './lib/datos.js';
import { construirModelo } from './lib/nucleo';
import { isoDay, HOY, MESES } from './lib/fechas.js';
import { useEstado } from './estado';
import { Meta } from './componentes/Meta';
import { VistaFlujo } from './componentes/VistaFlujo';
import { VistaCapacidad } from './componentes/VistaCapacidad';
import { Simulador } from './componentes/Simulador';
import { Acceso, ErrorCarga } from './componentes/Acceso';
import { Panel } from './ui/Panel';
import { useCerrarInfos } from './ui/primitivos';

// ---------------------------------------------------------------------------
// Armazón: sesión, carga de datos, controles, pestañas.
// Las fórmulas no viven aquí: salen de src/lib (portado del tablero estático) y
// de modelo.js, que es la única implementación del pronóstico.
// ---------------------------------------------------------------------------

type Fase =
  | { f: 'cargando' }
  | { f: 'acceso'; mensaje?: string | null; esError?: boolean }
  | { f: 'error'; mensaje: string }
  | { f: 'listo' };

export function App() {
  const { estado, set } = useEstado();
  const [fase, setFase] = useState<Fase>({ f: 'cargando' });
  const [raw, setRaw] = useState<any>(null);
  useCerrarInfos();

  // ---- Sesión ----
  useEffect(() => {
    if (DEMO) { cargar(null); return; }
    let vivo = true;
    (async () => {
      const { data } = await sb!.auth.getSession();
      if (!vivo) return;
      if (!data.session) { setFase({ f: 'acceso' }); return; }
      const problema = await sesionValida(data.session);
      if (!vivo) return;
      if (problema) { setFase({ f: 'acceso', mensaje: problema, esError: true }); return; }
      cargar(null);
    })();
    const { data: sub } = sb!.auth.onAuthStateChange(async (_ev, session) => {
      if (!session) return;
      const problema = await sesionValida(session);
      if (problema) setFase({ f: 'acceso', mensaje: problema, esError: true });
      else cargar(null);
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Carga de datos ----
  async function cargar(t0: string | null) {
    setFase({ f: 'cargando' });
    try {
      let datos: any;
      if (DEMO) {
        datos = datosEjemplo();
        if (t0) {
          // En modo ejemplo se recorta la serie para simular otra línea base.
          const i = datos.semanas.indexOf(t0);
          if (i > 0) datos.semanas = datos.semanas.slice(i);
        }
      } else {
        datos = await cargarSupabase(t0);
      }
      setRaw(datos);
      if (!estado.segmento) {
        const segs = [...new Set(datos.etapas.map((e: any) => e.pipeline))] as string[];
        set({ segmento: segs.find(s => s.includes('Enterprise')) || segs[0] || null });
      }
      setFase({ f: 'listo' });
    } catch (err: any) {
      setFase({ f: 'error', mensaje: err?.message || String(err) });
    }
  }

  // ---- Modelo: se recalcula cuando cambia un control, no en cada render ----
  const M = useMemo(() => {
    if (!raw || !estado.segmento) return null;
    return construirModelo(raw, {
      horizonte: estado.horizonte,
      mes: estado.mes,
      segmento: estado.segmento,
    });
  }, [raw, estado.horizonte, estado.mes, estado.segmento]);

  if (fase.f === 'acceso') return <Acceso mensaje={fase.mensaje} esError={fase.esError} />;
  if (fase.f === 'error') return <ErrorCarga mensaje={fase.mensaje} />;
  if (fase.f === 'cargando' || !raw || !M) return <p className="estado">Cargando…</p>;

  const segmentos = [...new Set(raw.etapas.map((e: any) => e.pipeline))].filter(Boolean) as string[];
  const meses: string[] = [];
  const base = new Date(HOY as number);
  for (let i = -2; i <= 3; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i, 1));
    meses.push(isoDay(d.getTime()).slice(0, 7));
  }

  return (
    <>
      <header className="top">
        <div>
          <h1>Ticket System: capacidad y flujo</h1>
          <div className="meta-linea">Foto de HubSpot del {raw.ultima}</div>
        </div>
        <div className="controles">
          <label>
            Mes
            <select value={estado.mes} onChange={e => set({ mes: e.target.value })}>
              {meses.map(m => {
                const [a, mm] = m.split('-');
                return <option value={m} key={m}>{MESES[+mm - 1]} {a}</option>;
              })}
            </select>
          </label>
          <label>
            Segmento
            <select value={estado.segmento ?? ''} onChange={e => set({ segmento: e.target.value })}>
              {segmentos.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>
            T0
            <select
              value={estado.t0 ?? raw.semanas[0]}
              onChange={e => { set({ t0: e.target.value }); cargar(e.target.value); }}
            >
              {raw.fechas.map((f: string) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <span className="seg" role="group" aria-label="Unidad">
            <button type="button" aria-pressed={estado.unidad === 'sitios'} onClick={() => set({ unidad: 'sitios' })}>Sitios</button>
            <button type="button" aria-pressed={estado.unidad === 'kwp'} onClick={() => set({ unidad: 'kwp' })}>kWp</button>
          </span>
          <label>
            Horizonte
            <select value={estado.horizonte} onChange={e => set({ horizonte: +e.target.value })}>
              {[5, 10, 15, 20].map(n => <option value={n} key={n}>{n} días</option>)}
            </select>
          </label>
        </div>
      </header>

      {DEMO ? (
        <p className="aviso fila">
          <span className="badge-nuevo">Ejemplo</span>
          Estos son datos de ejemplo. Pon VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY para ver los
          datos reales.
        </p>
      ) : null}

      <Meta M={M.metricas} />

      <div className="tabs" role="tablist">
        <button
          role="tab" id="t-flujo" aria-controls="p-flujo"
          aria-selected={estado.tab === 'flujo'} onClick={() => set({ tab: 'flujo' })}
        >
          Flujo y SLA
        </button>
        <button
          role="tab" id="t-cap" aria-controls="p-cap"
          aria-selected={estado.tab === 'cap'} onClick={() => set({ tab: 'cap' })}
        >
          Capacidad y saturación
        </button>
      </div>

      <Simulador M={M} />

      <section className="panel" id="p-flujo" role="tabpanel" aria-labelledby="t-flujo" hidden={estado.tab !== 'flujo'}>
        <VistaFlujo M={M} raw={raw} />
      </section>
      <section className="panel" id="p-cap" role="tabpanel" aria-labelledby="t-cap" hidden={estado.tab !== 'cap'}>
        <VistaCapacidad M={M} raw={raw} />
      </section>

      <Panel />
    </>
  );
}

export function BotonSalir() {
  if (DEMO) return null;
  return <button type="button" onClick={salir}>Salir</button>;
}
