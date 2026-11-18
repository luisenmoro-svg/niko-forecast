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
  // Cada etapa lleva su cadena de tickets, con el modo que marcan los disparadores
  // de los workflows: 'sec' espera a que cierre el anterior, 'par' arranca junto con él.
  // El modo cambia la PROMESA (secuencial suma SLA, paralelo toma el mayor); la
  // capacidad se limita siempre por el ticket más lento de la etapa.
  ritmoEtapas: [
    { id: '1108691253', cod: '2.01', modo: 'proceso', dias: 9, conversion: 0.80, nota: 'avanza por lotes del engine' },
    { id: '268239144', cod: '2.02', modo: 'cola', conversion: 0.65, tickets: [
      { tipo: 'Planning levantamiento', equipo: 'Planning', orden: 'sec' },
      { tipo: 'Ejecución levantamiento', equipo: 'LiveOps', orden: 'sec' },
    ] },
    { id: '1021672592', cod: '2.03', modo: 'cola', conversion: 0.65, tickets: [
      { tipo: 'Diseño y adicionales finales', equipo: 'Design', orden: 'sec', revision: true },
      { tipo: 'Costeo final Overhaul', equipo: 'Quoting', orden: 'sec' },
    ] },
    { id: '267654738', cod: '2.04', modo: 'proceso', dias: 5, conversion: 0.80, nota: 'espera aprobación del cliente' },
    { id: '1418018399', cod: '2.09', modo: 'cola', conversion: 0.85, tickets: [
      { tipo: 'Revisión de IX', equipo: 'IX', orden: 'par' },
      { tipo: 'Disponibilidad', equipo: 'Procurement', orden: 'par' },
      { tipo: 'Creación de rutas de instalación', equipo: 'Product', orden: 'par' },
    ] },
    { id: '1036112428', cod: '2.10', modo: 'cola', conversion: 0.90, tickets: [
      { tipo: 'Revisión de Ingenieria', equipo: 'Engineering', orden: 'sec' },
      { tipo: 'IX Aprobación diagrama unifilar', equipo: 'IX', orden: 'par' },
      { tipo: 'Costeo final Overhaul', equipo: 'Quoting', orden: 'par' },
    ] },
    { id: '1036112433', cod: '2.11', modo: 'proceso', dias: 3, conversion: 0.90, nota: 'adecuaciones, si aplican' },
    { id: '1020227700', cod: '2.12', modo: 'cola', conversion: 1, tickets: [
      { tipo: 'VoBo Scoop RFP', equipo: 'Quoting', orden: 'par' },
      { tipo: 'Procurement Quote', equipo: 'Procurement', orden: 'par' },
      { tipo: 'IX Quote', equipo: 'IX', orden: 'par' },
      { tipo: 'VoBo costo cotizado y OS', equipo: 'Quoting', orden: 'sec' },
    ] },
    { id: '267654734', cod: '2.13', modo: 'cola', conversion: 1, tickets: [
      { tipo: 'Cierre de planeación', equipo: 'Planning', orden: 'sec' },
    ] },
    { id: '1036112429', cod: '2.14', modo: 'proceso', dias: 2, conversion: 1, nota: 'espera de cuadrilla' },
  ],
  // Quién puede tomar cada tipo, del SKILLS del motor de Nikoengine
  // (lib/utils/motorOrden/config.ts). Donde no hay, se infiere de quién lo cierra.
  skills: {
    'Revisión de Ingenieria': ['79373574', '79373572'],              // Hernán, Manuel
    'Ingeniería de detalle': ['79373574', '79373572'],
    'Revisión de ingeniería O&M': ['79373574', '79373572'],
    'Elaborar ODI': ['79373574'],
    'Revisión estructural': ['82168890'],                            // Axel
    'Render BESS': ['82168890'],
    'Diseño y adicionales finales': ['79373572', '88105904'],        // Manuel, Eder (producción)
    'Rediseño': ['79373572', '88105904'],
    'Diseños': ['79373572', '88105904'],
    'Diseño y adicionales preliminares': ['88105904'],
    'Carga y Prefactibilidad': ['88105904'],
  },
  // Quién revisa (Under review). En HubSpot el ticket de Diseño se reasigna aquí.
  revisores: { 'Diseño y adicionales finales': ['80811360'] },       // Juneth

  // Mínimos para inferir de los datos cuando falta información cargada.
  minCierresEsfuerzo: 10,   // cierres en 28 días para medir el esfuerzo de un tipo
  minCierresSkill: 3,       // cierres en 28 días para considerar que alguien puede tomarlo
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
