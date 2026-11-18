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
  desaparece. `config.js > etapasOcultas` esconde una etapa **solo mientras esté vacía**:
  si algún día trae sitios o kWp, reaparece en «Otras». Hoy: `1036112433` (2.11
  Adecuaciones pre-inst), a petición de Paola. `config.js > etapasPostInstalacion` lista las que van en la zona punteada
  «post-instalación», para que su histórico no aplaste la cadena.
- La tabla «Qué cambió desde T0» muestra **sitios y kWp lado a lado** y no depende del
  botón Sitios/kWp; ese botón solo afecta las cifras del mes y la cadena.
- **La cadena ya no lleva barras** (Paola, 18 nov 2026). No había meta contra qué
  compararlas y cada fila tenía su propia escala, así que no se entendían. En su lugar
  cada tarjeta muestra el cambio contra la foto T0 en sitios y kWp; si no cambió o solo
  hay una foto, no se escribe nada. Sin color: que una etapa baje suele significar que
  los sitios avanzaron, y el rojo se reserva para errores. **No volver a proponer barras
  ni escalas** (ni lineal, ni raíz cuadrada) para esta vista.
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

## Reglas de presentación (Paola, 18 nov 2026) — permanentes

Aplican a toda vista nueva, no solo a las existentes.

1. **Todo colapsado.** Solo el bloque Goal/Forecast/Real/Delta queda siempre visible.
   Las demás secciones nacen cerradas y se abren con clic en su encabezado. Cada
   encabezado cerrado lleva una línea de resumen con sus números clave. El estado se
   recuerda por persona en `localStorage` (`niko.secciones`), siempre en try/catch.
   El encabezado es un `button` con `aria-expanded`.
2. **Cada métrica dice qué es.** Toda métrica, KPI y encabezado de columna lleva un ⓘ
   con su definición corta en `DEF` (index.html): qué es, cómo se calcula y qué incluye,
   en lenguaje simple. Funciona con cursor, teclado y toque. No volver a poner párrafos
   explicativos largos: esa información vive en el ⓘ.
3. **Fuente y actualización.** Cada sección dice de dónde salen sus datos y cuándo se
   actualizaron, en una línea pequeña (`.fuente`). HubSpot usa `snapshots.creado` en
   hora CDMX; catálogo, personas y metas usan su columna `actualizado_en`.
   **Ya en la base** (18 nov 2026): la columna existe en las tres tablas (verificado
   contra la API), con fecha de carga 2026-11-17 12:00 CDMX en `catalogo` y `personas`,
   y un trigger `set_actualizado_en` en las tres que la mueve en cada edición. `metas`
   no se rellenó a mano: sus filas traen el momento del `alter table` hasta que se
   editen.
4. **Todo lo de HubSpot es un vínculo.** Tickets a `record/0-5/{id}` y deals o sitios a
   `record/0-3/{id}`, portal de `config.js`, en pestaña nueva. Helpers `hsTicket()` y
   `hsDeal()`. Aplica a todas las tablas y listas.
5. **No desperdiciar espacio.** Densidad alta: márgenes chicos, tarjetas bajas, tablas
   compactas, controles en una sola fila cuando quepan.
6. **Todo número es clicable.** Cada número agregado abre un panel lateral con la lista
   exacta de registros que lo forman. Se construye con el helper `num(texto, título,
   registros, tipo, calc)`: el panel dice qué se ve y cuántos registros son, se ordena
   por columna, se cierra con Esc o con su botón y devuelve el foco. `calc` recalcula la
   cifra desde los registros; **si no coincide con el número clicado, el panel lo dice en
   rojo**. Los números clicables llevan subrayado de puntos. Si una cifra no tiene lista
   detrás (Goal, Delta), no se vuelve clicable.

## Capacidad por pipeline

- **La demanda es del pipeline del ticket** (`tickets_snapshot.equipo`), no del equipo de
  la persona. Los equipos del dashboard son los pipelines de ticket.
- **La oferta se reparte** con los pesos de cada persona: `persona_equipos` manda; si no
  hay filas y `personas.equipo` trae «/», se reparte según la mezcla de pipelines de sus
  tickets creados en los últimos 28 días y queda marcado como **supuesto**; en cualquier
  otro caso, todo va a `personas.equipo`.
- Por eso «Design / Engineering» ya no aparece como equipo propio.

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
