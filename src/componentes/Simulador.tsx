import { CFG } from '../../config.js';
import { useEstado } from '../estado';

// ---------------------------------------------------------------------------
// Simulador. Cambia SOLO estado.sim; nunca toca los datos.
// Mientras hay algo cambiado, la tira se marca y lo dice con una pastilla.
// ---------------------------------------------------------------------------

export function Simulador({ M }: { M: any }) {
  const { estado, setSim, resetSim } = useEstado();
  const sim = estado.sim;

  const equipos = [...new Set(
    ((CFG as any).ritmoEtapas || []).filter((r: any) => r.equipo).map((r: any) => r.equipo),
  )] as string[];

  return (
    <div className={`sim ${estado.simOn ? 'on' : ''}`} id="sim">
      <strong style={{ fontSize: 'var(--t-md)' }}>Simulador</strong>

      <label>
        Meta del mes
        <input
          type="number"
          min={0}
          step={5}
          style={{ width: 70 }}
          value={sim.meta ?? M.metricas.goal[estado.unidad]}
          onChange={e => setSim({ meta: Number(e.target.value) || null })}
        />
      </label>

      <label>
        Foco de todos
        <select value={sim.focoFactor} onChange={e => setSim({ focoFactor: Number(e.target.value) })}>
          {[0.5, 0.75, 1, 1.25, 1.5].map(f => (
            <option value={f} key={f}>{Math.round(f * 100)} %</option>
          ))}
        </select>
      </label>

      <label>
        Esfuerzo
        <select value={sim.multEsfuerzo} onChange={e => setSim({ multEsfuerzo: Number(e.target.value) })}>
          {[0.5, 0.75, 1, 1.5, 2].map(f => <option value={f} key={f}>×{f}</option>)}
        </select>
      </label>

      <label>
        +1 persona en
        <select
          value={Object.keys(sim.extraPersonas || {})[0] || ''}
          onChange={e => setSim({ extraPersonas: e.target.value ? { [e.target.value]: 1 } : {} })}
        >
          <option value="">—</option>
          {equipos.map(e => <option value={e} key={e}>{e}</option>)}
        </select>
      </label>

      <label>
        Días de 2.01
        <input
          type="number"
          min={1}
          step={1}
          style={{ width: 56 }}
          value={sim.diasEtapa['2.01'] ?? 9}
          onChange={e => setSim({ diasEtapa: { ...sim.diasEtapa, '2.01': Number(e.target.value) || 9 } })}
        />
      </label>

      <label>
        Entran sitios
        <select
          value={sim.entrada ?? 'real'}
          onChange={e => setSim({ entrada: e.target.value as 'real' | 'meta' })}
        >
          <option value="real">al ritmo real</option>
          <option value="meta">al ritmo de la meta</option>
        </select>
      </label>

      <button type="button" onClick={resetSim}>Volver a lo real</button>

      {estado.simOn ? (
        <span className="pill warn">Simulando: los datos reales no cambian</span>
      ) : null}
    </div>
  );
}
