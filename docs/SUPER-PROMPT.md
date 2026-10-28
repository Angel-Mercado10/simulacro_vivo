# Simulacro Vivo — Super prompt de especificación e implementación

> Documento rector entregado por Ángel Yael Mercado Velázquez el 26 oct 2026.
> Manda sobre cualquier suposición del agente; si contradice la documentación
> oficial de Meta, gana la documentación y el agente registra la discrepancia
> en `docs/DECISIONS.md`. Este archivo reproduce esa especificación.

Etiquetas de evidencia: **[DOC]** leído en dev.meta.ai el 26 oct 2026 ·
**[POR VERIFICAR]** investigación previa o incompleto · **[HIPÓTESIS]**
suposición que la Fase 0 debe confirmar o descartar · **[DECISIÓN]** elección
tomada aquí; cambiarla exige entrada en `docs/DECISIONS.md`. Todavía no existe
ningún hecho **[COMPROBADO]**: no se ha ejecutado ninguna llamada a la API.

Forma de delegar: una fase por sesión del agente. Cada sesión termina con el
reporte de la sección 15 y no avanza a la siguiente fase sin cumplir su compuerta.

## 0. Rol del agente y reglas de trabajo

El agente construye, prueba y entrega evidencia; no redefine el producto, no
inventa APIs y no declara terminado nada que no haya ejecutado.

1. Revisa antes de tocar: estructura, convenciones y pruebas del repositorio.
2. No inventes APIs ni parámetros. Fuente de verdad: dev.meta.ai y la sección 4.
   Lo que no esté ahí se sonda en `experiments/probes/` con aprobación y se
   registra en `docs/EVALUATION.md`.
3. Controla el gasto. Ninguna llamada real sin `MODEL_API_KEY` del humano y sin
   estimar el costo antes. Lote mayor a $1 USD requiere aprobación explícita.
   Nunca IDs de modelo terminados en `-contributor`.
4. Protege secretos: `.env` fuera del repositorio, `.env.example` sin valores,
   la llave nunca en logs, trazas ni errores.
5. Dependencias mínimas: solo las de la sección 5; cualquier otra exige entrada
   en `docs/DECISIONS.md` con motivo y alternativa descartada.
6. Pruebas obligatorias. Toda lógica determinista lleva pruebas. Todo schema
   JSON para Spark pasa la prueba de modo estricto. Nada terminado sin
   `pytest`/Vitest, pruebas del frontend y build.
7. Evidencia, no afirmaciones: cada tarea cierra con el reporte de la sección 15.
8. Alcance por prioridad: P0 antes que P1; P2 prohibido sin autorización. Si una
   fase se atrasa, se recorta alcance; nunca se extiende la jornada.
9. Honestidad del producto: nunca ocultar fallas del modelo; los estados
   degradados se muestran. El modo con respuestas grabadas se etiqueta en pantalla.
10. Trabajo original durante el hackathon; el README declara lo preexistente.
11. Idiomas: código, identificadores y commits en inglés; interfaz en español
    de México; documentación del proyecto en español.
