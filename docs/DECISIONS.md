# Decisiones

Formato: fecha, decisión, motivo y alternativa descartada. Cambiar una decisión del super-prompt exige una entrada aquí.

| Fecha | Decisión | Motivo | Alternativa descartada |
| --- | --- | --- | --- |
| 2026-10-26 | Node >= 20.17 en `engines`; la máquina de desarrollo corre Node 24 | `@meta-sam/parser` pide Node ^20.17 o 22.9; Node 24 está disponible y es compatible para el código propio | Forzar Node 22 sin gestor de versiones instalado |
| 2026-10-26 | Schemas JSON de Spark escritos a mano en `spark-schemas.ts` sin conversor externo | Evita una dependencia extra y mantiene el subconjunto estricto auditable en pruebas | `zod-to-json-schema` como dependencia nueva |
| 2026-10-26 | Precios de Meta guardados como constantes en `config.ts` | La sección 4.4 los fija como [DOC]; deben ser visibles y ajustables sin tocar lógica | Leerlos de variables de entorno en cada llamada |
| 2026-10-26 | SAM se parsea con el parser oficial sobre el stream SSE y `reasoning_effort` de producción queda en `low` | La respuesta llega partida en eventos y los tokens se rompían: 0 % de máscaras SVG antes del arreglo, 100 % después; `low` cumple recall, falsos positivos y latencia a la vez (ver `docs/EVALUATION.md`) | Parseo con regex sobre el texto crudo; `minimal` (falsos positivos) o `medium` (latencia) |
