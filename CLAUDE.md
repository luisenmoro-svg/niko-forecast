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
  toma la foto de HubSpot **dos veces al día** (7:17 y 13:17 CDMX; el minuto 17 evita que
  GitHub descarte el cron por caer en punto de hora) y la escribe en Supabase
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
   cifra desde los registros. **La comprobación de que el total cuadre aplica solo a
   conteos.** Un número derivado (mediana, promedio, porcentaje, horas, SLA, utilización,
   días) no se cuenta contra la lista: el panel explica cómo se calculó, ordena por el
   campo relevante y resalta el registro que lo marca. El panel de tickets muestra
   siempre las nueve columnas; el asunto se trunca con el texto completo en el title y
   **nunca se esconden las columnas de números**. Los números clicables llevan subrayado de puntos. Si una cifra no tiene lista
   detrás (Goal, Delta), no se vuelve clicable.

## Capacidad por pipeline

- **La demanda es del pipeline del ticket** (`tickets_snapshot.equipo`), no del equipo de
  la persona. Los equipos del dashboard son los pipelines de ticket.
- **La oferta se reparte** con los pesos de cada persona: `persona_equipos` manda; si no
  hay filas y `personas.equipo` trae «/», se reparte según la mezcla de pipelines de lo que
  la persona **trabajó** —sus abiertos de hoy más los que cerró en 28 días, para que cuente
  la revisión que le llega por reasignación en Under review— y queda marcado como
  **supuesto**; en cualquier otro caso, todo va a `personas.equipo`.
- Por eso «Design / Engineering» ya no aparece como equipo propio.
- **El Delta se descompone en dos partes que suman exactamente el delta**: brecha de plan
  (`plan − goal`, sitios que ni siquiera tienen fecha en el mes) y brecha de capacidad
  (`forecast − plan`, comprometidos que no entran por fila y SLA). Su panel lista los que
  no entran con su motivo y avisa en rojo si las partes no suman.
- `persona_equipos` ya existe en Supabase con su política RLS (18 nov 2026). El reparto de
  Juneth sigue pendiente de que Paola lo defina: mientras tanto cae en el caso automático.

## Pronóstico y simulador

- **El pronóstico modela la cadena como colas de capacidad**, no con tiempos por etapa.
  Un sitio sale de una etapa cuando se cierra su ticket, así que la salida semanal es
  lo que el equipo alcanza a cerrar (capacidad ÷ esfuerzo). Las etapas que no gobierna
  un ticket (lotes de 2.01, espera de cuadrilla en 2.14) usan los días del Reverse Eng
  Model, marcadas «según proceso». El mapeo vive en `config.js > ritmoEtapas`.
- **Los tiempos por etapa de HubSpot NO se usan y no deben usarse.** Se mueven por lotes:
  10 deals comparten exactamente 16.8 días en 2.01 y 6 de 25 pasaron 2.02 en segundos.
  Miden cuándo se actualizó HubSpot, no cuánto tardó el trabajo.
- **El esfuerzo calibrado manda sobre el del catálogo** donde existe
  (`config.js > esfuerzoCalibrado`), y la vista dice cuál usó.
- Si una cola no tiene esfuerzo en el catálogo, **no se inventa**: la etapa queda detenida
  en el pronóstico y se avisa en rojo.
- El pronóstico y los cuellos de botella salen de la **misma** función `pronostico()`.
- **Entra demanda nueva** con dos ritmos: el real (sitios que aparecen entre fotos, de las
  últimas 4) o el de la meta (los que harían falta despejando las conversiones). La
  sección de cuellos dice cuál está usando.
- **El pronóstico base se guarda a diario** en la tabla `pronosticos` desde el workflow,
  sin los controles del simulador. Cuando llega la foto real, la tabla de T0 muestra el
  pronóstico junto al dato.
- **Una sola implementación del modelo**: `modelo.js` en la raíz, que cargan tanto
  `index.html` (con `<script>`) como `scripts/sync-hubspot.mjs` (leyendo el archivo).
  No depende del navegador ni de Node. Verificado: con las mismas entradas, los dos
  entornos devuelven exactamente lo mismo.
- **Sin dos fotos separadas por 5 días no se puede medir el ritmo de entrada.** En ese
  caso el pronóstico lo dice en rojo y usa el ritmo de la meta; **nunca cero en silencio**.
- **Para calibrar esfuerzo y ritmo de entrada se usa `tickets_snapshot`**, no las fotos
  de Devin. El sync guarda los tickets abiertos más los cerrados en los últimos
  **120 días** (`CLOSED_LOOKBACK_DAYS`), ticket por ticket y con owner, tipo y fechas.
- **Las fotos de Devin no se importaron** (decisión de Luisen, 18 nov 2026): las cuatro que
  existen son del 13 al 18 de noviembre y su `tipos_30d` cubre casi la misma ventana de
  30 días, así que aportan menos que `tickets_snapshot`. Se dejan listos por si aparecen
  fotos de meses anteriores: la tabla `demanda_historica` en Supabase,
  `scripts/importar-devin.mjs` y `datos/demanda_historica.csv` (914 filas ya convertidas).
  Las fotos **no traen deals**, solo agregados por tipo de ticket.
- En `demanda_historica`, `pipeline` y `resolucion` son parte de la llave primaria y van
  con `''`, **nunca con `null`**: Postgres no acepta `coalesce` en una primary key y una
  columna nula no sirve como parte de la llave.
