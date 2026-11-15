# Reglas de Negocio, Datos y Seguridad V2

## 1. Sistema de Seguridad de Doble Código

- **Bloqueo Inicial de Acceso (`pin_recepcion`)**:
  - Al abrir el sistema en una nueva pestaña o sesión sin autorización (`sessionStorage.getItem('gym_acceso_recepcion_ok') !== 'true'`), se muestra un bloqueo modal ineludible (`#modal-acceso-inicial`).
  - Tras ingresar el código de acceso (`configuracion.pin_recepcion`, por defecto `'2026'`), la sesión entra siempre en **`MODO RECEPCIÓN`** (`rolActual = 'RECEPCION'`), independientemente del rol anterior.
- **Elevación Manual a Administrador (`pin_admin`)**:
  - Desde el botón de rol en la barra lateral (`🔒 MODO RECEPCIÓN` / `🔓 ADMIN`), el administrador puede ingresar `configuracion.pin_admin` (por defecto `'1234'`) para habilitar funciones sensibles (anulación de recibos, edición de histórico, eliminación, configuración y registro de auditoría).
  - **Auto-bloqueo por inactividad**: Si transcurren 5 minutos (`300000 ms`) sin eventos de interacción (`click`, `keydown`, `mousemove`, `touchstart`) estando en modo `ADMIN`, el rol vuelve automáticamente a `RECEPCION`.

## 2. Contrato Retrocompatible de `window.GymStore`

- Objetos raíz en `store.state`:
  - `alumnos`, `membresias`, `recibos`, `planes`, `horarios`, `configuracion`, `actividades`.
- `configuracion`:
  - Campos vigentes: `nombre_academia`, `subtitulo`, `telefono`, `direccion`, `moneda`, `precio_inscripcion`, `serie_recibo`, `proximo_nro_recibo`, `dias_alerta_vencimiento`, `logo_url`, `pin_recepcion` (default `'2026'`), `pin_admin` (default `'1234'`), `pedir_pin_inicio` (default `true`), `perfiles_operadores`, `color_tema`, `tema_visual`, `rol_actual`.
  - Si `pedir_pin_inicio === false`, el arranque inicial entra directo en `MODO RECEPCIÓN` sin mostrar el modal de PIN.
- `recibos`:
  - Agrega campo opcional `cobrado_por` (por defecto `'Recepción'`).
- `actividades`:
  - Arreglo cronológico descendente (máximo 150 entradas recientes) con `{ id, fecha, actor, accion, detalle }`.
