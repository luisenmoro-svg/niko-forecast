import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ProveedorEstado } from './estado';
import { App, BotonSalir } from './App';
import './index.css';

// El encabezado global vive fuera del contenedor del tablero, igual que antes.
function Raiz() {
  return (
    <>
      <div className="global">
        <div className="global-in">
          <a className="marca" href="./">Niko<span>Ticket System</span></a>
          <div id="global-acciones"><BotonSalir /></div>
        </div>
      </div>
      <div className="wrap" id="app">
        <App />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProveedorEstado>
      <Raiz />
    </ProveedorEstado>
  </StrictMode>,
);
