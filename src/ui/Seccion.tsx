import { useState, type ReactNode } from 'react';
import { Info } from './primitivos';
import { leerAbiertas, guardarAbiertas } from '../estado';
import type { DEF } from '../lib/definiciones';

// ---------------------------------------------------------------------------
// Sección colapsable. Regla de Paola: todo nace cerrado salvo Goal/Forecast/
// Real/Delta, cada encabezado cerrado lleva su línea de resumen con los números
// clave, y el estado se recuerda por persona en localStorage.
// El encabezado es un button con aria-expanded.
// ---------------------------------------------------------------------------

export function Seccion({
  id, titulo, defId, resumen, fuente, children,
}: {
  id: string;
  titulo: string;
  defId?: keyof typeof DEF | null;
  resumen?: ReactNode;
  fuente?: ReactNode;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(() => leerAbiertas().has(id));

  const alternar = () => {
    const s = leerAbiertas();
    if (s.has(id)) s.delete(id); else s.add(id);
    guardarAbiertas(s);
    setAbierta(s.has(id));
  };

  return (
    <section className="sec" data-sec={id}>
      <h2>
        <button
          className="sec-t"
          type="button"
          aria-expanded={abierta}
          aria-controls={`sec-${id}`}
          onClick={alternar}
        >
          <span className="chev" aria-hidden="true" />
          <span className="sec-n">{titulo}</span>
          {resumen ? <span className="sec-s">{resumen}</span> : null}
        </button>
        {defId ? <Info id={defId} /> : null}
      </h2>
      <div className="sec-c" id={`sec-${id}`} hidden={!abierta}>
        {fuente ? <p className="fuente">{fuente}</p> : null}
        {/* El contenido se monta aunque esté cerrado, como en el tablero anterior:
            así Ctrl+F encuentra lo que está plegado. */}
        {children}
      </div>
    </section>
  );
}