12. Commits pequeños por slice con prefijos `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

## 1. Contexto del hackathon y restricciones

Meta Global AI Developer Hackathon 2026, categoría Indie Developer, desafío
Build for Your World. Cierre: **4 nov 2026, 20:00 Ciudad de México** (21:00 ET);
congelamiento de funcionalidades el 3 nov.

Entregables: repositorio público, producto funcional en URL HTTPS abrible desde
un teléfono, video de 3 minutos, identificación de lo construido durante el
hackathon y formulario oficial.

Rúbrica: Impacto 30 % (el ciclo completo funciona en una casa real), Uso de Meta
25 % (cada modelo es necesario; quitar cualquiera rompe una capacidad), Técnica
20 % (contratos estrictos, motor determinista probado, estados degradados, trazas
y control de costos), Demo 25 % (funciona en vivo en un teléfono; el modo
evidencia muestra qué propuso el modelo y qué decidió el motor).

Exclusiones: sin consejo médico ni de primeros auxilios; no es un "analizador
simple de imágenes" (el valor está en el ciclo cerrado); sin temas políticos.

Recursos: $150 USD de créditos de Meta Model API con acreditación aún no
confirmada; cualquier llamada puede generar un cargo real.

## 2. Producto: problema, usuario y límites

Simulacro Vivo convierte el Plan Familiar de Protección Civil en un juego dentro
de la propia casa: detecta riesgos no estructurales en fotos reales, pide
corregirlos, verifica la corrección y hace practicar el repliegue a una zona de
menor riesgo.

Evidencia: Petal (2004, Izmit 1999) atribuye 68 % de las lesiones no fatales a
elementos no estructurales; Baird et al. (NZSEE 2017) reportan 61 % de 1,048
lesiones en Nueva Zelanda. En México la base es normativa (CENAPRED): sujetar
muebles y objetos que puedan caer, ubicar zonas de menor riesgo lejos de vidrios
y de objetos que puedan caer, dibujar un croquis y practicar simulacros.
[POR VERIFICAR] Releer antes de citar en el pitch: Plan Familiar de Protección
Civil (CENAPRED) y Plan familiar en caso de sismo (gob.mx).

Usuario: familias de la zona metropolitana del Valle de México, sobre todo con
niños o adultos mayores. En la demo, el desarrollador en su casa.

Cuatro capacidades: escanear, corregir, verificar y practicar. Métrica primaria:
riesgos corregidos y verificados por hogar. Secundaria: acierto del simulacro y
tiempo entre intentos.

Lo que el producto NO es (visible en la interfaz, el código no puede contradecirlo):

- No evalúa seguridad estructural ni certifica instalaciones.
- No sustituye a Protección Civil, a un dictamen ni a un especialista.
- No da primeros auxilios ni consejo médico.
- No emite, simula ni imita alertas sísmicas oficiales (nombre, sonido o apariencia).
- No inventa recomendaciones: todo texto de acción sale del catálogo versionado
  con referencia a la fuente oficial. El modelo nunca redacta recomendaciones.

## 3. Ciclo de juego y mecánica adaptativa

Ciclo cerrado con la "regla del riesgo vivo": cada riesgo no corregido reaparece
como obstáculo en los simulacros. Es la mecánica central y lo que separa al
producto de un detector de objetos.

1. Configurar el hogar: cuartos (nombre y tipo) e integrantes (alias, rango de
   edad, necesidad de movilidad, cuarto donde duerme). P0 formulario; P1 voz.
   Datos mínimos, solo en el dispositivo.
2. Escanear un cuarto: 1 a 4 fotos. Spark propone riesgos del catálogo con caja
   y banderas; el motor valida; SAM dibuja la máscara. Máscaras numeradas;
   "no es un riesgo" descarta falsos positivos y alimenta la evaluación.
3. Misiones ordenadas por prioridad con "¿por qué va primero?" y la acción del
   catálogo con su fuente.
4. Verificar: foto de después con guía fantasma (antes al 30 %). Resultado:
   verificado con evidencia visual, autodeclarado o sin verificar. La máscara
   pasa de rojo a verde.
5. Zonas de menor riesgo: una por cuarto tocando la foto, con foto de referencia
   desde ahí. El motor rechaza zonas en cocina y junto a riesgos marcados.
6. Simulacro: nivel según progreso; escenario armado con riesgos reales abiertos.

| Nivel | Desbloqueo | Escenario | Evaluación |
| --- | --- | --- | --- |
| 1. Conoce tu zona | Existe al menos una zona | Empiezas en el cuarto de la zona | Llegar a la zona correcta |
| 2. Desde otro cuarto | Nivel 1 completo y 2 cuartos escaneados | Empiezas en otro cuarto | Zona correcta desde otra ubicación |
| 3. Ruta bloqueada | Riesgo abierto que bloquea paso o mueble alto, y 2 zonas | El riesgo no corregido "cayó" y bloquea tu zona habitual | Elegir la zona alterna |
| 4. De noche (P2) | Nivel 3 completo | Pantalla oscura y recordatorio de linterna | Igual que el nivel 3 |

Puntuación sin incentivo a correr [DECISIÓN]: zona correcta, ruta que evitó el
riesgo (autodeclarada) y tiempo comparado con tu mejor marca solo como
información, sin puntos. La pantalla muestra siempre "Camina, no corras".

Adaptación: riesgos abiertos como obstáculos; el perfil decide el cuarto de
inicio; niveles desbloqueados con el progreso; prioridad según a quién afecta
cada riesgo. Progreso visible: "Hogar preparado: X de Y riesgos atendidos" y
nivel alcanzado. Sin rachas, rankings ni notificaciones de retención.

## 4. Modelos de Meta: papel, contratos y costos

| Modelo | ID | Endpoint | Papel | Prioridad |
| --- | --- | --- | --- | --- |
| Muse Spark 1.3 | `muse-spark-1.3` | `POST /v1/chat/completions` | Detectar, verificar, comparar zonas, escenarios, perfil | P0 |
| SAM 3.1 | `sam-3.1` | `POST /v1/responses` (streaming) | Máscaras por cajas (hasta 16) y por concepto | P0 |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0` | `POST /v1/asr/transcribe` | Perfil del hogar por voz en español | P1 |

Base común [DOC]: `https://api.meta.ai/v1`, `Authorization: Bearer $MODEL_API_KEY`,
compatible con el SDK oficial de OpenAI. Límites por equipo, no por llave. Nunca
`muse-spark-1.3-contributor`: el contenido (fotos de interiores) se usaría para
entrenar modelos de Meta. No se usan Muse Image, Muse Wonder, Muse Glimmer ni
Muse Spark Open [DECISIÓN].

### 4.1 Muse Spark 1.3 [DOC]

- API elegida [DECISIÓN]: Chat Completions, un solo turno por llamada.
- Imágenes: `{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,..."}}`
  solo en mensajes `user`. Hasta 50 por request; JPEG/PNG/WebP; 50 MB en línea.
  Una imagen de ~1280 px cuesta 1,300-1,500 tokens de entrada; conteo exacto con
  `POST /v1/responses/input_tokens`.
- Salida estructurada: `response_format` con `json_schema` y `strict: true`.
  Con estricto: raíz objeto, `additionalProperties: false` en todo objeto,
  `required` con todas las llaves, `anyOf` solo bajo la raíz, sin `allOf` ni
  `oneOf`, sin recursión, profundidad máxima 10. El JSON llega como texto en
  `choices[0].message.content`.
- Razonamiento: `reasoning_effort` en la raíz (`minimal`, `low`, `medium`,
  `high`, `xhigh`, `max`; `none` devuelve 400). Los tokens de razonamiento se
  cobran como salida y cuentan contra `max_tokens` (inicial 4000). Inicial `low`;
  la Fase 0 compara `minimal`, `low` y `medium`.
- Coordenadas 0-1000, (0,0) arriba a la izquierda, relativas a la imagen exacta
  recibida; pueden salir ligeramente de rango y siempre se recortan. System
  prompt mínimo; la instrucción de localización va con la imagen en el mensaje
  del usuario, pidiendo explícitamente no omitir objetos.
- No soportado: `logprobs` (400).

### 4.2 SAM 3.1 [DOC]

- Request Responses API con `model: "sam-3.1"`, parte `input_text` y parte
  `input_image` (data URL). `stream: true` recomendado.
