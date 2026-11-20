import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { CFG } from '../../config.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, DEMO } from './entorno';
import { usarCliente } from './datos.js';

// ---------------------------------------------------------------------------
// Cliente de Supabase y acceso con Google.
//
// La clave publishable es pública a propósito: la seguridad la dan el inicio de
// sesión y las políticas RLS por dominio del esquema. Aun así vive en una
// variable de entorno, no en el código.
// ---------------------------------------------------------------------------

export const sb: SupabaseClient | null = DEMO
  ? null
  : createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

if (sb) usarCliente(sb);

export const DOMINIO: string = (CFG as any).dominioPermitido || 'niko.mx';

export async function entrarConGoogle(): Promise<string | null> {
  if (!sb) return 'Sin configuración de Supabase.';
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + location.pathname,
      queryParams: { hd: DOMINIO, prompt: 'select_account' },
    },
  });
  return error ? error.message : null;
}

export async function salir() {
  if (sb) await sb.auth.signOut();
  location.reload();
}

/**
 * La sesión puede venir de cualquier cuenta de Google: RLS ya bloquea los datos.
 * Esto es para que la persona entienda por qué no ve nada.
 * Devuelve null si es válida, o el mensaje a mostrar si no lo es.
 */
export async function sesionValida(session: Session | null): Promise<string | null> {
  const correo = (session?.user?.email || '').toLowerCase();
  if (correo.endsWith('@' + DOMINIO)) return null;
  if (sb) await sb.auth.signOut();
  return correo
    ? `La cuenta ${correo} no es de @${DOMINIO}. Cerramos la sesión: entra con tu cuenta de Niko.`
    : `Esa cuenta no es de @${DOMINIO}. Entra con tu cuenta de Niko.`;
}
