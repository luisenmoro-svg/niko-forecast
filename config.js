// Configuración pública. La anon key de Supabase puede vivir aquí:
// la seguridad la dan el inicio de sesión y las políticas RLS del esquema.
// Mientras supabaseUrl tenga el valor de ejemplo, el dashboard muestra datos de ejemplo.
window.NIKO_CONFIG = {
  supabaseUrl: 'https://tzpmtacrwacxleddijng.supabase.co',
  supabaseAnonKey: 'sb_publishable_C17Hxs90K0Nci0l67Be1Ng_pEJ3luWD',
  dominioPermitido: 'niko.mx',
  hubspotPortalId: '43656105',
  metaPorDefecto: { sitios: 80, kwp: 1200 },
  horizonteDias: 10,          // días hábiles del pronóstico de capacidad
  // Etapas de post-instalación: se grafican aparte para que no aplasten la cadena.
  // Siguen contando en Real. Hoy: 2.21 Recently Installed y 2.23 O&M - Activo.
  etapasPostInstalacion: ['1109385340', '1109385341'],
};