- Dos tipos de prompt, nunca mezclados: frase nominal corta (un concepto por
  request; listas con comas devuelven cero; negación y frases espaciales no
  fiables) o tokens de caja y punto. Mezclar devuelve 400.
- Tokens de caja: `<0f>1<|box;x1=444;y1=626;x2=675;y2=849;w=1800;h=1200|>` en
  píxeles tras rotación EXIF; `w` y `h` son el tamaño real de la imagen (otra
  relación de aspecto devuelve 400). Hasta 16 objetos por request; ids del
  cliente respetados en la respuesta.
- Estrategia [DECISIÓN]: una sola request por foto con todas las cajas de Spark
  (id = índice del riesgo); respaldo por concepto con `samPhrase` eligiendo la
  instancia con mayor IoU contra la caja de Spark. `samPhrase` en inglés hasta
  que la Fase 0 pruebe el español [POR VERIFICAR].
- Salida en `output_text` con tokens especiales; payload en base85 (`~` sin
  pérdida, `!` un bit; los prompts de caja siempre devuelven un bit). Cero
  coincidencias termina con salida vacía y es un resultado normal.
- Metadata `{"include_confidence": "true", "mask_encoding": "one_bit"}` (valores
  string). Con confianza, cada caja y máscara trae `c` entre 0 y 1.
- Parser oficial `@meta-sam/parser` >= 0.1.0 (ESM, Node ^20.17 o 22.9):
  `parseImageStream`, `recordsOfKind`, `decodeMaskToRaster`,
  `decodeMaskToSVGPath`, `decodeMaskToRLE`, `buildObjectPrompt`. En
  `buildObjectPrompt` las cajas son semiabiertas; el builder escribe
  `x2 = right - 1`.
- Errores: 400 permanente sin reintento; 404 `model_not_found` = el equipo no
  tiene acceso al modelo; dos ejecuciones iguales pueden variar en bordes.

### 4.3 Muse Voice Transcribe (P1) [DOC]

- `POST /v1/asr/transcribe` multipart: parte `request` en JSON
  (`{"mode":"PUSH_TO_TALK","model":"muse-voice-transcribe-1.0","audioEncoding":"WAV","languageBias":["Spanish"]}`)
  y parte `audio`. Solo WAV mono PCM16 a 16 o 24 kHz, hasta 10 min y 32 MB. El
  frontend convierte con `decodeAudioData` y `OfflineAudioContext` a 24 kHz mono.
- Respuesta con `transcript`. 429 con backoff. Español entre los 25 idiomas.
- Sin síntesis de Meta: la narración usa `speechSynthesis` del navegador.

### 4.4 Costos y límites

| Concepto | Precio [DOC] | Estimación por uso [HIPÓTESIS] |
| --- | --- | --- |
| Spark entrada | $1.25 / 1M tokens ($0.15 en caché) | ~2,700 tokens por foto: ~$0.0034 |
| Spark salida (incl. razonamiento) | $4.25 / 1M tokens | 3,000 tokens por foto: $0.013 |
| SAM 3.1 | $2.50 / 1,000 imágenes | $0.0025 por foto, más respaldos |
| Voice Transcribe | $0.18 / hora de audio | ~$0.002 por perfil dictado |

Un cuarto de 4 fotos cuesta como máximo ~$0.08; un hogar de demo (3 cuartos, 8
verificaciones, 5 simulacros) debería quedar por debajo de $0.50. La Fase 0
reemplaza estas cifras con mediciones. Límites: Spark 3,000 RPM y 4M TPM; SAM
3,000 RPM; Voice 256 streams. Ante 429: backoff exponencial con jitter (500 ms
inicial) respetando `Retry-After`; cabeceras `x-ratelimit-*` en las trazas.

### 4.5 Pendientes antes de depender de ellos

- [POR VERIFICAR] Acceso desde México y créditos acreditados (un 404
  `model_not_found` lo descarta).
- [HIPÓTESIS] Las cajas de Spark bastan para sembrar prompts de caja de SAM.
- [HIPÓTESIS] Latencia por foto de escaneo completo <= 8 s en la mediana.
- [POR VERIFICAR] Rendimiento de `samPhrase` en español frente a inglés.

## 5. Arquitectura, stack y estructura del repositorio

Monorepo TypeScript: backend sin estado que encapsula Meta y ejecuta el motor
determinista, y web móvil con el estado del hogar en el dispositivo. TypeScript
en ambos lados [DECISIÓN]: el parser oficial de SAM más completo es el de
TypeScript, los contratos se comparten con zod y una sola persona mantiene un
solo toolchain.

| Capa | Elección | Motivo |
| --- | --- | --- |
| Runtime | Node 22 LTS, TypeScript `strict` | Requisito de `@meta-sam/parser` |
| Monorepo | pnpm workspaces | `apps/web`, `apps/api`, `packages/contracts` |
| API HTTP | Fastify con `@fastify/multipart`, `@fastify/static`, `@fastify/rate-limit` | Subir fotos, servir la web, limitar abuso |
| Cliente Meta | `openai` con `baseURL` de Meta | Compatibilidad documentada |
| SAM | `@meta-sam/parser` >= 0.1.0 | Parser oficial |
| Imágenes | `sharp` | EXIF, redimensionado, metadatos, dimensiones |
| Contratos | zod 4 | Runtime y JSON Schema para Spark |
| Frontend | Vite, React 18, TypeScript | Ligero; overlays SVG |
| Estado cliente | IndexedDB con `idb-keyval` | Fotos y hogar solo en el dispositivo |
| Pruebas | Vitest | Un solo runner |
| Despliegue | Un servicio Node con HTTPS (Render, Railway o Fly.io) | La cámara exige HTTPS; timeout >= 60 s, cuerpo >= 10 MB |