- **Cada número del pronóstico explica su cuenta**, igual que los reales. `modelo.js`
  guarda una `traza` por etapa y semana (inicio, llegaron, salieron con su porqué,
  perdidos por conversión, fin) y el panel la muestra. La regla: **lo que muestra el panel
  tiene que cuadrar exactamente con la celda**, así que el redondeo se hace en el modelo
  y las dos partes usan el mismo formato de un decimal.
- **Capacidad por persona, no por equipo.** Quién puede tomar cada tipo sale de
  `config.js > skills` (copiado del motor de Nikoengine) y, donde no hay, de quién cerró
  al menos `minCierresSkill` de ese tipo en 28 días. Cada persona reparte su semana entre
  sus filas en proporción al tamaño de cada una.
- **Producción y revisión son dos pasos.** En Diseño, Eder y Manuel producen
  (`esfuerzo_prod_h`) y Juneth revisa (`esfuerzo_rev_h`, `config.js > revisores`). No es
  contradicción con el motor: `NON_RECEIVERS` son reglas de reasignación del motor, y el
  workflow de HubSpot sí le asigna la revisión a Juneth.
- **Esfuerzo en tres niveles:** catálogo → medido con cierres reales (mínimo
  `minCierresEsfuerzo`) → SLA como último recurso. La procedencia se muestra siempre, y
  las etapas «según SLA» se listan aparte con el aviso de que **no pueden mostrar
  saturación**.
- **Cada etapa es una cadena de tickets** (`config.js > ritmoEtapas[].tickets`), con
  `orden: 'sec'` o `'par'` según el disparador de su workflow. La capacidad se limita por
  el paso más lento; el orden solo cambia la promesa (secuencial suma SLA, paralelo toma
  el mayor).
- **Un paso sin nadie modelado NO detiene la cadena**: avanza por su SLA (o por
  `diasRef`, los días del Reverse Eng Model) y queda marcado «sin capacidad modelada»,
  con el equipo que debería tomarlo. Si se detuviera, las etapas de más adelante nunca
  verían llegar sus olas y las alertas se quedarían ciegas. Esos pasos **no pueden
  mostrar saturación** hasta que sus equipos estén en `personas`.
- **Nada se detiene en silencio:** sin esfuerzo y sin SLA, la etapa se para y el aviso
  dice cuál y por qué.
- **«Dónde prepararse»** (primera sección de Capacidad) detecta olas: la semana en que más
  sitios llegan a una etapa cuyo paso más lento no alcanza a absorberlos. Cada alerta es
  una frase que se entiende sola, ordenadas por kWp que se quedan fuera, y dice
  explícitamente cuando una sola persona sostiene el paso. Sale del mismo `pronostico()`.
- **El desfase contra el mes comprometido es una aproximación**: supone que dentro de una
  etapa los sitios avanzan en orden de `fecha_instalacion` (los más urgentes primero) y
  que salen al ritmo que la etapa sostiene hoy. No considera lo que tarden las etapas
  siguientes. Está marcado así en su ⓘ.
- **La comparación contra T0 está pendiente** hasta que la tabla `pronosticos` acumule
  historia: hace falta un pronóstico guardado de hace semanas para contrastar cuánto
  cambió lo esperado. El workflow ya la escribe a diario.
- **El Company Goal se calcula hacia atrás** (`calcularMeta()` en `modelo.js`): desde las
  instalaciones que pide la meta se sube por la cadena dividiendo entre cada tasa de
  conversión, y los días de cada etapa salen del SLA de sus tickets (secuencial suma,
  paralelo toma el mayor). De ahí salen los sitios que debe haber parados en cada etapa,
  cuántos deben entrar por semana y las horas que el plan exige a cada equipo.
- La tabla de Flujo muestra **tres escenarios por etapa**: Real en las semanas pasadas,
  Goal y Forecast en las futuras, con la brecha Goal − Forecast al pie de cada celda.
  Arriba, una frase por cada brecha de 5 sitios o más.
- **2.01 no es parte de la cadena**: es el filtro de calidad de los listados
  (`config.js > filtroListados`). De cada 100 RPU cargados, 9 llegan a levantamiento.
  La cadena del pronóstico empieza en 2.02.
- **Las tasas de conversión medidas mandan donde el paso va en un solo sentido**
  (2.02, 2.03, 2.12, 2.14, marcadas `convFuente: 'medida'`). Las de 2.10 y 2.13 se
  quedaron en las del Reverse Eng Model porque medían **más de 100 %**: hay deals que
  entran a una etapa antes que a la anterior, o sea movimientos hacia atrás.
- **La salida de una etapa puede bifurcarse** (`ramas`): de 2.02, el 66 % va a 2.03 y el
  34 % directo a 2.10, con fracciones medidas.
- **El Goal usa la tasa de punta a punta medida**, no el producto de las conversiones por
  etapa: con bifurcaciones ese producto cuenta las pérdidas dos veces.
- **La tabla de Flujo compara volumen** (sitios que faltan en el pipeline), y **«Lo que
  pide la meta» compara capacidad** (horas). Son dos diagnósticos distintos y no deben
  mezclarse en el mismo número.
- El simulador cambia solo `ESTADO.sim`; nunca toca los datos.

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
