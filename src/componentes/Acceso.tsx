import { useState } from 'react';
import { DOMINIO, entrarConGoogle } from '../lib/supabase';

// Pantalla de acceso. Sin enlaces por correo: solo Google con el dominio de Niko.
export function Acceso({ mensaje, esError }: { mensaje?: string | null; esError?: boolean }) {
  const [estado, setEstado] = useState<{ txt: string; error: boolean }>({
    txt: mensaje || '', error: !!esError,
  });

  const entrar = async () => {
    setEstado({ txt: 'Abriendo Google…', error: false });
    const err = await entrarConGoogle();
    if (err) setEstado({ txt: err, error: true });
  };

  return (
    <div className="acceso">
      <h1>Ticket System: capacidad y flujo</h1>
      <p className="nota">Entra con tu cuenta de Google de @{DOMINIO}.</p>
      <button className="primario" type="button" onClick={entrar}>Entrar con Google</button>
      <p className={`estado${estado.error ? ' error' : ''}`}>{estado.txt}</p>
    </div>
  );
}

export function ErrorCarga({ mensaje }: { mensaje: string }) {
  return (
    <div className="acceso">
      <h1>No se pudieron cargar los datos</h1>
      <p className="estado error">{mensaje}</p>
    </div>
  );
}
