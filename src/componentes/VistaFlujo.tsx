import { Fragment, type ReactNode } from 'react';
import { CFG } from '../../config.js';
import { useEstado, simActivo } from '../estado';
import { Seccion } from '../ui/Seccion';
import {
  Info, Num, NumPanel, HsTicket, PillSla, slaTxt, MarcaSupuesto,
} from '../ui/primitivos';
import { Cadena } from './Cadena';
import { fmt, fmt1, pct } from '../lib/fechas.js';
import { pronostico, txtRitmo, notaLotes } from '../lib/nucleo';
import { fuenteHubspot, fuenteManual, opHoras, opPct, opMediana } from '../lib/vista';

// ---------------------------------------------------------------------------
// Pestaña «Flujo y SLA».
// ---------------------------------------------------------------------------

/** Explicación general del pronóstico, en el ⓘ de cada semana futura. */
function InfoSemana({ P, sim }: { P: any; sim: boolean }) {
  const ritmo = P.modoEntrada === 'meta'
    ? `entran ${fmt1.format(P.eMeta.sitios)} sitios por semana, los que pediría la meta`
    : P.modoEntrada === 'sin-historia'
      ? 'no se puede medir el ritmo de entrada, se usa el de la meta'
      : `entran ${txtRitmo(P.eReal)}, el ritmo real medido`;
  const esc2 = sim
    ? ' Escenario del simulador: valores cambiados a mano.'
    : ' Escenario: datos reales, sin cambios del simulador.';
  return (
    <Info texto={`Pronóstico: parte de la semana anterior; cada etapa suelta los sitios que su equipo alcanza a cerrar (o los que marca el proceso), se aplican las pérdidas por etapa y se suman los sitios nuevos. Ritmo de entrada: ${ritmo}.${esc2} Clic en cualquier número para ver su cuenta.`} />
  );
}

/** Cada etapa dice de dónde sale su ritmo en el pronóstico. */
function RitmoInfo({ etapaId }: { etapaId: string }) {
  const r = ((CFG as any).ritmoEtapas || []).find((x: any) => x.id === etapaId);
  if (!r) return null;
  const t = r.modo === 'cola'
    ? `Ritmo: capacidad de ${r.equipo}. Sale cuando se cierra su ticket de «${r.ticket}», así que depende de cuántos alcance a cerrar el equipo esa semana.`
    : `Ritmo: según proceso, ${r.dias} días hábiles del Reverse Eng Model${r.nota ? ` (${r.nota})` : ''}. No lo gobierna ningún ticket.`;
  const conv = r.conversion != null && r.conversion < 1
    ? ` Solo el ${Math.round(r.conversion * 100)} % sigue adelante (${r.convFuente === 'medida' ? 'tasa medida con 12 meses de datos' : 'tasa del Reverse Eng Model'}).`
    : '';
  const ram = r.ramas && r.ramas.length > 1
    ? ` De los que salen, ${r.ramas.map((x: any) => `${Math.round(x.frac * 100)} %`).join(' y ')} se reparten entre las etapas siguientes, según lo medido.`
    : '';
  return <Info texto={t + conv + ram} />;
}

