import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useEstado, type Carga } from '../estado';
import { fmt, fmt1, pct } from '../lib/fechas.js';
import { notaLotes } from '../lib/nucleo';
import { HsTicket, HsDeal, PillSla, slaTxt } from './primitivos';

// ---------------------------------------------------------------------------
// Panel lateral: todo número agregado abre la lista exacta que lo forma.
//
// La regla que más importa: lo que muestra el panel tiene que cuadrar con la
// cifra. En conteos se compara contra el número de registros; en números
// derivados (mediana, promedio, %, horas, días) no se cuenta, se explica.
// ---------------------------------------------------------------------------

type Col = [string, string, (r: any) => ReactNode, (r: any) => any, string?];

const COLS: Record<string, Col[]> = {
  tickets: [
    ['id', 'Ticket', t => <HsTicket id={t.ticket_id} />, t => t.ticket_id],
    ['asunto', 'Asunto', t => <span title={t.asunto || ''}>{t.asunto || ''}</span>, t => t.asunto || '', 'asunto'],
    ['tipo', 'Tipo', t => t.tipo || '—', t => t.tipo || ''],
    ['owner', 'Owner', t => (t.persona ? t.persona.nombre : (t.owner_id || 'Sin owner')), t => (t.persona ? t.persona.nombre : (t.owner_id || ''))],
    ['etapa', 'Etapa', t => t.etapa_ticket || '—', t => t.etapa_ticket || ''],
    ['edad', 'Edad', t => (t.edad == null ? '—' : fmt1.format(t.edad) + ' d'), t => t.edad ?? -1],
    ['sla', 'SLA', t => slaTxt(t.sla), t => t.sla ?? -1],
    ['atraso', 'Atraso', t => ((t.sla == null || t.edad == null) ? '—' : fmt1.format(Math.max(0, t.edad - t.sla)) + ' d'), t => ((t.sla == null || t.edad == null) ? -1 : t.edad - t.sla)],
    ['estado', 'Estado', t => <PillSla t={t} />, t => t.estadoSla || ''],
  ],
  sitios: [
    ['nombre', 'Sitio', d => <HsDeal id={d.deal_id} texto={d.nombre || d.deal_id} />, d => d.nombre || ''],
    ['etapa', 'Etapa', d => d.etapaEtiqueta || d.etapa_id || '—', d => d.etapaEtiqueta || ''],
    ['kwp', 'kWp', d => fmt1.format(d.kwp || 0), d => d.kwp || 0],
    ['inst', 'Instalación', d => d.fecha_instalacion || '—', d => d.fecha_instalacion || ''],
  ],
};

