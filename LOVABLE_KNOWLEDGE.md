# Niko · Ticket System — reglas del proyecto

Tablero de flujo, SLA y capacidad. Lee de Supabase; un workflow de GitHub Actions toma
la foto de HubSpot dos veces al día. Pega este texto en el Knowledge del proyecto.

---

## 1. Qué no se toca

**`modelo.js` es intocable.** Es el modelo de pronóstico: una sola implementación que
usan el tablero y el script de sincronización. No es un módulo de React, no se convierte
a TypeScript, no se "mejora" ni se divide. Si un número del pronóstico sale mal, el
problema se reporta; no se arregla editando este archivo.

Hay un **workflow guardián** que lo vigila: en cada push que toque `modelo.js`,
`config.js`, `scripts/` o `supabase/`, corre el modelo contra un resultado de referencia y,
si algún número cambió, abre un issue con el diff y el autor. No bloquea nada; avisa.

**`scripts/` y `supabase/` tampoco.** El script de sincronización habla con HubSpot y
escribe en Supabase con una llave que la app nunca ve. El esquema define la seguridad por
filas. Cambiarlos desde el tablero rompe la foto diaria o abre los datos.

**No cambiar ninguna fórmula.** Ni las del pronóstico, ni las de capacidad, ni las de
SLA, ni el orden de las propiedades de kWp. Si una cifra parece equivocada, se pregunta
antes de tocarla: casi siempre el dato de origen es el que hay que corregir, no el cálculo.

---

## 2. Los datos viven en Supabase, no en el código

SLA, esfuerzos por tipo de ticket, personas, ausencias, feriados y metas del mes **se
editan en las tablas de Supabase**, nunca escribiendo valores en los componentes.

| Qué | Dónde se edita |
|---|---|
| SLA y esfuerzo por tipo de ticket | tabla `catalogo` |
| Personas y su equipo | tabla `personas`, `persona_equipos` |
| Metas del mes | tabla `metas` |
| Ausencias y días feriados | tablas `ausencias`, `feriados` |
| Qué etapas cuentan como instaladas o inactivas | `etapas_deal.es_instalado`, `es_inactivo` |

Si hace falta un número nuevo que no está en ninguna tabla, se agrega la columna o la
tabla, no una constante en el código.

Las credenciales de Supabase van por **variables de entorno**, nunca escritas en el código
ni subidas al repo: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (ver
`.env.example`). Sin ellas el tablero arranca con datos de ejemplo, no falla.

---

## 3. Reglas de presentación (las pidió Paola; son permanentes)

Aplican a toda vista nueva, no solo a las que ya existen.

1. **Todo colapsado.** Solo el bloque Goal / Forecast / Real / Delta queda siempre
   visible. Las demás secciones nacen cerradas y se abren con clic en su encabezado.
   Cada encabezado cerrado lleva una línea de resumen con sus números clave. El
   encabezado es un `button` con `aria-expanded`, y el estado se recuerda por persona en
   `localStorage`, siempre dentro de try/catch.
2. **Cada métrica dice qué es.** Toda métrica, KPI y encabezado de columna lleva un ⓘ con
   su definición corta: qué es, cómo se calcula y qué incluye, en lenguaje simple.
   Funciona con cursor, teclado y toque. No se vuelven a poner párrafos explicativos
   largos: esa información vive en el ⓘ.
3. **Fuente y actualización.** Cada sección dice de dónde salen sus datos y cuándo se
   actualizaron, en una línea pequeña.
4. **Todo lo de HubSpot es un vínculo.** Tickets y deals enlazan a su registro en HubSpot,
   en pestaña nueva. Aplica a todas las tablas y listas.
5. **No desperdiciar espacio.** Densidad alta: márgenes chicos, tarjetas bajas, tablas
   compactas, controles en una sola fila cuando quepan. Densidad no es apretar: dentro de
   un grupo va junto, entre grupos va suelto, y la escala de tamaños se respeta.
6. **Todo número agregado es clicable** y abre un panel lateral con los registros que lo
   forman. El panel se ordena por columna, se cierra con Esc y devuelve el foco.

---

## 4. La regla que más importa: los números tienen que cuadrar

**Lo que muestra el panel tiene que cuadrar exactamente con la cifra en la que se hizo
clic.** Si la cifra dice 15.8, las partes del panel suman 15.8. El redondeo se hace una
sola vez, en el modelo, y la celda y el panel usan el mismo formato.

Dos matices:

- La comprobación de que el total cuadre **aplica solo a conteos**. Un número derivado
  (promedio, mediana, porcentaje, horas, SLA, utilización, días) no se cuenta contra la
  lista: el panel explica cómo se calculó y resalta el registro que lo marca.
- Si una cifra no tiene lista detrás (Goal, Delta), no se vuelve clicable.

Cuando el panel y la celda no cuadran, el panel lo dice en rojo. Ese aviso no se quita:
se arregla la causa.

---

## 5. Look & feel

Cualquier cambio visual **debe seguir `Niko_Look_and_Feel.md`**, que está en el repo. En
corto:

- **Tokens de color**, nunca HEX sueltos dentro de los componentes.
- **Tipografía Lexend**, con respaldo `system-ui, sans-serif`. Tamaños estables, sin
  escalarlos al ancho de pantalla.
- **El amarillo solo como relleno, con texto negro.** Nunca texto amarillo sobre blanco.
  Botón principal: fondo negro con texto blanco.
- **Sin verdes.** Para éxito, usar check, texto explícito y neutros.
- **Sin modo oscuro**, sin fondos oscuros de página completa, sin degradados ni decoración.
- **Rojo únicamente** para errores o bloqueos accionables, siempre acompañado de texto.
- Escala tipográfica de cinco pasos y espacio en múltiplos de 4. Prosa cortada a unos 74
  caracteres por renglón; los datos y las tablas no se cortan.

Decisión cerrada: **la cadena de etapas no lleva barras ni escalas.** Cada tarjeta muestra
el cambio contra la foto T0 en sitios y kWp, sin color. No volver a proponerlas.

---

## 6. Cosas que parecen buena idea y no lo son

- **Los tiempos por etapa de HubSpot no se usan.** Los deals se mueven por lotes: miden
  cuándo se actualizó HubSpot, no cuánto tardó el trabajo. El pronóstico modela la cadena
  como colas de capacidad.
- **Nada se detiene en silencio.** Si falta un esfuerzo, una tasa o una persona, la vista
  lo dice; nunca se muestra cero como si fuera un dato.
- **Ninguna fila se filtra fuera de una vista.** Lo que no encaja en una categoría va a
  «Otras» o a un estado explícito, nunca desaparece.
- **El simulador no toca los datos.** Cambia solo su propio estado, y la vista avisa
  cuando está activo.
- **El acceso es con Google, dominio `@niko.mx`.** Los datos los protege la seguridad por
  filas de Supabase; el login no es la única defensa y no se quita.

---

## 7. Antes de dar un cambio por bueno

- Los números de la pantalla cambiada siguen siendo los mismos que antes del cambio.
- Cada número clicable abre su panel y el panel cuadra.
- Se ve bien en teléfono y en escritorio, sin desbordes horizontales.
- No se agregaron colores, tamaños ni fuentes fuera de los tokens.
