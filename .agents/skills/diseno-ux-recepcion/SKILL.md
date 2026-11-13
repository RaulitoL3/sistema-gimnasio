---
name: diseno-ux-recepcion
description: Estándares visuales Light Mode de alto contraste, patrones anti-fricción para recepción en menos de 10 segundos, formularios colapsables y navegación móvil para el sistema de gimnasio. Úsala al construir o auditar vistas HTML, CSS y flujo de interfaz.
---

# Diseño y Experiencia de Usuario para Recepción (V2)

La interfaz está diseñada para que personal de recepción cobre, renueve y envíe comprobantes por WhatsApp con un mínimo de clics y cero confusión visual.

## Principios Fundamentales

1. **Claridad Profesional y Etiquetado Formal**:
   - Usar indicadores sobrios: `🔒 MODO RECEPCIÓN` y `🔓 ADMIN` (sin etiquetas informales).
   - Tema Claro nativo de alto contraste para lectura rápida en pantallas de escritorio y celular.
2. **Cobro en Menos de 10 Segundos**:
   - Buscador autocompletable de alumnos en `#modal-nuevo-pago` en lugar de `<select>` extensos.
   - Al seleccionar un alumno existente para renovar, ocultar campos redundantes de ficha personal y mostrar una tarjeta resumen compacta.
   - 4 botones grandes y táctiles para método de pago (`Efectivo`, `Yape`, `Plin`, `Transferencia`) y selector de responsable (`Cobrado por`).
3. **Envío Rápido Post-Cobro**:
   - Botón de 1 clic (`Copiar Imagen y Abrir WhatsApp`) en `#modal-comprobante` con respaldo de `navigator.share` en dispositivos móviles.
4. **Espacio Operativo Limpio**:
   - Tablas y grillas de **Horarios** y **Planes** al 100% de ancho con formularios de creación colapsables (`+ Nuevo Horario`, `+ Nuevo Plan`).
   - Desglose inmediato de caja diaria (`Efectivo` vs. `Yape/Plin/Digital`) y barra de navegación inferior fija en móviles.

## Guía de Componentes

Para revisar la lista exacta de IDs, clases CSS y patrones de interacción requeridos, consulta [guia-componentes-ux.md](references/guia-componentes-ux.md).
