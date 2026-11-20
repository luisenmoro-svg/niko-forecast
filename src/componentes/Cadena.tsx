import { CFG } from '../../config.js';
import { useEstado } from '../estado';
import { Num } from '../ui/primitivos';
import { fmt, fmt1 } from '../lib/fechas.js';
import { nSitios, opU } from '../lib/vista';

// ---------------------------------------------------------------------------
// Dónde están hoy los sitios. Una fila por sección del pipeline; una etapa sin
// grupo cae en «Otras» y nunca desaparece. Las ocultas se esconden solo mientras
// estén vacías: con sitios o kWp reaparecen.
//
// Decisión cerrada (Paola): esta vista NO lleva barras ni escalas. Cada tarjeta
// muestra el cambio contra la foto T0 en sitios y kWp, sin color. No volver a
// proponerlas.
// ---------------------------------------------------------------------------

export function Cadena({ etapas, sem }: { etapas: any[]; sem: any[] }) {
  const { estado } = useEstado();
  const k = estado.unidad;

  const post = new Set((CFG as any).etapasPostInstalacion || []);
  const cadena = etapas.filter(e => !post.has(e.etapa_id));
  const fuera = etapas.filter(e => post.has(e.etapa_id));

  const grupos = ((CFG as any).gruposEtapas || []).map((g: any) => ({
    titulo: g.titulo,
    etapas: cadena.filter(e => (g.etapas || []).includes(e.etapa_id)),
  }));
  const asignadas = new Set(grupos.flatMap((g: any) => g.etapas.map((e: any) => e.etapa_id)));
  const ocultas = new Set((CFG as any).etapasOcultas || []);
  const sueltas = cadena.filter(
    e => !asignadas.has(e.etapa_id) && !(ocultas.has(e.etapa_id) && !e.sitios && !e.kwp),
  );
  if (sueltas.length) grupos.push({ titulo: 'Otras', etapas: sueltas });
  const filas = grupos.filter((g: any) => g.etapas.length);

  // Cambio contra la foto T0. Sin segunda foto o sin cambio, no se escribe nada.
  const base = sem && sem.length > 1 ? sem[0].porEtapa : null;
  const signo = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt.format(Math.abs(n));

  // Funciones, no componentes: definir un componente dentro del render crea un
  // tipo nuevo en cada pasada y React desmonta y vuelve a montar el subárbol.
  const desdeT0 = (e: any) => {
    if (!base) return null;
    const b = base[e.etapa_id] || { sitios: 0, kwp: 0 };
    const ds = e.sitios - b.sitios;
    const dk = e.kwp - b.kwp;
    if (!ds && !dk) return null;
    // Sin color: que una etapa baje suele querer decir que los sitios avanzaron,
    // no que algo esté mal. El rojo se reserva para errores.
    return (
      <div className="t0d">
        {signo(ds)} {Math.abs(ds) === 1 ? 'sitio' : 'sitios'} · {signo(dk)} kWp desde T0
      </div>
    );
  };

  const tarjeta = (e: any) => (
    <div
      key={e.etapa_id}
      className={`etapa ${e.es_instalado ? 'inst' : ''}`}
      title={`${e.etiqueta}: ${nSitios(e.sitios)}, ${fmt1.format(e.kwp)} kWp`}
    >
      <div className="e">{e.etiqueta}</div>
      <div className="v">
        <Num
          texto={k === 'sitios' ? String(e.sitios) : fmt.format(e.kwp)}
          titulo={`${e.etiqueta} · foto más reciente`}
          registros={e.ds}
          tipo="sitios"
          opciones={opU(e.ds, `en ${e.etiqueta}`, k)}
        />
      </div>
      <div className="k">{k === 'sitios' ? fmt.format(e.kwp) + ' kWp' : nSitios(e.sitios)}</div>
      {desdeT0(e)}
    </div>
  );

  return (
    <div className="cadena">
      {filas.map((g: any) => (
        <div className="grupo" key={g.titulo}>
          <div className="grupo-t">{g.titulo}</div>
          <div className="cadena-grid">
            {g.etapas.map(tarjeta)}
          </div>
        </div>
      ))}
      {fuera.length ? (
        <div className="fuera-flujo">
          <div className="grupo-t">Post-instalación</div>
          <p className="nota">Ya instalados. Cuentan en Real, no en la cadena.</p>
          <div className="cadena-grid">
            {fuera.map(tarjeta)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
