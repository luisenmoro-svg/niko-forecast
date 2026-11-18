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
  // Secciones del pipeline: cada una es una fila con su propia escala en la cadena.
  // Una etapa que no esté en ningún grupo cae en «Otras»: nunca desaparece.
  gruposEtapas: [
    { titulo: 'Análisis y factibilidad', etapas: ['1108691253', '268239144', '1021672592', '267654738'] },
    { titulo: 'Aprobación e ingeniería', etapas: ['1418018399', '1036112428'] },
    { titulo: 'Planeación',              etapas: ['1020227700', '267654734', '1036112429'] },
    { titulo: 'Instalación',             etapas: ['1020225614', '267654746', '1187009283', '1020326034', '1020326036'] },
  ],
  // Etapas que no se grafican mientras estén vacías. Si algún día traen sitios o kWp,
  // reaparecen en el grupo «Otras» para que no se pierdan.
  // 1036112433 = 2.11 Adecuaciones pre-inst (Paola, 18 nov 2026).
  etapasOcultas: ['1036112433'],
  // ---- Pronóstico: cómo sale un sitio de cada etapa ----
  // "cola": la salida la gobierna el cierre de un ticket, así que depende de la
  //         capacidad del equipo. "proceso": días del Reverse Eng Model v2.
  // conversion: fracción que sigue adelante (el resto muere en la etapa).
  ritmoEtapas: [
    { id: '1108691253', cod: '2.01', modo: 'proceso', dias: 9,  conversion: 0.80, nota: 'avanza por lotes del engine' },
    { id: '268239144',  cod: '2.02', modo: 'cola', ticket: 'Ejecución levantamiento', equipo: 'LiveOps',     conversion: 0.65 },
    { id: '1021672592', cod: '2.03', modo: 'cola', ticket: 'Diseño y adicionales finales', equipo: 'Design', conversion: 0.65 },
    { id: '267654738',  cod: '2.04', modo: 'proceso', dias: 5,  conversion: 0.80, nota: 'espera aprobación del cliente' },
    { id: '1418018399', cod: '2.09', modo: 'cola', ticket: 'Revisión de IX', equipo: 'IX',                   conversion: 0.85 },
    { id: '1036112428', cod: '2.10', modo: 'cola', ticket: 'Revisión de Ingenieria', equipo: 'Engineering',  conversion: 0.90 },
    { id: '1036112433', cod: '2.11', modo: 'proceso', dias: 3,  conversion: 0.90, nota: 'adecuaciones, si aplican' },
    { id: '1020227700', cod: '2.12', modo: 'cola', ticket: 'VoBo costo cotizado y OS', equipo: 'Quoting',    conversion: 1 },
    { id: '267654734',  cod: '2.13', modo: 'cola', ticket: 'Cierre de planeación', equipo: 'Planning',       conversion: 1 },
    { id: '1036112429', cod: '2.14', modo: 'proceso', dias: 2,  conversion: 1, nota: 'espera de cuadrilla' },
  ],
  // Esfuerzo calibrado contra cierres reales de 4 semanas. Donde no hay, manda el catálogo.
  esfuerzoCalibrado: {
    'Revisión de Ingenieria': 3.8,
    'Costeo final Overhaul': 0.9,
    'Revisión estructural': 9,
  },
  semanasPronostico: 10,   // 10 × 5 = 50 días hábiles, cubre los 48 pedidos
  // Etapas de post-instalación: se grafican aparte para que no aplasten la cadena.
  // Siguen contando en Real. Hoy: 2.21 Recently Installed y 2.23 O&M - Activo.
  etapasPostInstalacion: ['1109385340', '1109385341'],
};