Decisiones: (1) backend sin estado, sin base de datos, fotos nunca persistidas
en el servidor; (2) la llave nunca llega al navegador; (3) una sola base de
coordenadas: el backend normaliza con `sharp` (`rotate()`, lado largo 1280 px,
JPEG 80, sin metadatos), usa esos bytes para Spark y SAM y devuelve la imagen
normalizada con ancho y alto; (4) máscaras como paths SVG con
`decodeMaskToSVGPath` [POR VERIFICAR: raster local a la caja; si es así, el
frontend aplica `transform="translate(x1 y1)"`]; (5) evidencia en cada respuesta.

Estructura: `packages/contracts/src/` (`hazard-catalog.ts`, `domain.ts`,
`spark-schemas.ts`, `api-dto.ts`); `apps/api/src/` (`main.ts`, `config.ts`,
`shared/meta/`, `shared/imaging/`, `shared/evidence/`, `shared/budget/`,
`features/` por vertical slice: scan-room S1, plan-missions S2, verify-fix S3,
drills S4, household-profile S5 P1); `apps/api/tests/` (unit, contract,
fixtures, live opt-in); `apps/web/src/` (app, features household/scan/missions/
drills/profile/evidence, shared); `experiments/00-hazard-detection/`. Cada slice
depende solo de `shared/` y de `packages/contracts`; ninguna importa de otra.

## 6. Modelo de dominio y catálogo de riesgos

Entidad central `Hazard` (abierta a corregida; se convierte en misión y en
obstáculo). Tipos en `packages/contracts/src/domain.ts`: `RoomKind`
(bedroom, living, kitchen, bathroom, hallway, other), `AgeBand` (child, adult,
older_adult), `MobilityNeed` (independent, assisted, wheelchair), `HeightLevel`
(floor, mid, high), `HazardStatus` (open, fixed_visual_evidence,
fixed_self_reported, dismissed_by_user). `PixelBox` en píxeles de la imagen
normalizada con x2/y2 inclusivos. `Hazard` lleva tipo, `labelEs`, `samPhrase`,
caja, `maskPath`, `maskSource` (sam_box, sam_concept, none), banderas
(heightLevel, nearRestArea, blocksExitPath), `modelConfidence` autorreportada
(low, medium, high), `samConfidence` (0 a 1 o null), `evidenceEs` y estado.

Catálogo cerrado [DECISIÓN]: Spark solo puede proponer estos tipos; la
severidad base es heurística de producto, no dato científico (se declara en el
README).

| Tipo | Etiqueta | Sev. | Verificación | Bloquea ruta |
| --- | --- | --- | --- | --- |
| `TALL_FURNITURE_UNANCHORED` | Mueble alto sin fijar | 3 | Herraje visible (`anchor_hardware`) | Sí |
| `HEAVY_OBJECT_HIGH` | Objeto pesado en lo alto | 3 | Reubicación (`relocation`) | No |
| `GLASS_OVER_REST_AREA` | Vidrio/espejo/cuadro sobre cama o sillón | 3 | Retiro (`removal`) | No |
| `EXIT_PATH_BLOCKED` | Objetos que obstruyen puerta o pasillo | 3 | Ruta despejada (`path_clear`) | Sí |
| `GAS_CYLINDER_UNSECURED` | Cilindro de gas sin sujetar | 3 | Herraje visible | No |
| `HANGING_FIXTURE_OVER_REST_AREA` | Lámpara/ventilador sobre cama o sillón | 2 | Autodeclarada (`self_report`) | No |
| `REST_AREA_UNDER_WINDOW` | Cama/sillón junto a ventana grande | 2 | Autodeclarada | No |
| `BREAKABLES_OPEN_SHELF` | Frascos/vidrio en repisas abiertas sin tope | 1 | Reubicación | No |

Acciones: fijar al muro con herrajes; bajar a repisa inferior o sujetar;
reubicar lejos de zonas de descanso; despejar la ruta; sujetar con cadena y
saber cerrar la válvula; no elegir esa zona y revisar sujeción con un
especialista; reubicar el mueble o no usarlo como zona; poner topes o guardar
en gabinetes cerrados. Cada entrada lleva `examplePhrasesEn`, `actionEs`,
`sourceRef` y `canBlockPath`, con `catalogVersion` en la raíz. El `actionEs` se
redacta desde las guías del CENAPRED; sin respaldo oficial, `sourceRef: null`,
se muestra como "Recomendación general de prevención" y se reporta al humano.
Ningún texto de acción lo genera un modelo en runtime.

También: `Mission` (hazardId, priorityScore, reasons con ruleId/points/textEs),
`SafeZone` (punto sobre la foto), `DrillScenario` (level 1-4, startRoomId,
situation sleeping/resting/cooking/working, blockedHazardId, targetZoneId,
narrativeEs, source template/spark) y `DrillRecord` (elapsedMs, arrival
verified/not_matched/skipped, routeAvoidedHazard autodeclarado).

## 7. Contratos JSON y prompts de runtime para Spark

Cinco tareas, cada una con schema estricto y validador determinista posterior.
Schemas zod en `packages/contracts/src/spark-schemas.ts` convertidos a JSON
Schema; una prueba de contrato falla si alguno viola el subconjunto estricto.

Reglas comunes: límites de longitud y cantidad en el validador, no en el schema
(`maxItems`/`maxLength` no confirmados en estricto [POR VERIFICAR]); opcionales
como `anyOf: [{"type":"string"},{"type":"null"}]`, nunca llaves ausentes;
system prompt mínimo ("Return only JSON that matches the provided schema.") con
la instrucción junto a las imágenes; instrucciones en inglés y campos `*Es` en
español [DECISIÓN] (la Fase 0 puede comparar contra instrucciones en español).

