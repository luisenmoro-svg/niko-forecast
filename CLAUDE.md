# Contexto del proyecto

Dashboard de **flujo, SLA y capacidad** del Ticket System de Niko.

## Arquitectura

- **HTML estático** (`index.html`, un solo archivo) desplegado en **Vercel**, sin build.
- Lee de **Supabase** con `supabase-js` + **login con Google** (proveedor OAuth de
  Supabase). El dashboard manda `hd=niko.mx` y, al volver, cierra la sesión si el correo
  no es de `@niko.mx`; los datos ya los protege RLS por dominio. **No se usa SMTP**: se
  quitaron los enlaces de acceso por correo.
  **Ya configurado** (18 nov 2026): proveedor Google activo, redirect URI
  `https://tzpmtacrwacxleddijng.supabase.co/auth/v1/callback`, y la URL de Vercel en
  *Site URL* y *Redirect URLs*.
- Un workflow de **GitHub Actions** (`.github/workflows/sync.yml`, script `scripts/sync-hubspot.mjs`)
  toma la foto de HubSpot **dos veces al día** (7:00 y 13:00) y la escribe en Supabase
  con la service role key.
- `config.js` solo lleva datos públicos: URL de Supabase y **anon key**.

## Archivos clave

| Archivo | Para qué |
|---|---|
| `index.html` | Todo el dashboard: fórmulas, vistas y estilos |
| `config.js` | Configuración pública (URL + anon key, dominio, meta por defecto, `etapasPostInstalacion`) |
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
- `etapas_deal` tiene dos banderas manuales que el sync **no pisa** (su upsert solo manda
  `etapa_id`, `etiqueta`, `pipeline`, `orden`):
  - **`es_instalado`**: cuenta en Real. **Marcadas las 7** de Enterprise desde 2.15 en
    adelante (18 nov 2026): `1020225614` 2.15, `267654746` 2.17, `1187009283` 2.18,
    `1020326034` 2.19, `1020326036` 2.20, `1109385340` 2.21, `1109385341` 2.23.
    No existen 2.16 ni 2.22.
  - **`es_inactivo`**: no cuentan en la cadena, el T0, goal/forecast/real ni en
    capacidad; sus tickets abiertos salen listados en la pestaña de capacidad para
    cerrarlos. **Marcadas las 6** (verificado en Supabase, 18 nov 2026):
    Enterprise `958940487` 00.A Inviable, `268051860` 00.B Dormant,
    `1440290942` Churned deal; Sales SMBs `1398903637` Closed Lost,
    `1398903636` Dormant, `1431169623` Churn.
  - Un ticket sale de la capacidad solo si **todos** sus deals están en etapa inactiva:
    uno compartido con un deal vivo sigue contando.
- `config.js > gruposEtapas` parte la cadena en filas por sección del pipeline, cada una
  con su propia escala; una etapa que no esté en ningún grupo cae en «Otras» y nunca
  desaparece. `config.js > etapasPostInstalacion` lista las que van en la zona punteada
  «post-instalación», para que su histórico no aplaste la cadena.
- La tabla «Qué cambió desde T0» muestra **sitios y kWp lado a lado** y no depende del
  botón Sitios/kWp; ese botón solo afecta las cifras del mes y la cadena.
- **La cadena se deja en escala lineal a propósito.** 2.01 Análisis preliminar domina
  porque el embudo es así de desigual, y cada tarjeta lleva su número. No cambiar a
  escala raíz cuadrada ni similar: haría ver las etapas más parejas de lo que son.
- `segmento` debe ser **idéntico a la etiqueta** del pipeline de deal en HubSpot:
  el script escribe en `deals_snapshot.segmento` el label del pipeline
  (`dealPipeLabel[...]`), no un nombre corto. Los tres que se sincronizan son
  `2. Niko - Enterprise` (160230047), `Sales SMBs` (917378954) y
  `1.4 Niko - CS Installed Clients Pipeline` (71905038).

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
