# Simulacro Vivo

Convierte el Plan Familiar de Protección Civil en un juego que se juega dentro de tu propia casa: detecta riesgos no estructurales en fotos reales, te pide corregirlos, verifica la corrección y te hace practicar el repliegue a una zona de menor riesgo.

> No evalúa la seguridad estructural de tu casa, no certifica instalaciones y no sustituye a Protección Civil, a un dictamen ni a un especialista. No da primeros auxilios ni consejo médico.

## Estado

Fase 0 (viabilidad) en curso. El esqueleto del monorepo, los contratos, el motor determinista y los clientes de Meta están implementados y probados sin red. Todavía no se ha hecho ninguna llamada real a la API de Meta: falta configurar `MODEL_API_KEY` y etiquetar las 15 fotos de evaluación.

## Cómo correrlo

Requisitos: Node >= 20.17 y pnpm (vía Corepack: `corepack enable`).

```bash
corepack pnpm install
copy .env.example .env   # en Windows; completa MODEL_API_KEY solo en tu máquina
corepack pnpm --filter @simulacro/api dev
corepack pnpm --filter @simulacro/web dev
```

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `MODEL_API_KEY` | Llave de Meta Model API. Solo en el servidor, nunca en el navegador ni en git. |
| `META_BASE_URL` | Base de la API (`https://api.meta.ai/v1`). |
| `SPARK_MODEL` / `SAM_MODEL` / `VOICE_MODEL` | IDs de modelo. Nunca terminados en `-contributor`. |
| `SESSION_BUDGET_USD` / `DAILY_BUDGET_USD` | Límites de gasto (0.50 / 5.00 por defecto). |
| `DEMO_ACCESS_CODE` | Código opcional para jueces; si se define, se exige en `X-Demo-Code`. |
| `PORT` | Puerto del API (3000 por defecto). |

## Uso de cada modelo de Meta

- **Muse Spark 1.3** (`muse-spark-1.3`, Chat Completions): propone riesgos del catálogo cerrado, verifica correcciones y compara la llegada a la zona. Sin él no hay juicio sobre la escena.
- **SAM 3.1** (`sam-3.1`, Responses API): convierte las cajas de Spark en máscaras precisas. Sin él solo habría rectángulos aproximados.
- **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`, P1): captura el perfil del hogar dictado en español. Sin él el perfil solo se llena a mano.

El modelo propone y el motor determinista decide: validación de cajas, fusión de duplicados, prioridad de misiones (R1-R7), estado de corrección, zonas y escenarios son funciones puras probadas, sin red.

## Construido durante el hackathon y preexistente

- **Construido desde el 27 oct 2026:** todo el código de `apps/`, `packages/` y `experiments/`, el catálogo de riesgos y el motor determinista. Ver el historial de commits.
- **Preexistente (librerías y plantillas):** Fastify, Vite, React, `sharp`, `openai`, `@meta-sam/parser`, zod y Vitest. Ninguna lógica de producto viene de una plantilla.

## Limitaciones conocidas

- Backend sin estado: el hogar vive en un solo dispositivo (IndexedDB), sin sincronización.
- Los contadores de costo viven en memoria y se reinician con el servidor.
- La severidad base del catálogo es una heurística de producto, no un dato científico.
- Sin acceso confirmado a los modelos desde México ni créditos acreditados todavía; la Fase 0 lo verifica antes de depender de ello.

## Licencia

MIT.