### 7.1 Detección de riesgos (P0) — `HazardDetection`

Raíz: `imageQuality` (ok, too_dark, too_blurry, not_indoor_room) y `hazards[]`
con `type` (enum del catálogo), `labelEs`, `samPhrase`, `box`
(xMin, yMin, xMax, yMax enteros 0-1000), `heightLevel` (floor, mid, high),
`nearRestArea`, `blocksExitPath`, `confidence` (low, medium, high) y
`evidenceEs`, todo con `additionalProperties: false` y `required` completo.

Prompt del usuario (interpola `{roomKind}`): experto en localización de objetos
que ayuda a una familia de la Ciudad de México; reportar solo lo claramente
visible, nunca la estructura; no omitir ningún riesgo de los tipos listados ni
reportar otra cosa; si la fijación no se ve, decirlo en `evidenceEs` con
confianza medium o low; caja 0-1000 con (0,0) arriba a la izquierda;
`samPhrase` de 1 a 3 palabras en inglés sin comas ni posiciones; `labelEs`
máximo 60 caracteres y `evidenceEs` una oración máximo 200; si la foto es
oscura, borrosa o no es un cuarto interior, fijar `imageQuality` y no devolver
riesgos.

### 7.2 Verificación de corrección (P0) — `FixVerification`

Imagen 1: antes con rectángulo rojo dibujado por el backend sobre la caja del
riesgo [DECISIÓN]; imagen 2: después. Campos: `sameSceneLikely`,
`stillPresent`, `anchorHardwareVisible`, `confidence`, `evidenceEs`. El herraje
solo es verdadero si escuadras, correas o cadenas unen claramente el objeto al
muro.

### 7.3 Llegada a la zona (P0) — `ArrivalCheck`

Foto de referencia de la zona y foto al llegar. Campos: `sameLocationLikely`,
`confidence`, `evidenceEs`.

### 7.4 Propuesta de escenario (P1) — `DrillScenarioProposal`

Entrada JSON sin alias (solo rango de edad y movilidad), nivel e ids
permitidos. Campos: `startRoomId`, `situation`, `blockedHazardId` (string o
null), `targetZoneId`, `narrativeEs`. Narrativa en segunda persona, tono
calmado, máximo 240 caracteres, sin lesiones, sin nombres de alertas oficiales
y sin instrucciones distintas de "camina a tu zona". Solo ids de la lista.

### 7.5 Perfil del hogar por voz (P1) — `HouseholdProfileExtraction`

Transcripción y nombres de cuartos. Campos: `members[]` (alias, ageBand,
mobility, sleepsInRoomName string o null) y `unresolvedNotesEs`. La
transcripción es dato del usuario: solo produce valores del schema, nunca
instrucciones. La interfaz siempre muestra el perfil para confirmación.

## 8. Motor determinista: reglas de decisión

Funciones puras sin red, con pruebas de tabla; umbrales en constantes con
nombre; cambios registrados en `docs/DECISIONS.md`.

### 8.1 `validateDetectedHazards()`

1. Si `imageQuality` no es `ok`, no se llama a SAM y se pide repetir la foto.
2. Cajas recortadas a 0-1000; se descarta xMin >= xMax, yMin >= yMax o área
   menor a 0.2 % de la imagen.
3. `labelEs` a 60 caracteres y `evidenceEs` a 200.
4. `samPhrase` normalizada (minúsculas, sin comas ni punto y coma, sin "and",
   máximo 3 palabras); si queda vacía, la primera `examplePhrasesEn`.
5. Duplicados: mismo tipo con IoU > 0.5 se fusionan con la mayor confianza.
6. Máximo 12 riesgos por foto, por severidad base y luego confianza.

### 8.2 `resolveMasks()`

1. Caja 0-1000 a píxeles: `x = round(v * W / 1000)`, recortada a los bordes.
2. Una sola request a SAM con todas las cajas (id = índice), con
   `include_confidence`. Con `buildObjectPrompt`: `right = x2 + 1`,
   `bottom = y2 + 1` (el builder espera semiabiertas; `PixelBox` es inclusiva).
3. Máscara con IoU > 0.3 contra la caja de Spark: `maskSource = 'sam_box'`.
4. Si no: concepto con `samPhrase`, mayor IoU > 0.3: `maskSource = 'sam_concept'`.
   Máximo 3 respaldos por foto.
5. Si nada funciona: `maskSource = 'none'` y contorno con "contorno aproximado".

### 8.3 `planMissions()` — solo riesgos `open`

| Regla | Condición | Puntos | Texto |
| --- | --- | --- | --- |
| R1 Severidad | Siempre | severidad base x 10 | "Tipo de riesgo de severidad alta" (media o baja) |
| R2 Descanso | `nearRestArea` | +15 | "Está sobre o junto a donde alguien duerme o descansa" |
| R3 Paso | `blocksExitPath` | +12 | "Bloquea el paso hacia una salida" |
| R4 Personas | En ese cuarto duerme alguien child u older_adult, o con movilidad distinta de independent | +10 | "Aquí duerme alguien que necesita más tiempo para moverse" |
| R5 Recámara | `room.kind = bedroom` | +5 | "Está en una recámara" |
| R6 Altura | `heightLevel = high` | +4 | "Está en lo alto" |
| R7 Duda | `modelConfidence = low` | -8 | "La detección es dudosa; confírmala" |

Empates: mayor severidad base y luego orden de detección. Cada regla aplicada
produce una `PriorityReason` visible.

### 8.4 `decideFixStatus()`

- `sameSceneLikely` falso: sin cambio; repetir con la guía fantasma.
- `anchor_hardware`: herraje visible y confianza no baja →
  `fixed_visual_evidence` ("Herraje visible (no certifica la instalación)").