export function VistaFlujo({ M, raw }: { M: any; raw: any }) {
  const { estado } = useEstado();
  const R = M.resumen, L = M.lResumen;
  const sem = M.semanas;
  const P = pronostico(M, estado.sim);

  const guardados = raw.pronosGuardados || [];
  const prevision = (fecha: string, etapaId: string) =>
    guardados.find((g: any) => g.semana_fecha === fecha && g.etapa_id === etapaId) || null;

  const etapas = M.porEtapa;

  // Función, no componente: ver la nota en Cadena.tsx.
  const delta = (a: number, b: number) => {
    const d = a - b;
    if (d === 0) return null;
    return <span className="dif">{d > 0 ? '+' : '−'}{fmt.format(Math.abs(d))}</span>;
  };

  // La serie histórica solo guarda ids: el nombre se toma de la foto más reciente.
  const nombrePorDeal: Record<string, string> = {};
  for (const e of etapas) for (const d of (e.ds || [])) nombrePorDeal[d.deal_id] = d.nombre;
  const sitiosDe = (s: any, e: any) =>
    (s.filas || []).filter((r: any) => r.etapa_id === e.etapa_id).map((r: any) => ({
      deal_id: r.deal_id,
      nombre: nombrePorDeal[r.deal_id] || r.deal_id,
      kwp: r.kwp,
      etapaEtiqueta: e.etiqueta,
    }));

  const vencidos = M.abiertos
    .filter((t: any) => t.estadoSla === 'vencido')
    .sort((a: any, b: any) => (b.edad - b.sla) - (a.edad - a.sla))
    .slice(0, 25);

  const fH = fuenteHubspot(raw);
  const fCat = fuenteManual(raw.catalogo, 'catálogo de tickets');

  const esPost = (e: any) => ((CFG as any).etapasPostInstalacion || []).includes(e.etapa_id);
  const enCadena = etapas.filter((e: any) => !esPost(e));
  const enPost = etapas.filter(esPost);
  const tot = (ls: any[]) => ({
    s: ls.reduce((a, e) => a + e.sitios, 0),
    k: ls.reduce((a, e) => a + e.kwp, 0),
  });
  const tCadena = tot(enCadena), tPost = tot(enPost);

  const entranHoy = P.eReal ? P.eReal.sitios : null;
  const pide = P.meta.entradaSemana;
  const primera = ((CFG as any).ritmoEtapas || [])[0] || {};
  const filtro = (CFG as any).filtroListados || {};

  return (
    <>
      <div className="resumen">
        <div>
          <b><Num texto={fmt.format(R.abiertos)} titulo="Tickets abiertos" registros={L.abiertos} /></b>
          <span>tickets abiertos <Info id="abiertos" /></span>
        </div>
        <div>
          <b><Num texto={fmt.format(R.vencidos)} titulo="Tickets fuera de SLA" registros={L.vencidos} /></b>
          <span>fuera de SLA <Info id="vencidos" /></span>
        </div>
        <div>
          <b><Num texto={fmt.format(R.riesgo)} titulo="Tickets en riesgo" registros={L.riesgo} /></b>
          <span>en riesgo <Info id="riesgo" /></span>
        </div>
        <div>
          <b>
            <Num
              texto={pct(R.cumplimiento)}
              titulo="Cerrados en los últimos 28 días con SLA"
              registros={L.cerrados28}
              opciones={opPct(L.cerrados28, 'cerrados en 28 días')}
            />
          </b>
          <span>cerrados a tiempo <Info id="cumplimiento" /></span>
        </div>
        <div>
          <b>{fmt.format(R.sitiosT0)} · {fmt.format(R.kwpT0)}</b>
          <span>sitios y kWp en T0 <Info id="t0" /></span>
        </div>
      </div>

      <Seccion
        id="cadena"
        titulo="Dónde están hoy los sitios"
        defId="cadena"
        resumen={`en la cadena ${fmt.format(tCadena.s)} sitios · ${fmt.format(tCadena.k)} kWp`
          + (enPost.length ? ` · post-instalación ${fmt.format(tPost.s)} sitios · ${fmt.format(tPost.k)} kWp` : '')}
        fuente={fH}
      >
        <Cadena etapas={etapas} sem={sem} />
      </Seccion>

      <Seccion
        id="comoPron"
        titulo="Cómo se calcula el pronóstico"
        resumen={`${P.semanas.length} semanas · ${P.modoEntrada === 'real' ? 'ritmo real' : P.modoEntrada === 'meta' ? 'ritmo de la meta' : 'sin historia'}`}
        fuente="Pronóstico preliminar · no usa los tiempos por etapa de HubSpot"
      >
        <ol className="comoPron">
          <li>Se parte de la foto más reciente: los sitios que hay hoy en cada etapa.</li>
          <li>Cada semana, una etapa suelta los sitios que su equipo alcanza a cerrar: las horas que tiene entre lo que cuesta su ticket. Si dos filas compiten por el mismo equipo, se reparten sus horas.</li>
          <li>Las etapas que no dependen de un ticket (los lotes de 2.01, la espera de cuadrilla en 2.14) sueltan la parte que marcan los días del modelo de Paola.</li>
          <li>De los que salen, una parte se pierde: cada etapa tiene su tasa de conversión. El resto llega a la siguiente.</li>
          <li>Al final entran los sitios nuevos de la semana, y lo que sale de la última etapa son las instalaciones.</li>
        </ol>
        <p className="nota">
          <b>Ritmo de entrada:</b>{' '}
          {P.modoEntrada === 'meta'
            ? `${fmt1.format(P.eMeta.sitios)} sitios por semana, los que haría falta meter para la meta.`
            : P.modoEntrada === 'sin-historia'
              ? 'no medible todavía: hacen falta dos fotos separadas por una semana. Se usa el de la meta.'
              : `${txtRitmo(P.eReal, true)}.`}
        </p>
        <h3 style={{ fontSize: 'var(--t-md)', margin: '10px 0 4px' }}>Lo que el pronóstico supone</h3>
        <ul className="nota" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Qué ticket es el que manda en cada etapa.</li>
          <li>Que las etapas sin ticket tardan los días del Reverse Eng Model.</li>
          <li>Que las tasas de conversión del modelo son las reales (hoy dan {pct(P.eMeta.conv)} de punta a punta).</li>
          <li>Que dos filas que compiten por un equipo se reparten su tiempo por igual.</li>
          <li>Que el esfuerzo medido vale para adelante: sale de 4 semanas de cierres.</li>
          <li>Que no cambian ni el equipo ni el proceso durante las {P.semanas.length} semanas.</li>
        </ul>
        {P.sinEsfuerzo.length ? (
          <p className="aviso error">
            Estas filas no se pueden proyectar porque su ticket no tiene esfuerzo en el catálogo:{' '}
            {P.sinEsfuerzo.join(', ')}.
          </p>
        ) : null}
      </Seccion>

      <Seccion
        id="t0"
        titulo="Qué cambió desde T0"
        defId="desdeT0"
        resumen={`${sem.length} fotos · total ${fmt.format(sem[sem.length - 1]?.sitios || 0)} sitios${
          sem.length > 1
            ? ` (${(sem[sem.length - 1].sitios - sem[0].sitios) >= 0 ? '+' : '−'}${fmt.format(Math.abs(sem[sem.length - 1].sitios - sem[0].sitios))} desde T0)`
            : ''}`}
        fuente={fH}
      >
        {/* Esta tabla compara VOLUMEN: cuántos sitios hay contra cuántos pediría la
            meta. No es falta de capacidad: eso se ve en «Lo que pide la meta». */}
        <div className="aviso">
          <b>Brecha de entrada, no de capacidad.</b>
          Para la meta de {fmt.format(P.metaMes)} sitios al mes deben entrar{' '}
          <b>{fmt1.format(pide)} sitios viables por semana</b> a {primera.cod || ''}
          {entranHoy != null ? (
            <>
              ; hoy entran{' '}
              {P.eReal.fuente === 'hubspot' ? (
                <NumPanel carga={{ titulo: 'Ritmo de entrada a levantamiento', tipo: 'entrada', e: P.eReal }}>
                  <b>{fmt1.format(entranHoy)}</b>
                </NumPanel>
              ) : (
                <b>{fmt1.format(entranHoy)}</b>
              )}
            </>
          ) : '; el ritmo de hoy todavía no es medible'}
          . {entranHoy != null && entranHoy < pide ? `Faltan ${fmt1.format(pide - entranHoy)} por semana.` : ''}
          {entranHoy != null && P.eReal.fuente === 'hubspot' ? (
            <small>
              El ritmo real es el promedio de las últimas {P.eReal.ventana} semanas de entradas a 2.02 en
              HubSpot; en las últimas 4 entró casi nada ({fmt1.format(P.eReal.prom4)} por semana).{' '}
              {notaLotes(P.eReal)} Clic en el número para ver la serie.
            </small>
          ) : null}
          <small>
            Los sitios parados por etapa son contexto: dicen dónde está hoy el pipeline, no cuánta gente
            falta. Las horas que exige la meta están en «Lo que pide la meta», en la pestaña de capacidad.
          </small>
        </div>
        {filtro.cohorte ? (
          <p className="fuente">
            Filtro de listados ({filtro.cod}): de {fmt.format(filtro.cohorte.total)} RPU cargados hace 4 a 12
            meses, {fmt.format(filtro.cohorte.pasaron)} pasaron a levantamiento ({pct(filtro.tasa)}) y{' '}
            {fmt.format(filtro.cohorte.muertos)} se descartaron. Esa etapa no es parte de la cadena de
            instalación.
          </p>
        ) : null}

        <div className="tabla">
          <table className="t0">
            <thead>
              <tr>
                <th rowSpan={2}>Etapa</th>
                <th rowSpan={2}>Escenario</th>
                {sem.map((s: any) => (
                  <th colSpan={2} className="par" title={s.fecha} key={s.fecha}>
                    {s.etiqueta} <small>{s.fecha.slice(5)}</small>
                  </th>
                ))}
                {P.semanas.map((f: any) => (
                  <th colSpan={2} className="par fut" key={f.etiqueta}>
                    {f.etiqueta} <small>pronóstico</small>{' '}
                    <InfoSemana P={P} sim={simActivo(estado)} />
                  </th>
                ))}
              </tr>
              <tr>
                {sem.map((s: any) => (
                  <Fragment key={s.fecha}>
                    <th className="sub par">Sitios</th><th className="sub">kWp</th>
                  </Fragment>
                ))}
                {P.semanas.map((f: any) => (
                  <Fragment key={f.etiqueta}>
                    <th className="sub par fut">Sitios</th><th className="sub fut">kWp</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {etapas.map((e: any) => (
                <Fragment key={e.etapa_id}>
                  <tr className="esc-real">
                    <td rowSpan={3}>{e.etiqueta}<RitmoInfo etapaId={e.etapa_id} /></td>
                    <td className="esc">Real</td>
                    {sem.map((s: any, i: number) => {
                      const x = s.porEtapa[e.etapa_id] || { sitios: 0, kwp: 0 };
                      const x0 = sem[0].porEtapa[e.etapa_id] || { sitios: 0, kwp: 0 };
                      const ds = sitiosDe(s, e);
                      const pr = prevision(s.fecha, e.etapa_id);
                      return (
                        <Fragment key={s.fecha}>
                          <td className="par">
                            <Num
                              texto={fmt.format(x.sitios)}
                              titulo={`${e.etiqueta} · ${s.etiqueta} ${s.fecha}`}
                              registros={ds}
                              tipo="sitios"
                            />
                            {i ? delta(x.sitios, x0.sitios) : null}
                            {pr ? (
                              <span className="vspron" title={`Se había pronosticado ${fmt1.format(pr.sitios)}`}>
                                pron. {fmt1.format(pr.sitios)}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <Num
                              texto={fmt.format(x.kwp)}
                              titulo={`${e.etiqueta} · ${s.etiqueta} ${s.fecha} · kWp`}
                              registros={ds}
                              tipo="sitios"
                              opciones={{
                                explica: `Suma de kWp de ${fmt.format(ds.length)} sitios en ${e.etiqueta} el ${s.fecha}: ${fmt1.format(x.kwp)} kWp`,
                                ordenar: 'kwp',
                              }}
                            />
                            {i ? delta(x.kwp, x0.kwp) : null}
                          </td>
                        </Fragment>
                      );
                    })}
                    {P.semanas.map((f: any) => (
                      <Fragment key={f.etiqueta}>
                        <td className="par fut" /><td className="fut" />
                      </Fragment>
                    ))}
                  </tr>

                  <tr className="esc-goal">
                    <td className="esc">Goal</td>
                    {sem.map((s: any) => (
                      <Fragment key={s.fecha}><td className="par" /><td /></Fragment>
                    ))}
                    {P.meta.semanas.map((g: any) => {
                      const x = g.porEtapa[e.etapa_id] || { sitios: 0, kwp: 0 };
                      const n = P.meta.necesita.find((z: any) => z.id === e.etapa_id);
                      return (
                        <Fragment key={g.etiqueta}>
                          <td className="par fut">
                            {n ? (
                              <NumPanel
                                carga={{ titulo: `${e.etiqueta} · lo que pide la meta`, tipo: 'meta', n, P }}
                              >
                                {fmt1.format(x.sitios)}
                              </NumPanel>
                            ) : fmt1.format(x.sitios)}
                          </td>
                          <td className="fut">{fmt.format(x.kwp)}</td>
                        </Fragment>
                      );
                    })}
                  </tr>

                  <tr className="esc-fc">
                    <td className="esc">Forecast</td>
                    {sem.map((s: any) => (
                      <Fragment key={s.fecha}><td className="par" /><td /></Fragment>
                    ))}
                    {P.semanas.map((f: any, i: number) => {
                      const x = f.porEtapa[e.etapa_id] || { sitios: 0, kwp: 0 };
                      const t = f.traza && f.traza[e.etapa_id];
                      const g = (P.meta.semanas[i].porEtapa[e.etapa_id] || {}).sitios || 0;
                      const d = x.sitios - g;
                      return (
                        <Fragment key={f.etiqueta}>
                          <td className="par fut">
                            {t ? (
                              <NumPanel
                                carga={{
                                  titulo: `${e.etiqueta} · ${f.etiqueta} (pronóstico)`,
                                  tipo: 'desglose', traza: t, etapaEtiqueta: e.etiqueta,
                                }}
                              >
                                {fmt1.format(x.sitios)}
                              </NumPanel>
                            ) : fmt1.format(x.sitios)}
                            {Math.abs(d) >= 0.5 ? (
                              <span className={`brecha ${d < 0 ? 'neg' : ''}`}>
                                {d > 0 ? '+' : '−'}{fmt1.format(Math.abs(d))}
                              </span>
                            ) : null}
                          </td>
                          <td className="fut">{fmt.format(x.kwp)}</td>
                        </Fragment>
                      );
                    })}
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Llegan a instalación</td>
                {sem.map((s: any) => (<Fragment key={s.fecha}><td className="par" /><td /></Fragment>))}
                {P.semanas.map((f: any) => (
                  <Fragment key={f.etiqueta}>
                    <td className="par fut">
                      {f.instalados.sitios > 0 ? (
                        <NumPanel
                          carga={{ titulo: `Llegan a instalación · ${f.etiqueta}`, tipo: 'instalados', inst: f.instalados }}
                        >
                          {fmt1.format(f.instalados.sitios)}
                        </NumPanel>
                      ) : '0'}
                    </td>
                    <td className="fut">{fmt.format(f.instalados.kwp)}</td>
                  </Fragment>
                ))}
              </tr>
              <tr>
                <td colSpan={2}>Total</td>
                {sem.map((s: any, i: number) => (
                  <Fragment key={s.fecha}>
                    <td className="par">{fmt.format(s.sitios)}{i ? delta(s.sitios, sem[0].sitios) : null}</td>
                    <td>{fmt.format(s.kwp)}{i ? delta(s.kwp, sem[0].kwp) : null}</td>
                  </Fragment>
                ))}
                {P.semanas.map((f: any) => (
                  <Fragment key={f.etiqueta}>
                    <td className="par fut">{fmt1.format(f.sitios)}</td>
                    <td className="fut">{fmt.format(f.kwp)}</td>
                  </Fragment>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Seccion>

      <Seccion
        id="tipos"
        titulo="Volumen y SLA por tipo de ticket"
        resumen={`${M.porTipo.length} tipos · ${fmt.format(R.vencidos)} vencidos`}
        fuente={`${fH} · SLA y esfuerzo: ${fCat}`}
      >
        <div className="tabla">
          <table>
            <thead>
              <tr>
                <th>Tipo</th><th className="izq">Equipo</th>
                <th>SLA <Info id="sla" /></th>
                <th>Abiertos <Info id="abiertos" /></th>
                <th>Vencidos <Info id="vencidos" /></th>
                <th>En riesgo <Info id="riesgo" /></th>
                <th>Edad mediana <Info id="edadMediana" /></th>
                <th>Entraron 28 d <Info id="entraron28" /></th>
                <th>Salieron 28 d <Info id="salieron28" /></th>
                <th>A tiempo <Info id="aTiempo" /></th>
                <th>Horas en fila <Info id="horasFila" /></th>
              </tr>
            </thead>
            <tbody>
              {M.porTipo.map((r: any, i: number) => (
                <tr key={i}>
                  <td>{r.tipo || 'Sin tipo'}<br /><small>{r.segmento || 'sin segmento'}</small></td>
                  <td className="izq">{r.equipo || '—'}</td>
                  <td>
                    {r.sla == null
                      ? <span className="pill mute">Por definir</span>
                      : <MarcaSupuesto firme={r.firme}>{slaTxt(r.sla)}</MarcaSupuesto>}
                  </td>
                  <td><Num texto={String(r.abiertos)} titulo={`Abiertos · ${r.tipo}`} registros={r.lAbiertos} /></td>
                  <td>
                    {r.vencidos
                      ? <span className="pill bad"><Num texto={String(r.vencidos)} titulo={`Vencidos · ${r.tipo}`} registros={r.lVencidos} /></span>
                      : 0}
                  </td>
                  <td>
                    {r.riesgo
                      ? <span className="pill warn"><Num texto={String(r.riesgo)} titulo={`En riesgo · ${r.tipo}`} registros={r.lRiesgo} /></span>
                      : 0}
                  </td>
                  <td>
                    {r.edadMediana == null ? '—' : (
                      <Num
                        texto={fmt1.format(r.edadMediana)}
                        titulo={`Edad mediana · ${r.tipo}`}
                        registros={r.lAbiertos}
                        opciones={opMediana(r.lAbiertos, r.edadMediana)}
                      />
                    )}
                  </td>
                  <td><Num texto={String(r.creados28)} titulo={`Entraron en 28 días · ${r.tipo}`} registros={r.lCreados28} /></td>
                  <td><Num texto={String(r.cerrados28)} titulo={`Salieron en 28 días · ${r.tipo}`} registros={r.lCerrados28} /></td>
                  <td>
                    <Num
                      texto={pct(r.cumplimiento)}
                      titulo={`Cerrados con SLA · ${r.tipo}`}
                      registros={r.lConSla}
                      opciones={opPct(r.lConSla, `cerrados de ${r.tipo}`)}
                    />
                  </td>
                  <td>
                    <MarcaSupuesto firme={r.firme}>
                      <Num
                        texto={fmt1.format(r.horasBacklog)}
                        titulo={`Horas en fila · ${r.tipo}`}
                        registros={r.lAbiertos}
                        opciones={opHoras(r.lAbiertos, `abiertos de ${r.tipo}`)}
                      />
                    </MarcaSupuesto>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion
        id="atrasados"
        titulo="Tickets más atrasados"
        defId="atraso"
        resumen={vencidos.length ? `${vencidos.length} mostrados de ${fmt.format(R.vencidos)} vencidos` : 'ninguno fuera de SLA'}
        fuente={fH}
      >
        {vencidos.length ? (
          <div className="tabla">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th><th className="izq">Tipo</th><th className="izq">Owner</th>
                  <th className="izq">Etapa</th>
                  <th>Edad <Info id="edad" /></th>
                  <th>SLA <Info id="sla" /></th>
                  <th>Atraso <Info id="atraso" /></th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {vencidos.map((t: any) => (
                  <tr key={t.ticket_id}>
                    <td><HsTicket id={t.ticket_id} /><br /><small>{t.asunto || ''}</small></td>
                    <td className="izq">{t.tipo}</td>
                    <td className="izq">{t.persona?.nombre || t.owner_id || 'Sin owner'}</td>
                    <td className="izq">{t.etapa_ticket}</td>
                    <td>{t.edad} d</td>
                    <td>{slaTxt(t.sla)}</td>
                    <td>{fmt1.format(t.edad - t.sla)} d</td>
                    <td><PillSla t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="nota">No hay tickets fuera de SLA.</p>}
      </Seccion>
    </>
  );
}

export type { ReactNode };
