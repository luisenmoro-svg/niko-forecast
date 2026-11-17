# Niko · Guía de look & feel

> Referencia para replicar el estilo del manual **Negocios Pipeline**: interfaz clara, compacta y operativa, inspirada en HubSpot y con identidad Niko.
> Documento basado en la implementación actual y el último brief del manual. No cambia la aplicación ni define reglas comerciales.

## 1. Dirección visual

- **Sensación:** herramienta de trabajo, no página promocional.
- **Composición:** fondo claro, superficies blancas, bordes finos, texto oscuro y acentos amarillos puntuales.
- **Densidad:** alta pero legible. Priorizar comparación rápida, controles pequeños y explicaciones breves.
- **Jerarquía:** título corto → pestañas → controles → área de trabajo → detalle asociado.
- **Identidad:** negro para acciones principales del manual; amarillo para señalar actividad, selección y novedades.
- **Evitar:** fondos oscuros en páginas completas, degradados, decoración innecesaria, grandes espacios vacíos y tarjetas para cada sección.

## 2. Colores y tokens

### Identidad general Niko

| Rol | Referencia | Uso |
|---|---|---|
| Amarillo Starship | `#EDF045` | Acciones y acentos generales de la plataforma |
| Gris Gull Gray | `#96A3B5` | Apoyo visual y elementos secundarios |
| Amarillos complementarios | `#C5C900`, `#B5B800` | Variaciones de marca, no una paleta verde |

El color Olive `#7C8B00` existe en la configuración histórica; **no introducirlo como acento nuevo**. La pauta vigente de marca evita acentos verdes.

### Paleta del manual claro

Los HEX son referencias del brief. La implementación utiliza tokens HSL redondeados, por lo que puede haber pequeñas diferencias de color.

| Rol | HEX de referencia | Token CSS actual | Clase semántica |
|---|---|---|---|
| Fondo de página | `#F5F8FA` | `--hs-bg: 204 33% 97%` | `bg-hs-bg` |
| Tarjetas y paneles | `#FFFFFF` | `--hs-card: 0 0% 100%` | `bg-hs-card` |
| Bordes | `#DFE3EB` | `--hs-border: 220 24% 90%` | `border-hs-border` |
| Texto principal | `#111111` | `--hs-text: 0 0% 7%` | `text-hs-text` |
| Texto secundario | `#5F6B7A` | `--hs-muted: 213 12% 42%` | `text-hs-muted` |
| Negro de acciones | `#000000` | `--hs-ink: 0 0% 0%` | `bg-hs-ink` |
| Amarillo del manual | `#E6FF00` | `--hs-yellow: 67 100% 50%` | `bg-hs-yellow` |
| Error | `#D92D20` | `--hs-red: 4 74% 49%` | `text-hs-red` |
| Fondo de error | `#FEF3F2` | `--hs-red-bg: 5 86% 97%` | `bg-hs-red-bg` |

**Reglas de combinación**

- Amarillo de relleno + texto negro. Nunca texto amarillo sobre blanco.
- Botón principal del manual: fondo negro + texto blanco.
- Botón secundario: blanco + borde gris + texto oscuro.
- Rojo: únicamente errores, bloqueos o advertencias accionables; acompañarlo con texto e icono.
- Usar tokens, no colores HEX directamente dentro de componentes.
- El amarillo del manual es distinto del amarillo global: conservar esta diferencia cuando se replica el manual, no sustituir toda la marca.

**Excepción existente:** el manual actual usa verde para “Completado” y correcciones (`--hs-green: 153 90% 24%`, `--hs-green-bg: 145 81% 96%`; referencias del brief `#067647` / `#ECFDF3`). Esto difiere de la pauta general de no usar acentos verdes. No extenderlo a nuevas secciones; para ellas, representar éxito con un check, texto explícito y tonos neutros.

## 3. Tipografía

**Familia del manual:** Lexend, con respaldo `system-ui, sans-serif`.

| Elemento | Tamaño | Peso / tratamiento |
|---|---|---|
| Título principal actual | 28 px | 600; interlineado compacto |
| Título de etapa | 24 px | 600 |
| Título de diálogo | 20 px | Semibold |
| Texto principal | 15 px | Regular; interlineado 1.45 |
| Pestañas / títulos de panel | 15 px | Medium o semibold |
| Controles / etiquetas | 13 px | Regular o medium |
| Metadatos / texto de tickets | 12 px | Regular |
| Badges compactos | 10 px | Semibold |