- `relocation`, `removal`, `path_clear`: `stillPresent` falso y confianza no
  baja → `fixed_visual_evidence`.
- `self_report` o cualquier confianza baja: confirmación manual →
  `fixed_self_reported`. Ninguna confianza baja verifica automáticamente.

### 8.5 `validateSafeZone()`

- Rechaza cocina. Rechaza un punto dentro de la caja ampliada 15 % del ancho de
  la imagen de cualquier riesgo abierto de mueble alto, objeto pesado en lo
  alto, vidrio, lámpara colgante o frágiles, nombrando el riesgo.
- Zona aceptada: "Zona de menor riesgo según lo visible en la foto; no evalúa
  la estructura".

### 8.6 `buildTemplateScenario()` y `validateScenario()`

Nivel 1: empiezas en el cuarto de la zona principal. Nivel 2: otro cuarto
escaneado, de preferencia donde duerme un integrante vulnerable; objetivo: la
zona de ese cuarto o la principal. Nivel 3: el riesgo abierto con `canBlockPath`
de mayor prioridad "cayó" y bloquea la zona más cercana; objetivo: otra zona;
sin dos zonas, baja a nivel 2. Situación: recámara durmiendo, cocina cocinando,
otro cuarto descansando. Narrativa nivel 3: "Estás {situación} en {cuarto}.
Empieza a temblar y {labelEs} cayó y bloquea el paso. Camina a tu zona
alterna: {zona}."

