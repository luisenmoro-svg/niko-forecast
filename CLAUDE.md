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

## Reglas de trabajo

- **No cambiar las fórmulas del dashboard** ni el **orden de las propiedades de kWp**
  sin preguntar primero.
- **Nunca pedir ni manejar** el token de HubSpot ni la service role key.
  Esos van solo en los Secrets de GitHub Actions.
- La carpeta `datos/` tiene datos internos y **no se versiona** (ver `.gitignore`).
- Las filas del catálogo que no están en estado `firme` se muestran subrayadas con puntos:
  no deben leerse como dato firmado.
- Detenerse y preguntar antes de cualquier paso que no se pueda verificar.