- Mantener tamaños estables; no escalarlos proporcionalmente al ancho de pantalla.
- Evitar titulares sobredimensionados y párrafos largos.
- No aplicar espaciado negativo entre letras.
- La fuente del manual no implica cambiar la tipografía del encabezado global.
- La carga actual incluye pesos 300, 400 y 600. Si se requiere fidelidad en pesos 500/700 en una réplica independiente, cargarlos explícitamente.

## 4. Geometría, espacios y superficies

- **Ancho máximo del contenido:** 1400 px, centrado.
- **Margen interior lateral:** 16 px.
- **Espacio vertical inicial:** 24 px.
- **Separación de elementos densos:** 8 px.
- **Separación de paneles:** 12–16 px.
- **Interior de tarjeta pequeña:** 8–10 px.
- **Interior de panel:** 16–20 px.
- **Bordes:** 1 px; punteados para condiciones, espera y rutas alternativas.
- **Radio del manual actual:** 8 px en controles y tarjetas pequeñas; 12 px en paneles. Para nuevas tarjetas, preferir 8 px salvo que se esté replicando un panel existente de 12 px.
- **Pills:** reservar el redondeo completo para filtros, escenarios, selección de etapa y avatares.
- **Sombra:** muy suave, `0 1px 3px rgba(0,0,0,.08)`; sin elevaciones grandes.

Las secciones son áreas de página, no tarjetas flotantes. Los paneles enmarcados se justifican cuando son herramientas o fichas concretas.

## 5. Patrones que se deben repetir

### Encabezado global

Conservar el encabezado compartido: superficie blanca, borde inferior, posición fija al desplazarse, logo Niko y herramientas compactas. No crear un segundo encabezado decorativo.

### Pestañas principales

- Texto de 15 px, sin cajas de color alrededor.
- Pestaña activa: texto oscuro y subrayado negro de 2 px.
- Inactiva: texto secundario, que se oscurece al pasar el cursor.
- Línea gris continua debajo del grupo.

### Barra de controles

- Controles en una fila que pueda envolver en pantallas pequeñas.
- Escenarios en pills blancas con borde gris y texto de 13 px.
- Escenario de error con borde y texto rojo.
- Acción de reinicio negra, con icono y etiqueta.

### Tablero de etapas

- Columnas uniformes, separadas 8 px.
- Fondo claro y borde gris; altura mínima actual: 190 px.
- Nombre compacto, contador secundario y badge amarillo cuando aplica.
- Etapa actual: borde superior negro de 3 px.
- Destino durante el arrastre: relleno amarillo tenue.
- Rutas fuera del flujo: zonas más bajas con borde punteado.

### Tarjeta de negocio

- Blanca, borde gris, sombra suave y borde izquierdo amarillo de 4 px.
- Nombre en negrita; monto y metadatos secundarios.
- Avatar circular pequeño y etiqueta de producto.
- Cursor de agarre al arrastrar.
- Dimensiones estables para evitar saltos de distribución.

### Tickets y continuidad

- Tarjetas compactas de 190 px de ancho en el manual actual.
- Equipo en badge negro con texto blanco.
- Nombre destacado, canal y explicación corta debajo.
- Flechas grises entre tickets para mostrar orden.
- Nuevo: badge amarillo con texto negro.
- Pendiente o condicional: borde punteado y etiqueta explícita.
- Manual: tratamiento rojo punteado con la acción requerida.
- No asignar colores nuevos a cada equipo: el estilo actual usa badges negros uniformes.

### Diálogo de acción

- Superficie blanca, ancho máximo aproximado de 512 px.
- Título corto de 20 px.
- Avisos arriba; campos relevantes en el centro; vista previa al final.
- Etiqueta sobre cada control, opciones segmentadas debajo.
- Seleccionado: negro con texto blanco. No seleccionado: blanco con borde gris.
- “Cancelar” secundario y confirmación negra a la derecha.
- Deshabilitado: menor opacidad, sin interacción; no depender solo del color para explicar el bloqueo.

### Guía y errores

- Selección de etapa mediante pills; activa en amarillo con borde negro.
- Ficha de etapa: título y filas separadas por líneas finas.
- Filas con etiqueta secundaria a la izquierda y explicación a la derecha.
- Errores: tarjetas pequeñas con icono, situación, consecuencia y corrección.
- Reglas destacadas: bloques negros, texto blanco y número dentro de un círculo amarillo.

## 6. Adaptación a pantallas

