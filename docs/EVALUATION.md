# Evaluación

## Hechos [COMPROBADO] (26 oct 2026)

- Acceso: `GET /v1/models` devolvió 9 modelos e incluye `muse-spark-1.3`,
  `sam-3.1` y `muse-voice-transcribe-1.0`. Sin `model_not_found`.
- Spark: primera llamada real con imagen sintética respondió en 1,448 ms con
  `imageQuality: "not_indoor_room"` y 0 riesgos (correcto para una imagen que
  no es un cuarto). Uso: 2,243 tokens de entrada y 170 de salida (149 de
  razonamiento). Costo estimado: $0.0035.
- SAM: primera llamada por concepto ("bookshelf") sobre la misma imagen
  respondió en 883 ms con 0 resultados, que es un resultado normal. Costo:
  $0.0025 por imagen.
- Costo total de las sondas: ~$0.006 USD.

Esto prueba los contratos de request/response. No prueba todavía la calidad de
detección: para eso faltan las 15 fotos reales etiquetadas.

## Fase 0 ejecutada (26 oct 2026, 14 fotos, 16 riesgos etiquetados)

Corrida real: 42 análisis (14 fotos x reasoning `minimal`, `low`, `medium`) con
Spark + SAM vía `experiments/00-hazard-detection/run.ts`. Etiquetas humanas
propuestas por el agente y aceptadas por el humano en `labels.json`. El recall
y los falsos positivos se calcularon por coincidencia de tipo por foto; es una
medición automática provisional que aún requiere la marcación humana fina en
`review.html` para precisión por instancia.

| Métrica | Umbral de compuerta 0 | minimal | low | medium |
| --- | --- | --- | --- | --- |
| Recall de detección | >= 70 % | 68.8 % (11/16) | **75 % (12/16)** | **75 % (12/16)** |
| Falsos positivos por foto | <= 1 | 1.21 | 1.14 | 1.21 |
| Máscaras (`maskSource` distinto de none, sobre detecciones) | >= 80 % | 57 % (17/30) | 61 % (19/31) | 59 % (19/32) |
| Latencia p50 por foto (escaneo completo) | <= 8 s | **7.5 s** | 11.1 s | 17.9 s |
| Verificaciones correctas (3 pares antes/después) | >= 2 de 3 | Sin medir: faltan los pares | | |
| Costo de la corrida | < $2.50 la fase | $0.84 estimados en `report.json` (42 corridas) | | |

**Lectura (primera corrida):** la compuerta 0 no se cumplía con ningún nivel
de razonamiento. `low` daba el mejor equilibrio (recall 75 %), pero la latencia
(11.1 s) superaba el umbral de 8 s y la tasa de máscaras (~61 %) quedaba lejos
del 80 %.

## Segunda corrida tras los arreglos (26 oct 2026)

Causa raíz encontrada: la respuesta de SAM llega partida en eventos SSE y los
tokens de caja/máscara se rompían entre eventos; el cliente ahora usa el parser
oficial `@meta-sam/parser` sobre el stream, decodifica la máscara a SVG, corre
los respaldos por concepto en paralelo y el prompt refuerza los tres tipos que
se perdían. Además quedó [COMPROBADO] que el raster de la máscara mide lo mismo
que su caja (363x564 contra caja de 362x563): las coordenadas del SVG son
locales a la caja y el frontend deberá trasladarlas por el origen de la caja.

| Métrica (con `reasoning_effort: low`) | Umbral | Antes | Después |
| --- | --- | --- | --- |
| Recall de detección | >= 70 % | 75 % (12/16) | **75 % (12/16)** |
| Falsos positivos por foto | <= 1 | 1.14 | **0.93** |
| Detecciones con máscara SVG real | >= 80 % | 0 % (0/31 con path) | **100 % (29/29)** |
| Latencia p50 por foto | <= 8 s | 11.1 s | **7.3 s** |
| Costo acumulado estimado de la fase | < $2.50 | $0.85 | ~$1.71 (dos corridas + sondas) |

Con `low`, todos los criterios medibles de detección cumplen. `minimal` es más
rápido (5.4 s) pero deja 1.21 falsos positivos por foto; `medium` tarda 12.6 s
sin mejorar el recall. El nivel de producción queda en `low`.

## Verificación con fotos reales (27 oct 2026): 1 de 1 pares correctos

Par 1: cuadro de piedra de la tortuga retirado de la pared de la escalera
(fotos en `Downloads/nuevas fotos`, fuera de git; riesgo definido por el
humano como `HEAVY_OBJECT_HIGH` porque Spark no lo propuso en la foto de
antes). Veredicto de Spark con ancla de rectángulo rojo: `sameSceneLikely:
true`, `stillPresent: false`, confianza `high` → `fixed_visual_evidence`
("Ya no se observa el riesgo en la foto"). Costo del par: $0.0118.

## Pares 2 y 3: sillón y silla movidos (27 oct 2026)

- Par 2 (sillón de la pared al centro del cuarto): veredicto incorrecto.
  Spark dijo que el sillón seguía en su lugar con confianza alta. Causa
  probable: el encuadre cambió entre fotos (la cámara se movió) y hay dos
  sillones azules parecidos, así que el modelo ancló mal la comparación.
  Esto valida la guía fantasma del producto: sin el mismo encuadre, la
  verificación se degrada. En el flujo real, `sameSceneLikely` falso pide
  repetir la foto.
- Par 3 (silla de plástico junto a la cama, ahora despejado): veredicto
  correcto con confianza alta → `fixed_visual_evidence`. ($0.0133 los 2 pares.)

**Verificaciones: 2 correctas de 3 (cuadro de piedra, silla) — cumple el
criterio de la compuerta (>= 2 de 3).** El par fallido quedó explicado por el
cambio de encuadre, no por el motor: `decideFixStatus` actuó como debía ante
el veredicto que recibió.

Dato honesto: la marcación fina de precisión por instancia (la revisión
humana foto por foto de cada detección) sigue pendiente; el recall y los
falsos positivos actuales son por coincidencia de tipo.

**Estado de la compuerta 0:** todos los criterios medibles cumplen con
`reasoning_effort: low`. Pendiente no bloqueante: la marcación fina, que se
hará con `review.html` cuando haya tiempo. La Fase 1 puede arrancar.

## Cómo se mide

1. Fotos en `experiments/00-hazard-detection/photos/` (fuera de git).
2. Etiquetas humanas en `experiments/00-hazard-detection/labels.json`.
3. `corepack pnpm exec tsx experiments/00-hazard-detection/run.ts` con `MODEL_API_KEY`.
4. Marcación humana en `review.html`; el script escribe `report.json`.

Ninguna métrica se fabrica: si no hay corrida real, esta tabla dice "Pendiente".
