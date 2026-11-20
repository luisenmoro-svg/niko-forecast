# Ticket System: capacidad y flujo

Aplicación **React + Vite + TypeScript + Tailwind** que lee de Supabase. Un workflow de
GitHub Actions toma una foto de HubSpot dos veces al día y la guarda en Supabase.

```
HubSpot ──(GitHub Actions, 7:17 y 13:17)──▶ Supabase ◀──(supabase-js + login Google)── la app
                                              ▲
             catálogo, personas, ausencias, metas (Table Editor o importación del Tickets Manual)
```

Sin configurar, la página abre con datos de ejemplo para que se pueda revisar el diseño.

## Cómo correrlo

```bash
npm install
cp .env.example .env     # pon la URL y la clave publishable de Supabase
npm run dev
```

`npm run build` compila a `dist/`. `npm run typecheck` revisa los tipos.
`npm run modelo:check` compara el modelo contra su resultado de referencia.

### Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `VITE_SUPABASE_URL` | Lovable / Vercel / `.env` | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Lovable / Vercel / `.env` | Clave pública; la seguridad la dan el login y RLS |

Los secretos de GitHub Actions (`HUBSPOT_TOKEN`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`) son otra cosa y **solo** viven en el repo, nunca en el código.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `modelo.js` | Modelo de pronóstico. Única implementación: la usan la app y el sync |
| `config.js` | Parámetros del tablero, sin credenciales |
| `src/lib/*.js` | Núcleo de cálculo portado verbatim del tablero anterior (JS llano, a propósito) |
| `src/componentes/`, `src/ui/` | Vistas en React |
| `src/index.css` | Tokens `--hs-*` y clases de componente: el sistema visual de Niko |
| `scripts/` | Sincronización con HubSpot y referencia del modelo |
| `supabase/` | Esquema, RLS y datos iniciales |

**No se editan desde Lovable:** `modelo.js`, `config.js`, `scripts/` ni `supabase/`.
Un workflow guardián los vigila y abre un issue si el modelo cambia de resultado.
Las reglas para pegar en el Knowledge de Lovable están en `LOVABLE_KNOWLEDGE.md`.

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
3. En **Authentication > Providers**, activa **Google** y pega el Client ID y el Client
   Secret de un OAuth client de Google Cloud. En ese client, la *Authorized redirect URI*
   es `https://<proyecto>.supabase.co/auth/v1/callback`.

   El acceso es **solo con Google**: el dashboard manda `hd=niko.mx` para que Google
   proponga primero las cuentas del dominio, y al volver verifica el correo y cierra la
   sesión si no es de `@niko.mx`. **No hace falta configurar SMTP**, porque ya no se
   envían enlaces por correo.
4. Llena las tablas en el Table Editor (o importa un CSV exportado del Tickets Manual):
   - `catalogo`: desde Tickets Catalog. El `segmento` debe ser **idéntico a la etiqueta**
     del pipeline de deal en HubSpot, que es lo que el script guarda en
     `deals_snapshot.segmento`. Los tres pipelines que se sincronizan se llaman
     `2. Niko - Enterprise`, `Sales SMBs` y `1.4 Niko - CS Installed Clients Pipeline`.
   - `personas`: desde Teams. `owner_id` es el `hubspot_owner_id`.
   - `ausencias`: una fila por persona y día.
5. Después de la primera corrida del workflow, en `etapas_deal` marca `es_instalado = true` en la etapa de inicio de instalación (2.15).

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
| `DEAL_PIPELINE_IDS` | `160230047,917378954,71905038` (`2. Niko - Enterprise`, `Sales SMBs`, `1.4 Niko - CS Installed Clients Pipeline`) |

**`DEAL_KWP_PROPERTY` ya no se configura.** El script recorre una cascada fija de
propiedades de kWp y se queda con la primera que trae valor, de la más firme a la
más temprana:

1. `tamano_sistema_as_built_kwp_dc`
2. `tamano_de_sistema__kwp___final_`
3. `tamano_de_sistema__kwp__cotizacion`
4. `sunvoy___project_size_kwp__final___number_`
5. `tamano_de_sistema__kwp___preliminar_`

La propiedad de la que salió cada valor queda guardada en `deals_snapshot.kwp_fuente`.

> Si la variable `DEAL_KWP_PROPERTY` quedó definida de una instalación anterior,
> **bórrala**: el script todavía la respeta como anulación y, si existe, reemplaza
> la cascada completa por su valor.

Corre el workflow a mano una vez desde **Actions > Foto de HubSpot > Run workflow**.

La agenda es `17 13,19 * * 1-5` (7:17 y 13:17 CDMX, lunes a viernes). El minuto 17 es
a propósito: GitHub retrasa o descarta los crons que caen en punto de hora.

### 4. Vercel

1. Edita `config.js` con la URL y la **anon key** de Supabase.
2. En Vercel: *Add New > Project*, importa el repositorio, *Framework Preset: Other*, sin comando de build.
3. Cada push a `main` vuelve a desplegar.

## Pendientes conocidos

- **Ausencias automáticas:** la tabla ya distingue la fuente (`manual`, `factorial`, `calendar`). Falta el script que lea la API de Factorial o Google Calendar y escriba ahí.
- **Etapa «En espera (cliente/tercero)»:** cuando exista en HubSpot, hay que descontar ese tiempo de la edad del ticket usando el historial de `hs_pipeline_stage`.
- **Calidad del catálogo:** con SLA mezclados o esfuerzos «Por definir», la capacidad se ve más libre de lo que está. La página lo marca, pero no lo corrige.
- **Cadena completa:** el forecast solo considera los tickets abiertos de cada sitio, no los pasos que aún no se crean. Para eso hay que leer el SLA de cadena (T-installation) del Reverse Eng Model.
