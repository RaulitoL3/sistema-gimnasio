# Guía de Componentes e IDs UX V2

## Estándares Visuales (`src/css/styles.css`)

- `.btn-metodo-pago`: botones en grilla 2x2 o 4 columnas con estado `.active` de borde destacado y fondo tintado según método (verde para Efectivo, morado para Yape, turquesa para Plin, azul para Transferencia).
- `.autocomplete-dropdown`: menú flotante bajo `#pago-buscar-alumno-input` con máximo `220px` de alto, scroll vertical y filas clicables con estado del alumno.
- `#mobile-bottom-nav`: barra inferior fija (`fixed bottom-0 inset-x-0 z-30 lg:hidden`) con compensación de `padding-bottom` en `<main>` para evitar solapar contenido en pantallas pequeñas.

## Componentes Clave por Vista

- **Acceso y Roles**:
  - `#modal-acceso-inicial`, `#form-acceso-inicial`, `#acceso-inicial-pin`, `#acceso-inicial-error`
  - `#btn-rol-badge`
- **Dashboard**:
  - `#kpi-hoy-efectivo`, `#kpi-hoy-digital`
  - `#bloque-auditoria-admin`, `#lista-auditoria-reciente`
- **Modal Nuevo Pago / Renovación (`#modal-nuevo-pago`)**:
  - `#pago-buscar-alumno-input`, `#pago-lista-sugerencias-alumnos`, `#pago-alumno-id`
  - `#resumen-alumno-seleccionado`, `#bloque-datos-personales-form`
  - `.btn-metodo-pago[data-metodo]`, `#pago-metodo`
  - `#pago-cobrado-por`
- **Modal Cobrar Saldo (`#modal-cobrar-saldo`)**:
  - `.btn-metodo-saldo[data-metodo]`, `#saldo-metodo`, `#saldo-cobrado-por`
- **Modal Comprobante (`#modal-comprobante`)**:
  - `#btn-copiar-y-whatsapp`
- **Horarios y Planes Colapsables**:
  - `#btn-toggle-form-horario`, `#contenedor-form-horario`
  - `#btn-toggle-form-plan`, `#contenedor-form-plan`
- **Configuración**:
  - `#cfg-pin-recepcion`