export function Panel() {
  const { panel, cerrarPanel } = useEstado();
  const [orden, setOrden] = useState<string | null>(null);
  const [asc, setAsc] = useState(true);

  // Cada apertura empieza con el orden que pida la carga, como antes.
  useEffect(() => {
    setOrden(panel?.ordenar ?? null);
    setAsc(true);
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarPanel(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [panel, cerrarPanel]);

  const cols = COLS[panel?.tipo ?? 'tickets'] || COLS.tickets;

  const filas = useMemo(() => {
    const f = [...(panel?.registros || [])];
    if (!orden) return f;
    const c = cols.find(x => x[0] === orden);
    if (!c) return f;
    f.sort((a, b) => {
      const va = c[3](a), vb = c[3](b);
      const r = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'es');
      return asc ? r : -r;
    });
    return f;
  }, [panel, orden, asc, cols]);

  if (!panel) return null;

  const ordenarPor = (c: string) => {
    if (orden === c) setAsc(a => !a); else { setOrden(c); setAsc(true); }
  };

  return (
    <aside
      className="panel-det"
      id="panel-det"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pd-t"
    >
      <header>
        <h2 id="pd-t">{panel.titulo}</h2>
        <button type="button" id="pd-x" autoFocus onClick={cerrarPanel}>Cerrar</button>
      </header>
      <Encabezado panel={panel} />
      <div id="pd-c">
        <Cuerpo panel={panel} cols={cols} filas={filas} orden={orden} asc={asc} ordenarPor={ordenarPor} />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// La línea de arriba: cuántos registros son, o cómo se calculó el número.
// ---------------------------------------------------------------------------

function Encabezado({ panel }: { panel: Carga }) {
  if (panel.tipo === 'meta') return <p className="pd-n">De dónde sale lo que pide la meta, calculado hacia atrás</p>;
  if (panel.tipo === 'entrada') return <p className="pd-n">Sitios que entraron a levantamiento cada semana, según HubSpot</p>;
  if (panel.tipo === 'instalados') return <p className="pd-n">Sitios que llegan a instalación esa semana</p>;

  if (panel.tipo === 'desglose') {
    const t = panel.traza;
    const cuadra = Math.abs((t.inicio + t.llegaron - t.salieron + t.nuevos) - t.fin) < 0.05;
    return (
      <p className="pd-n">
        Semana a semana, así se arma el número
        {cuadra ? null : <span className="pd-mal">Las cuentas no cuadran con la celda</span>}
      </p>
    );
  }

  if (panel.tipo === 'delta') {
    const g = panel.desglose;
    const suma = g.aportePlan + g.aporteCapacidad;
    const cuadra = Math.abs(suma - g.delta) < 0.05;
    return (
      <p className="pd-n">
        El delta se arma de dos partes
        {cuadra ? null : (
          <span className="pd-mal">
            No cuadra: las partes dan {fmt1.format(suma)} y el delta es {fmt1.format(g.delta)}
          </span>
        )}
      </p>
    );
  }

  // Número derivado: no se cuenta contra la lista, se explica.
  if (panel.explica) return <p className="pd-n">{panel.explica}</p>;

  // Conteo: la lista tiene que tener exactamente tantos registros como la cifra.
  const n = (panel.registros || []).length;
  const mostrado = Number(String(panel.mostrado ?? '').replace(/[^0-9.-]/g, ''));
  const cuadra = !Number.isFinite(mostrado) || n === mostrado;
  return (
    <p className="pd-n">
      {fmt.format(n)} {n === 1 ? 'registro' : 'registros'}
      {cuadra ? null : (
        <span className="pd-mal">
          No cuadra: la cifra dice {panel.mostrado} y la lista tiene {fmt.format(n)}
        </span>
      )}
    </p>
  );
}

// ---------------------------------------------------------------------------
// El cuerpo, por tipo.
// ---------------------------------------------------------------------------

function Cuerpo({
  panel, cols, filas, orden, asc, ordenarPor,
}: {
  panel: Carga; cols: Col[]; filas: any[];
  orden: string | null; asc: boolean; ordenarPor: (c: string) => void;
}) {
  if (panel.tipo === 'meta') return <PanelMeta n={panel.n} P={panel.P} />;
  if (panel.tipo === 'entrada') return <PanelEntrada e={panel.e} />;
  if (panel.tipo === 'desglose') return <PanelDesglose t={panel.traza} etiqueta={panel.etapaEtiqueta || ''} />;
  if (panel.tipo === 'instalados') return <PanelInstalados i={panel.inst} />;
  if (panel.tipo === 'delta') return <PanelDelta g={panel.desglose} />;

  const marca = panel.resaltar ? panel.resaltar(filas) : null;
  return (
    <div className="tabla">
      <table>
        <thead>
          <tr>
            {cols.map(c => (
              <th className="izq" key={c[0]}>
                <button
                  type="button"
                  className="pd-ord"
                  aria-sort={orden === c[0] ? (asc ? 'ascending' : 'descending') : 'none'}
                  onClick={() => ordenarPor(c[0])}
                >
                  {c[1]}{orden === c[0] ? (asc ? ' ↑' : ' ↓') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((r, i) => (
            <tr key={i} className={marca && marca.has(i) ? 'marca' : undefined}>
              {cols.map(c => <td className={`izq ${c[4] || ''}`} key={c[0]}>{c[2](r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelMeta({ n, P }: { n: any; P: any }) {
  return (
    <>
      <div className="tabla">
        <table>
          <tbody>
            <tr><td className="izq">Meta del mes</td><td>{fmt.format(P.metaMes)} sitios</td><td className="izq">≈ {fmt1.format(P.metaMes / 4.33)} instalaciones por semana</td></tr>
            <tr><td className="izq">Deben entrar a {n.cod}</td><td>{fmt1.format(n.entranSemana)}</td><td className="izq">por semana, despejando las conversiones de las etapas siguientes</td></tr>
            <tr><td className="izq">Tarda</td><td>{fmt1.format(n.dias)} d</td><td className="izq">días hábiles según el SLA de sus tickets</td></tr>
            <tr className="marca"><td className="izq"><b>Sitios parados a la vez</b></td><td><b>{fmt1.format(n.sitios)}</b></td><td className="izq">lo que entra por semana × las semanas que tarda</td></tr>
            <tr><td className="izq">Sobreviven</td><td>{pct(n.conversion)}</td><td className="izq">tasa de conversión del Reverse Eng Model</td></tr>
          </tbody>
        </table>
      </div>
      <p className="nota">
        Para toda la cadena, la meta pediría que entraran <b>{fmt1.format(P.meta.entradaSemana)} sitios por semana</b> a
        la primera etapa. Es el plan de ensueño: supone que cada ticket se cumple en su SLA.
      </p>
    </>
  );
}

function PanelEntrada({ e }: { e: any }) {
  const ventana = e.serie.slice(-e.ventana).map((x: any) => x.semana);
  const ult4 = e.serie.slice(-4).map((x: any) => x.semana);
  return (
    <>
      <div className="tabla">
        <table>
          <thead><tr><th className="izq">Semana</th><th>Sitios</th><th className="izq" /></tr></thead>
          <tbody>
            {e.serie.map((x: any) => (
              <tr key={x.semana} className={ult4.includes(x.semana) ? 'marca' : undefined}>
                <td className="izq">{x.semana}</td>
                <td>{fmt.format(x.sitios)}</td>
                <td className="izq">
                  {ventana.includes(x.semana)
                    ? 'cuenta para el promedio' + (ult4.includes(x.semana) ? ' · últimas 4' : '')
                    : 'fuera de la ventana'}
                </td>
              </tr>
            ))}
            <tr className="marca">
              <td className="izq"><b>Promedio de las últimas {e.ventana}</b></td>
              <td><b>{fmt1.format(e.sitios)}</b></td>
              <td className="izq">es el «ritmo real»</td>
            </tr>
            <tr>
              <td className="izq">Promedio de las últimas 4</td>
              <td>{fmt1.format(e.prom4)}</td>
              <td className="izq">el valle: entró casi nada</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="nota">
        Cuenta los deals cuya fecha de entrada a <b>2.02</b> (<code>hs_v2_date_entered</code>) cae en cada
        semana. Medido el {e.medidoEl}.
      </p>
      {e.irregular ? (
        <p className="aviso">
          {notaLotes(e)} Por eso el «ritmo real» es el promedio de {e.ventana} semanas: una ventana de 4 cae
          entera en el valle y mediría solo el valle.
        </p>
      ) : null}
      <p className="fuente">Pendiente: validar esta serie contra las fotos diarias cuando haya suficiente historia.</p>
    </>
  );
}

function PanelInstalados({ i }: { i: any }) {
  return (
    <>
      <div className="tabla">
        <table>
          <tbody>
            <tr><td className="izq">Vinieron de</td><td className="izq">{i.deEtiqueta || '—'}, la última etapa de la cadena</td></tr>
            <tr className="marca"><td className="izq"><b>Sitios</b></td><td><b>{fmt1.format(i.sitios)}</b></td></tr>
            <tr><td className="izq">kWp</td><td>{fmt.format(i.kwp)}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="nota">
        Son los que salen de la última etapa ya descontada su tasa de conversión. Es un pronóstico, no una
        fecha comprometida.
      </p>
    </>
  );
}

function PanelDelta({ g }: { g: any }) {
  const sig = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt1.format(Math.abs(n));
  return (
    <>
      <div className="tabla">
        <table>
          <thead><tr><th className="izq">Parte</th><th>{g.unidad}</th><th className="izq">Qué es</th></tr></thead>
          <tbody>
            <tr>
              <td className="izq">Brecha de plan</td><td>{sig(g.aportePlan)}</td>
              <td className="izq">Goal {fmt1.format(g.goal)} contra {fmt1.format(g.plan)} comprometidos: faltan sitios con fecha de instalación en el mes.</td>
            </tr>
            <tr>
              <td className="izq">Brecha de capacidad</td><td>{sig(g.aporteCapacidad)}</td>
              <td className="izq">De los comprometidos, {g.fuera.length} no entran en el forecast por fila y SLA.</td>
            </tr>
            <tr>
              <td className="izq"><b>Delta</b></td><td><b>{sig(g.delta)}</b></td>
              <td className="izq">Forecast {fmt1.format(g.forecast)} contra goal {fmt1.format(g.goal)}.</td>
            </tr>
          </tbody>
        </table>
      </div>
      {g.fuera.length ? (
        <>
          <h3 style={{ fontSize: 'var(--t-md)', margin: '12px 0 6px' }}>Los {g.fuera.length} que no entran</h3>
          <div className="tabla">
            <table>
              <thead><tr><th className="izq">Sitio</th><th>kWp</th><th>Instalación</th><th className="izq">Por qué no entra</th></tr></thead>
              <tbody>
                {g.fuera.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="izq"><HsDeal id={r.deal.deal_id} texto={r.deal.nombre || r.deal.deal_id} /></td>
                    <td>{fmt1.format(r.deal.kwp || 0)}</td>
                    <td>{r.deal.fecha_instalacion || '—'}</td>
                    <td className="izq">{r.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}

function PanelDesglose({ t, etiqueta }: { t: any; etiqueta: string }) {
  const p = t.porque || {};
  const n1 = (x: number) => fmt1.format(x);

  const paso = (x: any, i: number) => (
    <tr key={i} className={x === p.cuello ? 'marca' : undefined}>
      <td className="izq">{x.tipo}</td>
      <td className="izq">{x.equipo}</td>
      <td>{x.sinCapacidad ? '—' : n1(x.horas) + ' h'}</td>
      <td>{n1(x.esfuerzo)} h</td>
      <td>{n1(x.caben)}</td>
      <td className="izq">
        {x.sinCapacidad
          ? <span className="supuesto">sin capacidad modelada · avanza por SLA de {n1(x.dias)} d</span>
          : <span className="supuesto">{x.fuente}</span>}
        {x.quienes && x.quienes.ids.length
          ? <> · {x.quienes.ids.length} {x.quienes.ids.length === 1 ? 'persona' : 'personas'} <span className="supuesto">({x.quienes.fuente})</span></>
          : x.quienes ? <> <span className="supuesto">({x.quienes.fuente})</span></> : null}
      </td>
    </tr>
  );

  const motivo: ReactNode = p.modo === 'cola' ? (
    <>
      La etapa va al ritmo de su paso más lento: <b>{(p.cuello || {}).tipo || '—'}</b>, que deja pasar{' '}
      <b>{n1(p.caben)} sitios</b>.
      {p.topado ? ` Solo había ${n1(t.inicio + t.llegaron)}, así que salen todos.` : ''}
      <table className="pasos">
        <thead>
          <tr>
            <th className="izq">Paso</th><th className="izq">Equipo</th>
            <th>Horas</th><th>c/u</th><th>Caben</th><th className="izq">De dónde</th>
          </tr>
        </thead>
        <tbody>{(p.pasos || []).map(paso)}</tbody>
      </table>
    </>
  ) : p.modo === 'promesa' ? (
    <>Promesa del catálogo: {n1(p.dias)} días hábiles{p.sec && p.par ? ` (${n1(p.sec)} en secuencia + ${n1(p.par)} del paralelo más lento)` : ''}: sale <b>{pct(p.fraccion)}</b> por semana.</>
  ) : p.modo === 'sin-sla' ? (
    <span className="pd-mal">Sin SLA en el catálogo para {(p.tickets || []).join(', ')}: no se puede calcular la promesa.</span>
  ) : p.modo === 'proceso' ? (
    <>Según proceso, {n1(p.dias)} días hábiles{p.nota ? ` (${p.nota})` : ''}: en una semana de 5 días sale <b>{pct(p.fraccion)}</b> de lo que hay. <span className="supuesto">días del Reverse Eng Model</span></>
  ) : p.modo === 'sin-esfuerzo' ? (
    <span className="pd-mal">{p.ticket}: sin esfuerzo en el catálogo, sin cierres suficientes para medirlo y sin SLA. La etapa queda detenida.</span>
  ) : 'No había sitios en la etapa.';

  const fuentes: ReactNode = (t.deFuentes && t.deFuentes.length)
    ? (t.deFuentes.length === 1
      ? <>de {t.deFuentes[0].cod}, ya descontada su pérdida</>
      : <>de {t.deFuentes.map((f: any, i: number) => (
          <span key={f.cod}>{i ? ' + ' : ''}<b>{f.cod}</b> {n1(f.sitios)}</span>
        ))}, ya descontada la pérdida de cada una</>)
    : (t.deCod ? <>de {t.deCod}, ya descontada su pérdida</> : '—');

  return (
    <>
      <div className="tabla">
        <table>
          <tbody>
            <tr><td className="izq">Al empezar la semana</td><td>{n1(t.inicio)}</td><td className="izq">sitios en {etiqueta}</td></tr>
            <tr><td className="izq">+ Llegaron</td><td>{n1(t.llegaron)}</td><td className="izq">{fuentes}</td></tr>
            {t.nuevos ? (
              <tr><td className="izq">+ Entraron nuevos</td><td>{n1(t.nuevos)}</td><td className="izq">sitios que entran a la cadena esta semana</td></tr>
            ) : null}
            <tr><td className="izq">− Salieron</td><td>{n1(t.salieron)}</td><td className="izq">{motivo}</td></tr>
            <tr className="marca">
              <td className="izq"><b>Al terminar la semana</b></td>
              <td><b>{n1(t.fin)}</b></td>
              <td className="izq">{fmt.format(Math.round(t.kwpFin))} kWp</td>
            </tr>
          </tbody>
        </table>
      </div>
      {t.salieron > 0 && t.conversion < 1 ? (
        <p className="nota">
          De los {n1(t.salieron)} que salieron, <b>{n1(t.perdidos)} se pierden</b> en el camino: la tasa de
          conversión de esta etapa es {pct(t.conversion)}, del Reverse Eng Model. A la siguiente llegan{' '}
          {n1(t.salieron - t.perdidos)}.
        </p>
      ) : null}
    </>
  );
}
