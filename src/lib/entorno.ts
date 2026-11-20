// Credenciales de Supabase por variables de entorno. Nunca escritas en el código.
// En local: copia .env.example a .env. En Lovable: en los ajustes del proyecto.
// En Vercel: en Environment Variables.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Sin credenciales, el tablero arranca con datos de ejemplo en lugar de fallar. */
export const DEMO = !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || SUPABASE_URL.includes('TU-PROYECTO');
