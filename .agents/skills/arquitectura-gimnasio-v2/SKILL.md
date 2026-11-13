---
name: arquitectura-gimnasio-v2
description: Reglas de arquitectura modular sin compilación, contrato de datos Supabase, lógica de horarios, contabilidad de caja y seguridad de doble código para el sistema de gimnasio de artes marciales. Úsala cuando modifiques la capa de datos, seguridad o exportadores en V2.
---

# Arquitectura y Reglas de Negocio V2

Este proyecto mantiene una arquitectura **zero-build** (JavaScript modular global + Tailwind CDN + GitHub Pages) para garantizar cero fricción operativa y despliegue inmediato.

## Capas del Sistema

1. **Configuración e Integración Cloud (`src/js/cloudConfig.js`, `src/js/supabaseSync.js`)**:
   - No modificar credenciales ni URLs de Supabase.
   - Mantener compatibilidad retroactiva con el esquema JSON guardado en la nube (`alumnos`, `membresias`, `recibos`, `planes`, `horarios`, `configuracion`).
   - Todo campo nuevo (`pin_recepcion`, `actividades`, `cobrado_por`) debe tener inicialización defensiva por defecto al cargar estados previos.
2. **Almacén de Estado y Lógica de Negocio (`src/js/store.js`, `src/types/gym.ts`)**:
   - Fuente única de verdad en memoria con persistencia local (`localStorage`) y sincronización asíncrona.
   - Registra trazabilidad operativa (`registrarActividad`) en cada acción sensible.
3. **Exportadores y Comprobantes (`src/js/receiptGenerator.js`, `src/js/excelExporter.js`)**:
   - Generación de comprobantes Canvas PNG, texto estructurado de WhatsApp y exportación Excel con soporte de columna `Cobrado por`.
4. **Interfaz y Controlador (`index.html`, `src/css/styles.css`, `src/js/app.js`)**:
   - Separación limpia entre hoja de estilos externa, marcado semántico e inicialización de eventos.

## Consulta de Detalles

Para revisar las reglas exactas de seguridad de doble código, auto-bloqueo y contrato de funciones, consulta la guía de referencia en [reglas-negocio-y-seguridad.md](references/reglas-negocio-y-seguridad.md).
