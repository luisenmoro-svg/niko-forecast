import { useEstado } from '../estado';
import { Cifra, Num, NumPanel } from '../ui/primitivos';
import { fmt, MESES } from '../lib/fechas.js';
import { v, u, opU } from '../lib/vista';

// ---------------------------------------------------------------------------
// El bloque de arriba: Goal / Forecast / Real / Delta.
// Es lo único que queda siempre visible (regla 1 de Paola).
//
// Goal y Delta no se vuelven clicables como lista: Goal no tiene registros
// detrás, y el Delta es una brecha que se descompone en sus dos partes.
// ---------------------------------------------------------------------------

export function Meta({ M }: { M: any }) {
  const { estado } = useEstado();
  const k = estado.unidad;
  const g = M.goal[k] || 1;
  const tope = Math.max(g, M.forecast[k], M.plan[k]) * 1.08;
  const delta = M.forecast[k] - M.goal[k];
  const [a, m] = estado.mes.split('-').map(Number);

  return (
    <section className="meta" aria-label="Meta del mes">
      <div className="meta-cifras">
        <Cifra
          clase="goal"
          n={v(M.goal, k)}
          l="Company Goal"
          s={`Lo prometido para ${MESES[m - 1]} ${a}`}
          mk="goal"
        />
        <Cifra
          clase="forecast"
          n={
            <Num
              texto={v(M.forecast, k)}
              titulo="Forecast del mes"
              registros={M.listas.forecast}
              tipo="sitios"
              opciones={opU(M.listas.forecast, 'que entran en el forecast', k)}
            />
          }
          l="Forecast"
          s={
            <>
              Lo que la capacidad actual alcanza a entregar, de{' '}
              <Num
                texto={v(M.plan, k)}
                titulo="Sitios comprometidos del mes"
                registros={M.listas.plan}
                tipo="sitios"
                opciones={opU(M.listas.plan, 'comprometidos', k)}
              />{' '}
              comprometidos
            </>
          }
          mk="fc"
        />
        <Cifra
          clase="real"
          n={
            <Num
              texto={v(M.real, k)}
              titulo="Real del mes"
              registros={M.listas.real}
              tipo="sitios"
              opciones={opU(M.listas.real, 'ya instalados', k)}
            />
          }
          l="Real"
          s={`${k === 'sitios' ? 'Sitios' : 'kWp'} que ya llegaron a instalación`}
          mk="re"
        />
        <Cifra
          clase={'delta ' + (delta < 0 ? 'neg' : 'pos')}
          n={
            <NumPanel
              carga={{
                titulo: 'Delta: de dónde sale la brecha',
                tipo: 'delta',
                registros: M.fuera,
                desglose: {
                  unidad: k === 'sitios' ? 'Sitios' : 'kWp',
                  goal: M.goal[k], plan: M.plan[k], forecast: M.forecast[k],
                  // Las dos partes suman el delta por construcción:
                  // (plan−goal) + (forecast−plan) = forecast−goal.
                  aportePlan: M.plan[k] - M.goal[k],
                  aporteCapacidad: M.forecast[k] - M.plan[k],
                  delta,
                  fuera: M.fuera,
                },
              }}
            >
              {(delta > 0 ? '+' : '') + fmt.format(delta)}
            </NumPanel>
          }
          l="Delta"
          s={`Forecast contra goal, en ${u(k)}`}
        />
      </div>

      <div
        className="barra"
        role="img"
        aria-label={`Real ${v(M.real, k)}, forecast ${v(M.forecast, k)} y goal ${v(M.goal, k)} ${u(k)}`}
      >
        <div className="fc" style={{ width: `${(M.forecast[k] / tope) * 100}%` }} />
        <div className="re" style={{ width: `${(M.real[k] / tope) * 100}%` }} />
        <div className="gl" style={{ left: `${(g / tope) * 100}%` }} />
      </div>
      <div className="barra-ejes">
        <span>0</span>
        <span>{fmt.format(tope)} {u(k, tope)}</span>
      </div>
    </section>
  );
}
