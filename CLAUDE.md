# Contexto del proyecto

Dashboard de **flujo, SLA y capacidad** del Ticket System de Niko.

## Arquitectura

- **HTML estático** (`index.html`, un solo archivo) desplegado en **Vercel**, sin build.
- Lee de **Supabase** con `supabase-js` + login por correo `@niko.mx` (RLS por dominio).
- Un workflow de **GitHub Actions** (`.github/workflows/sync.yml`, script `scripts/sync-hubspot.mjs`)
  toma la foto de HubSpot **dos veces al día** (7:00 y 13:00) y la escribe en Supabase
  con la service role key.
- `config.js` solo lleva datos públicos: URL de Supabase y **anon key**.

## Archivos clave

| Archivo | Para qué |
|---|---|
| `index.html` | Todo el dashboard: fórmulas, vistas y estilos |
| `config.js` | Configuración pública (URL + anon key, dominio, meta por defecto) |
| `supabase/schema.sql` | Esquema completo + RLS + datos iniciales |
| `scripts/sync-hubspot.mjs` | Sincronización HubSpot → Supabase |
| `.github/workflows/sync.yml` | Agenda de la sincronización |
| `README.md` | Instalación, cálculos y pendientes conocidos |
| `Niko_Look_and_Feel.md` | Guía visual obligatoria para cualquier cambio de interfaz |

## Tablas

Editadas a mano (o importadas del Tickets Manual): `catalogo`, `personas`,
`ausencias`, `feriados`, `metas`, y `etapas_deal.es_instalado`.
Escritas por el script: `snapshots`, `deals_snapshot`, `tickets_snapshot`, `etapas_deal`.

- `catalogo`: una sola fila por **(tipo, segmento)** — restricción `unique`.
  `sla_dias` en días hábiles (**1 h = 0.125**, **1 día = 1**, jornada de 8 h).
  `estado` ∈ `firme` | `supuesto` | `por_definir`.
- `personas`: la llave primaria `owner_id` es el **`hubspot_owner_id`**.
- `segmento` debe coincidir con el nombre del pipeline de deal en HubSpot
  (por ejemplo «Enterprise» o «BD + SMBs»).

## Look & feel

Cualquier cambio visual **debe seguir `Niko_Look_and_Feel.md`**. En corto:

- **Tokens `--hs-*`**, nunca HEX sueltos dentro de los componentes
  (`--hs-bg`, `--hs-card`, `--hs-border`, `--hs-text`, `--hs-muted`,
  `--hs-ink`, `--hs-yellow`, `--hs-red`, `--hs-red-bg`).
- **Tipografía Lexend**, con respaldo `system-ui, sans-serif`. Tamaños estables,
  sin escalarlos al ancho de pantalla.
- **El amarillo solo como relleno, con texto negro.** Nunca texto amarillo sobre blanco.
  Botón principal: fondo negro con texto blanco.
- **Sin verdes.** El `--hs-green` que existe en el manual es una excepción heredada:
  no extenderlo a secciones nuevas. Para éxito, usar check, texto explícito y neutros.
- **Sin modo oscuro** ni fondos oscuros de página completa, degradados ni decoración.
- Rojo únicamente para errores o bloqueos accionables, acompañado de texto.

## Reglas de trabajo

- **No cambiar las fórmulas del dashboard** ni el **orden de las propiedades de kWp**
  sin preguntar primero. Ese orden vive en `KWP_PROPS` (`scripts/sync-hubspot.mjs`):
  cascada fija que empieza en `tamano_sistema_as_built_kwp_dc` y termina en
  `tamano_de_sistema__kwp___preliminar_`; se toma la primera con valor y se
  registra cuál fue en `deals_snapshot.kwp_fuente`.
- **`DEAL_KWP_PROPERTY` ya no se configura.** Sigue existiendo en el código como
  anulación, así que si está definida en GitHub reemplaza la cascada entera:
  debe quedar borrada.
- **Nunca pedir ni manejar** el token de HubSpot ni la service role key.
  Esos van solo en los Secrets de GitHub Actions.
- La carpeta `datos/` tiene datos internos y **no se versiona** (ver `.gitignore`).
- Las filas del catálogo que no están en estado `firme` se muestran subrayadas con puntos:
  no deben leerse como dato firmado.
- Detenerse y preguntar antes de cualquier paso que no se pueda verificar.
