import { Fragment } from 'react';
import { useEstado, simActivo } from '../estado';
import { Seccion } from '../ui/Seccion';
import { Info, Num, HsTicket, HsDeal } from '../ui/primitivos';
import { fmt, fmt1, pct, sum, isoDay } from '../lib/fechas.js';
import { pronostico, olas, fraseOla, txtRitmo } from '../lib/nucleo';
import { fuenteHubspot, fuenteManual, opHoras, opUtil } from '../lib/vista';

// ---------------------------------------------------------------------------
// Pestaña «Capacidad y saturación».
// ---------------------------------------------------------------------------

function Sparkline({ puntos }: { puntos: number[] }) {
  const w = 300, h = 44, max = Math.max(1, ...puntos);
  const x = (i: number) => (i / (puntos.length - 1)) * w;
  const y = (vv: number) => h - 4 - (vv / max) * (h - 10);
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join('');
  const subeOBaja = puntos[puntos.length - 1] > puntos[0] ? 'var(--hs-red)' : 'var(--hs-ink)';
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Horas en fila proyectadas: de ${fmt.format(puntos[0])} a ${fmt.format(puntos[puntos.length - 1])}`}
    >
      <line x1="0" x2={w} y1={h - 4} y2={h - 4} stroke="var(--hs-border)" />
      <path d={d} fill="none" stroke={subeOBaja} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function VistaCapacidad({ M, raw }: { M: any; raw: any }) {
  const { estado } = useEstado();
  const H = M.dias.length;
  const fuera = M.metricas.fuera.slice(0, 20);
  const fd = (x: number) => (x === Infinity ? 'No se vacía' : fmt1.format(x));
  const fH = fuenteHubspot(raw);
  const fPer = fuenteManual(raw.personas, 'personas y jornada');
  const fCat = fuenteManual(raw.catalogo, 'esfuerzo del catálogo');
  const sat = M.equipos.filter((e: any) => e.nivel === 'bad').length;
  const lim = M.equipos.filter((e: any) => e.nivel === 'warn').length;

  const P = pronostico(M, estado.sim);
  const O = olas(M, P);
  for (const o of O) {
    o.quienesNombres = o.quienes.map(
      (id: string) => (M.personas.find((p: any) => p.owner_id === id) || {}).nombre || id,
    );
  }

  const fraseCuello = (c: any) =>
    c.primeraSemana == null
      ? (c.util[0] != null && c.util[0] > 0.85
        ? 'al límite, no se satura en el horizonte'
        : `con espacio las ${P.semanas.length} semanas`)
      : c.primeraSemana === 1 ? 'saturado desde ya' : `se satura en ${c.primeraSemana}S`;
  const resumenCuellos = P.cuellos.filter((c: any) => c.primeraSemana != null).length;

  const filasMeta = Object.entries(P.meta.horasEquipo)
    .map(([eq, h]) => ({ eq, pide: h as number, hay: P.capSemana[eq] || 0 }))
    .sort((a, b) => (b.pide - b.hay) - (a.pide - a.hay));
  const faltanMeta = filasMeta.filter(f => f.pide > f.hay).length;
  const faltantes = filasMeta.filter(f => f.pide > f.hay);

  return (
    <>
      <Seccion
        id="saturacion"
        titulo="Saturación por equipo"
        defId="saturacion"
        resumen={sat
          ? `${sat} ${sat === 1 ? 'equipo saturado' : 'equipos saturados'}${lim ? ` · ${lim} al límite` : ''}`
          : lim ? `${lim} al límite` : 'ningún equipo saturado'}
        fuente={`${fH} · jornada: ${fPer} · ${fCat} · horizonte de ${H} días hábiles, hasta el ${isoDay(M.dias[H - 1])}`}
      >
        <div className="equipos">
          {M.equipos.map((e: any) => (
            <article className={`equipo ${e.nivel}`} key={e.nombre}>
              <h3>
                <span>{e.nombre}</span>
                <span className={`pill ${e.nivel}`}>
                  {e.sinDatos ? 'Sin esfuerzo definido'
                    : e.nivel === 'bad' ? 'Saturado'
                    : e.nivel === 'warn' ? 'Al límite' : 'Con espacio'}
                </span>
              </h3>
              <div className={`util ${e.nivel === 'bad' ? 'bad' : ''}`}>
                {e.sinDatos ? '—' : (
                  <Num
                    texto={pct(e.util)}
                    titulo={`Utilización · ${e.nombre}`}
                    registros={e.abiertos}
                    opciones={opUtil(e.abiertos, e.nombre, e.reqH, e.dispH)}
                  />
                )}
              </div>
              <div className="nota" style={{ margin: 0 }}>
                <Num
                  texto={fmt.format(e.reqH)}
                  titulo={`Horas requeridas · ${e.nombre}`}
                  registros={e.abiertos}
                  opciones={opHoras(e.abiertos, `abiertos de ${e.nombre}`)}
                />{' '}
                h requeridas de {fmt.format(e.dispH)} h disponibles ·{' '}
                <Num texto={String(e.backlogN)} titulo={`Abiertos · ${e.nombre}`} registros={e.abiertos} />{' '}
                abiertos
                {e.supuesto ? <> · <span className="supuesto">reparto supuesto</span></> : null}
              </div>
              <Sparkline puntos={e.proyeccion} />
              <div className="nota" style={{ margin: '2px 0 0' }}>
                {e.sinDatos ? 'Sin esfuerzo en el catálogo: no se puede proyectar'
                  : e.diaVacio > 0 ? `La fila se vacía el ${isoDay(M.dias[e.diaVacio - 1])}`
                  : e.backlogH === 0 ? 'Sin fila'
                  : `Quedan ${fmt.format(e.proyeccion[e.proyeccion.length - 1])} h en fila al final del horizonte`}
              </div>
              {e.alertas.length ? (
                <ul>{e.alertas.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              ) : null}
            </article>
          ))}
        </div>
        {M.sinPersona.length ? (
          <p className="aviso error">
            <Num
              texto={String(M.sinPersona.length)}
              titulo="Tickets con owner fuera de personas"
              registros={M.sinPersona}
            />{' '}
            tickets abiertos tienen un owner que no está en la tabla de personas, así que no cuentan en
            ninguna capacidad. <Info id="sinOwner" />
          </p>
        ) : null}
      </Seccion>

      {M.ticketsInactivos.length ? (
        <Seccion
          id="zombis"
          titulo="Tickets en deals inactivos"
          defId="ticketsInactivos"
          resumen={
            <>
              <Num
                texto={String(M.ticketsInactivos.length)}
                titulo="Tickets en deals inactivos"
                registros={M.ticketsInactivos}
              /> por cerrar
            </>
          }
          fuente={fH}
        >
          <div className="tabla">
            <table>
              <thead>
                <tr>
                  <th className="izq">Ticket</th><th className="izq">Tipo</th>
                  <th className="izq">Owner</th><th className="izq">Etapa del deal</th>
                </tr>
              </thead>
              <tbody>
                {M.ticketsInactivos.map((t: any) => (
                  <tr key={t.ticket_id}>
                    <td className="izq"><HsTicket id={t.ticket_id} texto={t.asunto || t.ticket_id} /></td>
                    <td className="izq">{t.tipo || '—'}</td>
                    <td className="izq">{t.persona ? t.persona.nombre : (t.owner_id || 'sin owner')}</td>
                    <td className="izq">{t.etapaDeal || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      ) : null}

      <Seccion
        id="prepararse"
        titulo="Dónde prepararse"
        defId="prepararse"
        resumen={O.length
          ? `${O.length} ${O.length === 1 ? 'ola' : 'olas'} · ${fmt.format(Math.round(sum(O, (o: any) => o.kwp)))} kWp en juego`
          : 'ninguna ola a la vista'}
        fuente={`Pronóstico preliminar · ${P.semanas.length} semanas${simActivo(estado) ? ' · con los cambios del simulador' : ''}`}
      >
        {O.length ? O.map((o: any, idx: number) => (
          <details className="cuello" key={idx}>
            <summary>{fraseOla(o)}</summary>
            <div className="tabla">
              <table>
                <thead>
                  <tr>
                    <th className="izq">Semana</th>
                    {P.semanas.map((_: any, i: number) => <th key={i}>{i + 1}S</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="izq">Llegan a {o.cod}</td>
                    {P.semanas.map((w: any, i: number) => {
                      const t = w.traza[o.etapaId];
                      return <td key={i}>{t ? fmt1.format(t.llegaron) : '—'}</td>;
                    })}
                  </tr>
                  <tr>
                    <td className="izq">Alcanza a sacar</td>
                    {P.semanas.map((w: any, i: number) => {
                      const t = w.traza[o.etapaId];
                      const c = t && t.porque && t.porque.cuello;
                      return <td key={i}>{c ? fmt1.format(c.caben) : '—'}</td>;
                    })}
                  </tr>
                  <tr>
                    <td className="izq">Se acumulan</td>
                    {P.semanas.map((w: any, i: number) => {
                      const t = w.traza[o.etapaId];
                      return <td key={i}>{t ? fmt1.format(t.fin) : '—'}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="nota">
              <b>Quién lo trabaja:</b>{' '}
              {o.sinCapacidad ? (
                <>nadie en la tabla de personas. Debería tomarlo {o.equipo}, y mientras tanto el pronóstico lo hace avanzar por su SLA.</>
              ) : (
                <>
                  {o.quienesNombres.join(', ')} <span className="supuesto">({o.quienFuente})</span>. El paso
                  que atora es «{o.paso}».
                </>
              )}
            </p>
            <p className="nota">
              <b>Sitios de la ola:</b> hoy hay {fmt.format(o.sitiosOrigen)} en {o.origenCod || '—'} que vienen en camino.
            </p>
            {o.desfase && o.desfase.length ? (
              <p className="nota">
                <b>Se salen de su mes:</b>{' '}
                <Num
                  texto={String(o.desfase.length)}
                  titulo={`Sitios que se salen de su mes · ${o.cod}`}
                  registros={o.desfase.map((d: any) => ({ ...d, etapaEtiqueta: o.etiqueta }))}
                  tipo="sitios"
                />{' '}
                sitios, {fmt.format(Math.round(o.desfaseKwp))} kWp. <Info id="desfase" />
              </p>
            ) : null}
          </details>
        )) : (
          <p className="nota">Con el ritmo de hoy, ninguna etapa recibe más sitios de los que alcanza a sacar.</p>
        )}
      </Seccion>

      <Seccion
        id="cuellos"
        titulo="Próximos cuellos de botella"
        defId="cuellos"
        resumen={resumenCuellos ? `${resumenCuellos} de ${P.cuellos.length} equipos se saturan` : 'ningún equipo se satura'}
        fuente={`Pronóstico preliminar · demanda de las colas contra la capacidad del equipo, ${P.semanas.length} semanas`}
      >
        {P.sinQuien && P.sinQuien.length ? (
          <p className="aviso">
            {P.sinQuien.length} pasos no tienen a nadie modelado que pueda tomarlos, así que avanzan{' '}
            <b>según su SLA</b> y están marcados «sin capacidad modelada»: {P.sinQuien.join(' · ')}. Esos
            pasos <b>no pueden mostrar saturación</b>: para que aparezcan, sus equipos tienen que estar en la
            tabla de personas.
          </p>
        ) : null}
        {P.porSla && P.porSla.length ? (
          <p className="aviso">
            {P.porSla.length} pasos usan el SLA como duración porque no hay esfuerzo ni cierres suficientes:{' '}
            {P.porSla.join(', ')}. <b>Esas etapas no pueden mostrar saturación</b>, porque el SLA mide tiempo
            prometido y no horas de trabajo.
          </p>
        ) : null}
        {P.modoEntrada === 'sin-historia' ? (
          <p className="aviso error">
            No hay dos fotos separadas por una semana, así que <b>no se puede medir el ritmo real de
            entrada</b>. El pronóstico usa el ritmo que haría falta para la meta ({fmt1.format(P.eMeta.sitios)}{' '}
            sitios por semana). No es el ritmo de hoy.
          </p>
        ) : null}
        <p className="fuente">
          {P.modoEntrada === 'meta' ? (
            <>Entran <b>{fmt1.format(P.eMeta.sitios)} sitios por semana</b>, los que harían falta para la meta
            de {fmt.format(M.metricas.goal.sitios)} al mes despejando las conversiones ({pct(P.eMeta.conv)}{' '}
            sobrevive la cadena).</>
          ) : P.eReal ? (
            <>Entran <b>{fmt1.format(P.eReal.sitios)} sitios por semana</b>: {txtRitmo(P.eReal, true)}.</>
          ) : 'Ritmo de entrada no medible: ver el aviso de arriba.'}
        </p>
        {P.sinEsfuerzo.length ? (
          <p className="aviso error">
            {P.sinEsfuerzo.length} colas no se pueden proyectar porque su ticket no tiene esfuerzo en el
            catálogo: {P.sinEsfuerzo.join(', ')}. Esas etapas quedan detenidas en el pronóstico.
          </p>
        ) : null}
        <p className="aviso">
          Pronóstico preliminar. El ritmo de cada etapa sale de la capacidad del equipo que cierra su ticket,
          o de los días del Reverse Eng Model. <b>No usa los tiempos por etapa de HubSpot</b>, que se mueven
          por lotes.
        </p>
        {P.cuellos.map((c: any) => (
          <details className="cuello" key={c.nombre}>
            <summary><b>{c.nombre}</b>: {fraseCuello(c)}</summary>
            <p className="nota">
              Capacidad {fmt.format(c.cap)} h por semana. Colas que compiten: {c.colas.join(', ')}.
            </p>
            <div className="tabla">
              <table>
                <thead>
                  <tr>
                    <th className="izq">Semana</th>
                    {c.dem.map((_: number, i: number) => <th key={i}>{i + 1}S</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="izq">Demanda (h)</td>
                    {c.dem.map((d: number, i: number) => <td key={i}>{fmt.format(d)}</td>)}
                  </tr>
                  <tr>
                    <td className="izq">Capacidad (h)</td>
                    {c.dem.map((_: number, i: number) => <td key={i}>{fmt.format(c.cap)}</td>)}
                  </tr>
                  <tr>
                    <td className="izq">Utilización</td>
                    {c.util.map((uu: number | null, i: number) => (
                      <td key={i}>
                        {uu == null ? '—' : (
                          <span className={`pill ${uu > 1 ? 'bad' : uu > 0.85 ? 'warn' : 'ok'}`}>{pct(uu)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="nota">
              Esfuerzo usado:{' '}
              {c.esfuerzo.map((e: any, i: number) => (
                <Fragment key={i}>
                  {i ? ' · ' : ''}{e.ticket} {e.h == null ? '— sin dato' : fmt1.format(e.h) + ' h'}{' '}
                  <span className="supuesto">({e.fuente})</span>
                </Fragment>
              ))}
            </p>
          </details>
        ))}
      </Seccion>

      <Seccion
        id="pideMeta"
        titulo="Lo que pide la meta"
        defId="pideMeta"
        resumen={faltanMeta ? `${faltanMeta} ${faltanMeta === 1 ? 'equipo no alcanza' : 'equipos no alcanzan'}` : 'todos alcanzan'}
        fuente={`Plan de ensueño · meta de ${fmt.format(P.metaMes)} sitios al mes · ${fmt1.format(P.meta.entradaSemana)} sitios deben entrar por semana`}
      >
        {faltantes.length ? (
          <div className="aviso">
            <b>Brecha de capacidad, en horas.</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {faltantes.slice(0, 5).map(f => (
                <li key={f.eq}>
                  Para la meta, <b>{f.eq}</b> necesita {fmt.format(f.pide)} h por semana y tiene {fmt.format(f.hay)}.
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="nota">Con la meta actual, todos los equipos alcanzan en horas.</p>
        )}
        <div className="tabla">
          <table>
            <thead>
              <tr>
                <th className="izq">Equipo</th><th>Pide la meta (h/sem)</th>
                <th>Tiene (h/sem)</th><th>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {filasMeta.map(f => (
                <tr key={f.eq}>
                  <td className="izq">{f.eq}</td>
                  <td>{fmt.format(f.pide)}</td>
                  <td>{fmt.format(f.hay)}</td>
                  <td>
                    <span className={`pill ${f.pide > f.hay ? 'bad' : 'ok'}`}>
                      {f.hay - f.pide > 0 ? '+' : '−'}{fmt.format(Math.abs(f.hay - f.pide))} h
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota">
          Horas por semana que exigiría instalar {fmt1.format(P.metaMes / 4.33)} sitios por semana, si cada
          ticket se cumple en su SLA y sobreviven las tasas del Reverse Eng Model.
        </p>
      </Seccion>

      <Seccion
        id="personas"
        titulo="Por persona"
        resumen={`${M.personas.length} personas · ${M.personas.filter((p: any) => p.util != null && p.util > 1).length} arriba del 100 %`}
        fuente={`${fH} · ${fPer} · ${fCat}`}
      >
        <div className="tabla">
          <table>
            <thead>
              <tr>
                <th>Persona</th><th className="izq">Equipo</th>
                <th>Foco <Info id="foco" /></th>
                <th>Ausencias (h) <Info id="ausencias" /></th>
                <th>Disponibles (h) <Info id="disponibles" /></th>
                <th>Requeridas (h) <Info id="requeridas" /></th>
                <th>Utilización <Info id="saturacion" /></th>
                <th>Abiertos <Info id="abiertos" /></th>
                <th>Le caben <Info id="leCaben" /></th>
                <th>Días de cola <Info id="diasCola" /></th>
                <th>Días para vaciar <Info id="diasVaciar" /></th>
              </tr>
            </thead>
            <tbody>
              {[...M.personas].sort((a: any, b: any) => (b.util ?? 0) - (a.util ?? 0)).map((p: any) => (
                <tr key={p.owner_id}>
                  <td>{p.nombre}</td>
                  <td className="izq">{p.equipo}</td>
                  <td>{pct(p.foco)}</td>
                  <td>{p.ausenciasH ? <span className="pill">{fmt.format(p.ausenciasH)} h fuera</span> : 0}</td>
                  <td>{fmt.format(p.dispH)}</td>
                  <td>
                    <Num
                      texto={fmt.format(p.reqH)}
                      titulo={`Horas requeridas · ${p.nombre}`}
                      registros={p.lAbiertos}
                      opciones={opHoras(p.lAbiertos, `abiertos de ${p.nombre}`)}
                    />
                  </td>
                  <td>
                    <span className={`pill ${p.util == null || (p.backlogN && p.sinEsfuerzo === p.backlogN) ? 'mute' : p.util > 1 ? 'bad' : p.util > 0.85 ? 'warn' : 'ok'}`}>
                      {p.backlogN && p.sinEsfuerzo === p.backlogN ? 'Sin esfuerzo' : (
                        <Num
                          texto={pct(p.util)}
                          titulo={`Utilización · ${p.nombre}`}
                          registros={p.lAbiertos}
                          opciones={opUtil(p.lAbiertos, p.nombre, p.reqH, p.dispH)}
                        />
                      )}
                    </span>
                  </td>
                  <td>
                    <Num texto={String(p.backlogN)} titulo={`Abiertos · ${p.nombre}`} registros={p.lAbiertos} />
                    {p.sinEsfuerzo ? <> <small>({p.sinEsfuerzo} sin esfuerzo)</small></> : null}
                  </td>
                  <td>{p.ticketsQueCaben ?? '—'}</td>
                  <td>{fd(p.colaDias)}</td>
                  <td>{fd(p.diasVaciar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion
        id="fuera"
        titulo="Sitios comprometidos que no entran en el forecast"
        defId="fueraForecast"
        resumen={fuera.length ? `${fuera.length} de ${M.metricas.fuera.length}` : 'todos entran'}
        fuente={fH}
      >
        {fuera.length ? (
          <div className="tabla">
            <table>
              <thead>
                <tr>
                  <th>Sitio</th><th>kWp</th><th>Instalación</th>
                  <th>Días hábiles restantes <Info id="diasRestantes" /></th>
                  <th className="izq">Por qué no entra <Info id="porQue" /></th>
                </tr>
              </thead>
              <tbody>
                {fuera.map((r: any, i: number) => (
                  <tr key={i}>
                    <td><HsDeal id={r.deal.deal_id} texto={r.deal.nombre} /></td>
                    <td>{fmt1.format(r.deal.kwp || 0)}</td>
                    <td>{r.deal.fecha_instalacion}</td>
                    <td>{r.diasRestantes}</td>
                    <td className="izq">{r.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="nota">Todos los sitios comprometidos del mes entran en el forecast.</p>
        )}
      </Seccion>
    </>
  );
}