| Área | Pequeña | Mediana | Grande |
|---|---|---|---|
| Tablero principal actual | 2 columnas | 4 desde 768 px | 8 desde 1280 px |
| Zonas fuera del flujo | 2 columnas | 4 desde 768 px | 4 columnas |
| Ficha + tickets | Apilados | Apilados | 240 px + área flexible desde 1024 px |
| Errores | 1 columna | 2 desde 640 px | 3 desde 1280 px |
| Filas de guía | Etiqueta sobre texto | 200 px + contenido desde 640 px | Igual |

- No introducir scroll horizontal visible en el tablero.
- En móvil, ofrecer selección “Mover a…” además de arrastre.
- Permitir que controles y cadenas se distribuyan en varias líneas.
- Evitar recortar nombres oficiales importantes; permitir salto de línea o mostrar el nombre completo de forma accesible.
- La implementación actual trunca algunos títulos del tablero: no convertir ese detalle en una regla obligatoria para nuevas vistas.

## 7. Movimiento, respuesta y accesibilidad

- Transiciones breves de color y aparición; referencia: 200 ms.
- Animación actual de entrada: opacidad 0 → 1 y desplazamiento vertical de 8 px → 0.
- No asumir que existe una animación lateral continua: actualmente la tarjeta reaparece en el destino.
- Respetar `prefers-reduced-motion` en nuevas implementaciones.
- Toda acción de arrastre debe tener alternativa de clic, selección o teclado.
- Mostrar foco visible en controles; añadir nombres accesibles a los iconos de acción.
- Estados comunicados mediante etiqueta, icono y/o borde, no únicamente color.
- Mantener contraste alto y texto que no se solape al cambiar de tamaño.

## 8. Aplicación técnica

Referencias actuales:

- `src/index.css`: tokens de color, familia `.hs-manual`, sombra `.hs-shadow` y animación `.tf-fade`.
- `tailwind.config.ts`: traducción de tokens a clases `hs-*` y colores globales Niko.
- `src/pages/ProcesoVentas.tsx`: patrones del manual.
- `src/components/AppHeader.tsx`: encabezado compartido.
- `src/components/ui/button.tsx`: componente de botón reutilizable.

Para nuevas vistas:

1. Reutilizar los tokens `hs-*` al replicar este manual; usar tokens globales en otras áreas de la plataforma.
2. Implementar controles con los componentes del sistema de diseño. Aunque la página actual contiene botones HTML directos, no copiarlos como pauta estructural.
3. Mantener colores, sombras y futuros estados visuales en tokens compartidos.
4. Separar el contenido y las reglas del proceso de su presentación.
5. Cargar fuentes mediante un enlace en el documento, no mediante una importación remota dentro del CSS.
6. No reutilizar el tema oscuro histórico `tf-*` como base del manual claro.

## 9. Checklist de réplica

- [ ] Fondo claro, superficies blancas y bordes discretos.
- [ ] Lexend y escala compacta de 12–15 px para la mayoría del contenido.
- [ ] Acciones principales negras dentro del manual.
- [ ] Amarillo solo como relleno con texto negro.
- [ ] Sin nuevos acentos verdes ni paletas por equipo inventadas.
- [ ] Pestañas con subrayado negro, no botones grandes.
- [ ] Radios y espacios consistentes; sombra casi imperceptible.
- [ ] Estado actual, pendiente, condicional y error distinguibles sin depender solo del color.
- [ ] Tablero sin scroll horizontal y con alternativa al arrastre.
- [ ] Nombres legibles y sin solapamientos en móvil.
- [ ] Encabezado global conservado.
- [ ] Sin degradados, fondos oscuros completos ni decoración ajena a la tarea.

## 10. Brief listo para reutilizar

> Replica el look & feel del manual Negocios Pipeline de Niko: interfaz de trabajo clara y compacta inspirada en HubSpot, con fondo gris muy claro, superficies blancas, bordes finos, texto casi negro y texto secundario gris. Usa Lexend, cuerpo de 15 px, controles de 13 px y títulos de 24–28 px. Dentro del manual, usa botones principales negros con texto blanco y amarillo de relleno con texto negro para selección y novedades. Mantén radios de 8 px en tarjetas pequeñas, hasta 12 px en paneles existentes, sombras mínimas y separaciones de 8–16 px. Usa pestañas con subrayado negro, badges compactos, flechas de continuidad y bordes punteados para condiciones o espera. Conserva el encabezado global, utiliza tokens semánticos y controles del sistema de diseño. Adapta las columnas sin scroll horizontal, ofrece alternativas al arrastre y respeta movimiento reducido. No introduzcas degradados, temas oscuros completos, acentos verdes nuevos ni colores arbitrarios por equipo. Replica el estilo, no inventes reglas ni contenido comercial.
