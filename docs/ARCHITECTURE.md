# Arquitectura

Monorepo TypeScript con pnpm workspaces: `apps/web` (Vite + React), `apps/api` (Fastify) y `packages/contracts` (tipos, catálogo y schemas compartidos con zod).

## Flujo de escaneo (5 pasos)

1. El cliente reduce la foto a 1600 px máximo y la sube a `POST /api/rooms/scan`.
2. El backend la normaliza con `sharp` (rotación EXIF, lado largo 1280 px, JPEG calidad 80, sin metadatos). Esos bytes exactos son la única base de coordenadas.
3. Spark propone riesgos del catálogo cerrado con caja 0-1000; el motor determinista valida (`validateDetectedHazards`).
4. SAM segmenta todas las cajas en una sola request (`resolveMasks`); respaldo por concepto con `samPhrase`, máximo 3 por foto.
5. La respuesta incluye la imagen normalizada, los riesgos con `maskSource` y el objeto `evidence`.

Spark propone y SAM delimita; solo el motor decide qué llega al usuario.

## Decisiones clave

- Backend sin estado: sin base de datos; el hogar vive en IndexedDB del dispositivo.
- La llave de Meta nunca llega al navegador.
- Máscaras como paths SVG de `@meta-sam/parser`; si SAM no devuelve máscara, la interfaz dibuja el contorno de la caja.
- Cada respuesta de caso de uso incluye `evidence` (traza, decisiones, latencia y costo).
- `CostGuard` en memoria: $0.50 por sesión y $5.00 por día; se reinicia con el servidor.
