# Despliegue

Un solo servicio Node sirve la API y la web compilada (`apps/web/dist`), con
HTTPS obligatorio para la cámara del teléfono.

## Render (recomendado para la demo)

1. Crea una cuenta y un Web Service nuevo desde este repositorio.
2. Render detecta `render.yaml`: compila con pnpm y arranca la API, que sirve
   la web en `/` y la API en `/api`.
3. Define las variables `MODEL_API_KEY` y `DEMO_ACCESS_CODE` (esta última se
   comparte con los jueces en el formulario).
4. Abre `/api/health`: debe responder `{"ok":true}`.
5. Desde tu teléfono, abre la URL HTTPS, configura el hogar y escanea un
   cuarto real.

Nota: el plan gratuito suspende el servicio por inactividad y el primer
arranque tarda; para la demo usa un plan que no duerma (`starter` en
`render.yaml`), o calienta la URL minutos antes de grabar.

## Verificación de la compuerta 1 (pendiente)

Desde el teléfono y en la URL desplegada: escanear un cuarto real debe mostrar
al menos 3 riesgos correctos con máscara en menos de 10 s, con pruebas en
verde. En local se midió 13.5 s de punta a punta en una corrida fría (3
riesgos, 2 con máscara); la mediana en caliente debe repetirse sobre la URL
desplegada antes de declarar la compuerta.