Propuesta de Spark aceptada solo si: ids dentro de las listas enviadas;
`blockedHazardId` nulo en niveles 1 y 2 y, en nivel 3, riesgo abierto con
`canBlockPath`; zona objetivo fuera de la caja ampliada del riesgo bloqueado;
narrativa de máximo 240 caracteres sin términos prohibidos ("SASMEX", "alerta
sísmica", "herido", "muerto", "sangre"). Si falla: un reintento con la lista de
errores; si vuelve a fallar, plantilla. `source` registra cuál se usó.

### 8.7 `evaluateDrill()`

Cronómetro al tocar "Comenzar" (tras la narración) y se detiene al tocar
"Llegué", antes de la foto; la verificación no cuenta en el tiempo. Llegada
`verified` si `sameLocationLikely` con confianza no baja; si no, `not_matched`
y se puede repetir la foto. Nivel completo con zona correcta verificada; en
nivel 3 además `routeAvoidedHazard` autodeclarado. El tiempo se compara con tu
mejor marca solo como información: sin puntos por velocidad ni penalizaciones.

## 9. API del backend, estados degradados y errores

Nueve endpoints, cinco pueden llamar a Meta, ninguno guarda estado. Cabecera
`X-Session-Id` (UUID del cliente, para costos) y, si `DEMO_ACCESS_CODE` está
definida, `X-Demo-Code`.

| Método y ruta | Slice | Llamadas a Meta |
| --- | --- | --- |
| `POST /api/rooms/scan` (multipart photo, roomId, roomKind, photoId) | S1 | 1 Spark, 1 SAM, hasta 3 respaldos |
| `POST /api/missions/plan` (hazards, profile) | S2 | Ninguna |
| `POST /api/hazards/verify` (beforeImage, afterImage, hazard) | S3 | 1 Spark |
| `POST /api/zones/validate` | S4 | Ninguna |
| `POST /api/drills/scenario` | S4 | Ninguna (plantilla) o 1 Spark (P1) |
| `POST /api/drills/arrival` (referenceImage, arrivalImage) | S4 | 1 Spark |
| `POST /api/drills/evaluate` | S4 | Ninguna |
| `POST /api/profile/from-voice` (audio WAV, roomNames) | S5 (P1) | 1 Voice, 1 Spark |
| `GET /api/health` | — | Ninguna |

Errores siempre `{"error": {"code", "messageEs", "retryable"}}`:
`IMAGE_UNREADABLE` 400 no reintentable; `VALIDATION_FAILED` 422 no;
`DEMO_CODE_REQUIRED` 401 no; `BUDGET_EXCEEDED` 429 no;
`META_ACCESS_DENIED` 502 no (404 `model_not_found`);
`META_BAD_REQUEST` 502 no (400 de Meta: bug nuestro, se registra con el
request saneado); `META_RATE_LIMITED` 503 sí (429 tras el reintento);
`META_TIMEOUT` 504 sí (30 s tras el reintento). Foto oscura o borrosa no es
error: llega como `imageQuality` y se pide repetirla.

Política Meta: timeout de 30 s por llamada; un solo reintento ante timeout,
5xx o 429 con backoff exponencial y jitter respetando `Retry-After`; un 400
nunca se reintenta.

Estados degradados (nunca pantalla en blanco ni éxito fingido): Spark falla →
modo toque (P1, `POST /api/rooms/segment-point`; sube a P0 si la Fase 0 no
alcanza el umbral) con "No pude analizar la foto; marca tú los riesgos"; SAM
sin máscara → contorno con "Contorno aproximado"; verificación incierta →
autodeclaración con "No pude confirmarlo en la foto. ¿Ya lo corregiste?";
escenario inválido → plantilla (visible en el modo evidencia); Voice falla →
formulario manual; presupuesto agotado → solo lectura con "Se alcanzó el
límite de uso de la demo". Esperas mayores a 2 s muestran el paso en curso y,
desde 15 s, un mensaje explícito de demora.

## 10. Privacidad, seguridad física y accesibilidad

Privacidad: fotos procesadas en memoria y descartadas al responder; nunca en
logs ni trazas (la traza guarda hash SHA-256, dimensiones y tamaño); en el
dispositivo todo en IndexedDB con botón visible "Borrar todo"; solo modo
Standard (`loadConfig()` impide arrancar con IDs `-contributor`); aviso breve
antes de la primera foto; fotos sin personas (en P1, segmentar "person" con
SAM y difuminar antes de guardar); perfil con alias, y a Spark solo viajan
rango de edad y movilidad, nunca el alias; repositorio público sin fotos de la
casa (`experiments/**/photos/` en `.gitignore`; fixtures solo con respuestas
de texto saneadas).

Seguridad física: "Camina, no corras" siempre visible en el simulacro y la
velocidad nunca da puntos; antes de cada simulacro: despejar el camino, no
cargar objetos y avisar en casa que es una práctica; tono de inicio suave y
distinto de cualquier alerta oficial; ningún texto usa la palabra "alerta";
sin instrucciones para un sismo real más allá de citar la guía oficial.

Accesibilidad WCAG 2.2 AA: objetivos táctiles de al menos 24x24 px CSS (44x44
en acciones principales); contraste de texto de al menos 4.5:1; riesgos nunca
solo por color (número, contorno discontinuo si abierto, sólido con palomita
si corregido, y lista sincronizada bajo la foto); overlay `aria-hidden` con la
lista como alternativa; sin arrastre (toque o lista); narración con
`speechSynthesis` y texto siempre en pantalla; `prefers-reduced-motion`
respetado; todo error descrito con texto.

## 11. Observabilidad, control de costos y modo evidencia

Traza (`TraceRecorder`): un `traceId` por request y un paso por etapa
(normalize, spark.detect, validate, sam.boxes, sam.concept, engine.plan, ...)
con duración, modelo, tokens de entrada, salida y razonamiento, imágenes SAM,
costo estimado y resultado (ok, fallback, error). Una línea JSON en stdout, sin
imágenes ni llaves.

Objeto `evidence` en cada caso de uso: `traceId`, `steps[]` (step, durationMs,
model, inputTokens, outputTokens, reasoningTokens, samImages,
estimatedCostUsd, outcome, noteEs), `modelProposal` (JSON de Spark antes del
motor), `engineDecisions[]` (ruleId, outcome accepted/rejected/adjusted,
detailEs), `totalLatencyMs` y `estimatedCostUsd`.

Costo con `usage` (`prompt_tokens`, `completion_tokens`,
`completion_tokens_details.reasoning_tokens`) y los precios de la sección 4.4
en configuración; SAM $0.0025 por imagen; Voice por segundo de audio.
`CostGuard`: $0.50 por sesión (`SESSION_BUDGET_USD`) y $5.00 por día
(`DAILY_BUDGET_USD`), en memoria (se reinicia con el servidor; declarado en el
README). Rate-limit: 30 requests por minuto por IP en endpoints que llaman a
Meta.

Modo evidencia (`EvidencePanel`): interruptor visible; por acción muestra la
entrada en miniatura, la propuesta del modelo en JSON resumido, las decisiones
del motor con sus reglas, latencia y costo por paso y la fuente del escenario.
Métricas a `docs/EVALUATION.md`: precisión y recall contra el set etiquetado,
éxito por `maskSource`, latencia p50 y p95 por paso, costo por cuarto y
aciertos de verificación en pares antes/después.

## 12. Plan por fases con compuertas

Cinco fases del 27 oct al 4 nov; ninguna empieza sin que la anterior cumpla su
compuerta con evidencia. Si una fase se atrasa, se recorta la siguiente.

**Fase 0 — Viabilidad (27 y 28 oct).** Esqueleto mínimo (contracts, clientes
Meta, `normalizeImage()`, `experiments/00-hazard-detection/run.ts`); acceso
(`GET /v1/models` lista `muse-spark-1.3` y `sam-3.1`; el humano confirma
créditos en Billing); sonda Spark y SAM con fixtures saneados; confirmar el
marco de coordenadas de `decodeMaskToSVGPath`; set de 15 fotos de 5 cuartos
etiquetadas por el humano en `labels.json`; corridas con `reasoning_effort`
minimal, low y medium con `review.html` para marcación humana y `report.json`
con métricas; tres pares antes/después para verificación.

**Compuerta 0:** recall >= 70 %, falsos positivos <= 1 por foto en promedio,
máscaras correctas en >= 80 % de las detecciones correctas, latencia p50
<= 8 s por foto y al menos 2 de 3 verificaciones correctas. Costo de la fase
menor a $2.50. Pasa: seguir el plan. Zona gris (recall 50-70 %): el modo toque
sube a P0. Falla (recall menor a 50 %, p50 mayor a 20 s o sin acceso): se
detiene y decide el humano; la alternativa preparada es Banqueta Viva.

**Fase 1 — Escaneo de punta a punta (29 y 30 oct).** `POST /api/rooms/scan`
completo con validador, máscaras, evidencia y `CostGuard`; web con hogar por
formulario, cámara, overlay, lista y "no es un riesgo"; despliegue HTTPS.
Compuerta 1: desde un teléfono en la URL desplegada, un cuarto real muestra al
menos 3 riesgos correctos con máscara en menos de 10 s; pruebas en verde.

**Fase 2 — Misiones, verificación y evidencia (31 oct y 1 nov).** Misiones con
"¿por qué va primero?", verificación con guía fantasma, cambio de estado,
contador "Hogar preparado" y `EvidencePanel`. Compuerta 2: un riesgo de
reubicación verificado con evidencia visual; uno de anclaje sin herraje en
autodeclaración; pruebas de `planMissions()` y `decideFixStatus()` en verde.

**Fase 3 — Simulacros (2 nov).** Zonas y su validación, plantillas de niveles
1 a 3, `DrillRunner` con narración, cronómetro y "Camina, no corras",
verificación de llegada y evaluación. Compuerta 3: niveles 1 y 3 completados
en la casa real, con el nivel 3 sobre un riesgo realmente abierto.

**Fase 4 — P1 y entrega (3 nov).** Solo si P0 está estable, en este orden:
escenarios con Spark, perfil por voz, plan familiar imprimible, modo toque (si
no subió a P0) y difuminado de personas. Además: README completo, video y
congelamiento a las 18:00.

**Entrega (4 nov).** Margen, checklist de la sección 14 y envío antes de las
20:00 de Ciudad de México. Sin funcionalidades nuevas.

**P2 prohibido sin autorización:** sincronización entre dispositivos, PWA sin
conexión, nivel nocturno, otros idiomas, realidad aumentada en vivo y video
con SAM.

## 13. Estrategia de pruebas y evaluación

Unitarias (Vitest, `apps/api/tests/unit`): `validateDetectedHazards()`
(recortes, cajas inválidas, `samPhrase`, duplicados, tope de 12);
`resolveMasks()` con SAM falso (cajas, concepto, sin máscara); `toPixelBox()`,
`clampBox()`, `boxIoU()`; `planMissions()` (tabla R1 a R7 y caso combinado);
`decideFixStatus()` (cada método por cada confianza y `sameSceneLikely`
falso); `validateSafeZone()`, `buildTemplateScenario()`, `validateScenario()`
(ids ajenos, términos prohibidos, reglas por nivel) y `evaluateDrill()` (el
tiempo nunca da puntos); `CostGuard`, `withRetry()` (sin reintento ante 400;
reintento ante 429 respetando `Retry-After`, con temporizadores falsos) y
`loadConfig()` (rechaza `-contributor`).

Contrato (`apps/api/tests/contract`): todo schema de Spark pasa el verificador
del subconjunto estricto; fixtures grabados validados con zod; parser de SAM
sobre fixture grabado produce las cajas esperadas. Caso de uso con fixtures:
`ScanRoomUseCase` de punta a punta con clientes falsos, sin red, verificando
`maskSource` y evidencia. En vivo opcionales: `pnpm test:live` con
`LIVE_TESTS=1` y `MODEL_API_KEY`, costo menor a $0.02.

Frontend (Vitest y Testing Library): mapeo de coordenadas de `HazardOverlay`,
almacén del hogar con `fake-indexeddb` y, en P1, cabecera y frecuencia del WAV.
Checklist manual en Chrome de Android y Safari de iOS: cámara, captura,
overlay, voz en español, cronómetro y mensaje sin conexión.

Regresión: cada cambio en el prompt o el schema de detección vuelve a correr
`experiments/00-hazard-detection` sobre las 15 fotos y compara contra el
`report.json` anterior; una caída de recall mayor a 5 puntos exige entrada en
`docs/DECISIONS.md`.

Definición de terminado: pruebas en verde, `tsc --noEmit` sin errores, lint
limpio, build correcto y reporte con evidencia (sección 15).

## 14. Guion de demo y checklist de entrega

Video de 3 minutos sin cortes que oculten llamadas a los modelos; si una
espera se acelera, la pantalla lo indica ("acelerado 2x"); respuestas grabadas
etiquetadas como tales. 0:00-0:20 problema con fuente (lesiones por elementos
no estructurales); 0:20-0:35 propuesta en una frase; 0:35-1:10 escaneo en vivo
con máscaras numeradas (Spark identifica, SAM delimita); 1:10-1:35 misión con
"¿por qué va primero?", corrección y verificación (rojo a verde);
1:35-2:15 simulacro nivel 3 con el riesgo no fijado y llegada verificada sin
puntos por velocidad; 2:15-2:40 modo evidencia (propuesta, máscaras,
decisiones, latencia y costo); 2:40-3:00 "Hogar preparado: X de Y" y límites
declarados. Unos 25 segundos al modo evidencia.

Checklist: repositorio público con licencia MIT; README con qué es, cómo
correrlo, variables de entorno, arquitectura, uso de cada modelo de Meta, lo
construido durante el hackathon (desde el 27 oct, con referencia a commits),
lo preexistente, limitaciones y el aviso de que no sustituye a Protección
Civil; URL HTTPS funcionando (con `DEMO_ACCESS_CODE` en el formulario si
existe); video de 3 minutos publicado; `docs/EVALUATION.md` con métricas
reales; sin secretos en el historial (escáner de secretos de GitHub) y sin
fotos de la casa; consumo revisado en Billing; formulario oficial (Indie
Developer); envío antes de las 20:00 de Ciudad de México del 4 nov.

## 15. Formato obligatorio de reporte del agente

Cada sesión termina con este reporte, en español, sin excepciones; una tarea
sin reporte se considera no hecha. Si algo no se pudo ejecutar (falta la llave,
falla la red, no hay teléfono), el reporte lo dice explícitamente y no presenta
el resultado como comprobado.

```markdown
## Reporte — <fase y tarea>

**Resultado:** terminado | parcial | bloqueado (una línea)

**Archivos creados o modificados:**
- ruta — qué cambió

**Comandos ejecutados y salida real:**
- `pnpm test` — N pruebas, N fallidas (pegar el resumen)
- `pnpm -r typecheck` — resultado
- `pnpm build` — resultado

**Evidencia:** capturas, `report.json`, URL desplegada o fragmentos de traza.

**Llamadas reales a Meta:** número, modelos y costo estimado en USD (0 si no hubo).

**Compuerta de la fase:** criterio por criterio, cumple o no cumple, con el dato medido.

**Decisiones tomadas:** entradas nuevas en docs/DECISIONS.md.

**Limitaciones y riesgos detectados:** lo que no funciona o se dejó fuera.

**Siguiente paso propuesto:** una sola acción concreta.
```
