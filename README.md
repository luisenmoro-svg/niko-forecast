# Ticket System: capacidad y flujo

Dashboard estático (un solo `index.html`) que lee de Supabase. Un workflow de GitHub Actions toma una foto de HubSpot dos veces al día y la guarda en Supabase; Vercel solo sirve la página.

```
HubSpot ──(GitHub Actions, 7:00 y 13:00)──▶ Supabase ◀──(supabase-js + login)── index.html en Vercel
                                              ▲
             catálogo, personas, ausencias, metas (Table Editor o importación del Tickets Manual)
```

Sin configurar, la página abre con datos de ejemplo para que se pueda revisar el diseño.

## Qué muestra

**Arriba:** Company Goal, Forecast, Real y Delta del mes, y los sitios y kWp por etapa del deal.

**Flujo y SLA (Paola):** evolución semanal por etapa desde T0 (1S, 2S…), volumen, vencidos, edad mediana y cumplimiento de SLA por tipo de ticket, y los tickets más atrasados.

**Capacidad y saturación (Edo):** utilización por equipo y por persona en los próximos 5 a 20 días hábiles, proyección diaria de la fila, alertas de saturación y los sitios comprometidos que no entran en el forecast con su motivo.

## Cálculos

- **Día hábil:** lunes a viernes, sin feriados de la tabla `feriados`, hora CDMX. 1 día = 8 h.
- **Edad del ticket:** días hábiles desde `createdate` hasta el cierre (o hoy).
- **Estado de SLA:** vencido si la edad supera el SLA; en riesgo desde el 80 %.
- **Horas disponibles por día:** FTE × % de foco × (jornada − horas de ausencia de ese día).
- **Horas requeridas:** fila abierta × esfuerzo del catálogo (esfuerzo de revisión si el ticket está en Under review; por sitio si la unidad es «sitio») + lo que entra al ritmo de los últimos 28 días.
- **Saturado:** requeridas > disponibles. **Al límite:** más de 85 % o varias alertas.
- **Forecast:** sitios con fecha de instalación en el mes que ya están instalados, más los que tienen tiempo suficiente: la cola más lenta de sus tickets abiertos (días de fila del owner + SLA restante) cabe en los días hábiles que faltan.
- **Real:** sitios del mes en la etapa marcada como `es_instalado`.

Los valores de filas del catálogo que no están en estado `firme` aparecen subrayados con puntos, para que nadie los lea como dato firmado.

## Instalación

### 1. GitHub

Crea un repositorio privado y sube esta carpeta tal cual (incluida `.github/workflows`).

### 2. Supabase

1. Crea un proyecto y ejecuta `supabase/schema.sql` completo en el SQL Editor.
2. En **Authentication > URL Configuration**, agrega la URL de Vercel (y `http://localhost:3000` si pruebas local) en *Site URL* y *Redirect URLs*.
3. Llena las tablas en el Table Editor (o importa un CSV exportado del Tickets Manual):
   - `catalogo`: desde Tickets Catalog. El `segmento` debe ser igual al nombre del pipeline de deal en HubSpot (por ejemplo «Enterprise» o «BD + SMBs»).
   - `personas`: desde Teams. `owner_id` es el `hubspot_owner_id`.
   - `ausencias`: una fila por persona y día.
4. Después de la primera corrida del workflow, en `etapas_deal` marca `es_instalado = true` en la etapa de inicio de instalación (2.15).

### 3. Secretos en GitHub

En **Settings > Secrets and variables > Actions**:

| Secreto | Valor |
|---|---|
| `HUBSPOT_TOKEN` | Token de una Private App de HubSpot con permisos de lectura de tickets, deals y pipelines |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (nunca va en `config.js`) |

Variables opcionales (pestaña *Variables*):

| Variable | Por defecto |
|---|---|
| `DEAL_KWP_PROPERTY` | `kwp` (nombre interno de la propiedad de kWp en el deal; confírmalo en HubSpot) |
| `DEAL_PIPELINE_IDS` | `160230047,917378954,71905038` (Enterprise, BD + SMBs, O&M) |

Corre el workflow a mano una vez desde **Actions > Foto de HubSpot > Run workflow**.

### 4. Vercel

1. Edita `config.js` con la URL y la **anon key** de Supabase.
2. En Vercel: *Add New > Project*, importa el repositorio, *Framework Preset: Other*, sin comando de build.
3. Cada push a `main` vuelve a desplegar.

## Pendientes conocidos

- **Ausencias automáticas:** la tabla ya distingue la fuente (`manual`, `factorial`, `calendar`). Falta el script que lea la API de Factorial o Google Calendar y escriba ahí.
- **Etapa «En espera (cliente/tercero)»:** cuando exista en HubSpot, hay que descontar ese tiempo de la edad del ticket usando el historial de `hs_pipeline_stage`.
- **Calidad del catálogo:** con SLA mezclados o esfuerzos «Por definir», la capacidad se ve más libre de lo que está. La página lo marca, pero no lo corrige.
- **Cadena completa:** el forecast solo considera los tickets abiertos de cada sitio, no los pasos que aún no se crean. Para eso hay que leer el SLA de cadena (T-installation) del Reverse Eng Model.
