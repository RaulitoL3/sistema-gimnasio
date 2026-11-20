---
name: "Dojo Precision — Editorial Athletic Studio"
description: "Sistema de diseño operativo zero-build para recepción de gimnasio de artes marciales: cobro en menos de 10 segundos y legibilidad financiera instantánea."
colors:
  canvas-light: "#F5F6F8"
  surface-elevated-light: "#FFFFFF"
  surface-secondary-light: "#EEF1F5"
  border-subtle-light: "#DCE2EA"
  text-primary-light: "#0F172A"
  text-secondary-light: "#475569"
  text-muted-light: "#5B697D"
  canvas-dark: "#0B0F14"
  surface-elevated-dark: "#121821"
  surface-secondary-dark: "#17202C"
  border-subtle-dark: "#243041"
  text-primary-dark: "#F1F5F9"
  text-secondary-dark: "#CBD5E1"
  text-muted-dark: "#94A3B8"
  brand-rojo: "#DC2626"
  brand-azul: "#2563EB"
  brand-dorado-light: "#B45309"
  brand-dorado-dark: "#F59E0B"
  brand-esmeralda-light: "#047857"
  brand-esmeralda-dark: "#10B981"
  status-success: "#047857"
  status-warning: "#B45309"
  status-danger: "#DC2626"
  status-info: "#0369A1"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0em"
    fontFeature: "tnum"
rounded:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-rojo}"
    textColor: "{colors.surface-elevated-light}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-secondary-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
    height: "44px"
  card:
    backgroundColor: "{colors.surface-elevated-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  card-subtle:
    backgroundColor: "{colors.surface-secondary-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    padding: "1rem"
  input:
    backgroundColor: "{colors.surface-elevated-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    padding: "0.5625rem 0.875rem"
    height: "44px"
  nav-item:
    backgroundColor: "{colors.brand-rojo}"
    textColor: "{colors.surface-elevated-light}"
    rounded: "{rounded.md}"
    padding: "0.625rem 0.875rem"
    height: "44px"
---

# Design System: Dojo Precision — Editorial Athletic Studio

## Overview

**Creative North Star: "Dojo Precision — Editorial Athletic Studio"**

Este sistema gobierna una herramienta operativa en modo **Operate** diseñada para la recepción de una academia de artes marciales. La interfaz prioriza la ejecución de cobros, inscripciones y renovaciones en menos de 10 segundos y la lectura financiera inmediata de caja diaria, saldos pendientes y vencimientos.

La estética responde a una disciplina sobria, arquitectónica y de alto contraste: neutros minerales silenciosos que sostienen largas jornadas en escritorio bajo luz diurna (`[data-theme="light"]`) o turnos nocturnos (`[data-theme="dark"]`), combinados con un único acento de marca configurable (`[data-brand]`) y estados semánticos inequívocos para dinero, vigencia y sincronización en la nube. Se descartan deliberadamente los ornamentos de plantilla: cero gradientes decorativos, cero textos en gradiente, cero kickers o eyebrows en mayúsculas sobre encabezados y cero parches CSS con `!important`.

**Key Characteristics:**
- **Dual-Theme Nativo:** `[data-theme="light"]` por defecto para lectura nítida en recepción y `[data-theme="dark"]` compuesto explícitamente sin inversión mecánica.
- **Legibilidad Financiera Tabular:** Montos, fechas de vigencia y números de recibo alineados verticalmente mediante `JetBrains Mono` con `tabular-nums`.
- **Cero Fricción Táctil:** Botones de 1 clic para métodos de pago, áreas táctiles mínimas de 44px en dispositivos móviles/táctiles e inputs de 16px (`1rem`) para evitar zoom automático en iOS.
- **Separación Estructural:** Tokens nativos en `src/css/tokens.css` y componentes semánticos `.ui-*` + atributos `[data-*]` en `src/css/styles.css`.

## Colors

La paleta separa estrictamente los neutros estructurales (lienzo, superficies elevadas y bordes), el color de marca seleccionable por academia y los colores semánticos de operación.

### Primary (Marca Configurable via `[data-brand]`)
- **Rojo Clásico (`ROJO`, defecto):** Acento `#DC2626` (`hover` `#B91C1C`) con texto inverso blanco `#FFFFFF` (contraste 4.82:1+).
- **Azul Olímpico (`AZUL`):** Acento `#2563EB` (`hover` `#1D4ED8`) con texto inverso blanco `#FFFFFF` (contraste 5.17:1+).
- **Dorado Campeón (`DORADO`):** En Light usa ámbar profundo `#B45309` (`hover` `#92400E`) sobre texto blanco `#FFFFFF` (5.02:1); en Dark usa ámbar luminoso `#F59E0B` (`hover` `#FBBF24`) con texto oscuro `#0B0F14` (8.76:1) para garantizar contraste WCAG AA+.
- **Verde Dojo (`ESMERALDA`):** En Light usa esmeralda profundo `#047857` (`hover` `#065F46`) sobre texto blanco `#FFFFFF` (5.48:1); en Dark usa `#10B981` (`hover` `#34D399`) con texto oscuro `#0B0F14` (7.55:1).

### Secondary (Estados Semánticos y Métodos de Pago)
- **Pagado / Vigente (`--status-success-*`):** Esmeralda `#047857` (Light) / `#6EE7B7` sobre tinta translúcida (Dark) para saldo en cero, vigencia activa y envíos por WhatsApp.
- **Saldo / Por Vencer (`--status-warning-*`):** Ámbar `#92400E` texto sobre `#FFFBEB` (Light) / `#FCD34D` (Dark) para deudas parciales y alertas próximas a vencer.
- **Vencido / Anulado / Admin (`--status-danger-*`):** Carmesí `#B91C1C` / `#DC2626` (Light) / `#FCA5A5` (Dark) para membresías vencidas, recibos anulados y elevación administrativa.
- **Nube / Info / Solo Inscrito (`--status-info-*`):** Azul petróleo `#0369A1` (Light) / `#7DD3FC` (Dark) para sincronización activa, matrículas pendientes de primer mes y acciones secundarias informativas.
- **Métodos de Pago 1-Clic:** Efectivo (`#047857`), Yape/Plin (`#7C3AED`), Transferencia (`#0369A1`) y Tarjeta POS (`#B45309` en Light / `#D97706` con texto `#0B0F14` en Dark).

### Neutral
- **Light (`:root, [data-theme="light"]`):** Lienzo `#F5F6F8`, superficie elevada `#FFFFFF`, superficie secundaria `#EEF1F5`, borde sutil `#DCE2EA`, texto primario `#0F172A`, secundario `#475569` y atenuado `#5B697D`.
- **Dark (`[data-theme="dark"]`):** Lienzo `#0B0F14`, superficie elevada `#121821`, superficie secundaria `#17202C`, borde sutil `#243041`, texto primario `#F1F5F9`, secundario `#CBD5E1` y atenuado `#94A3B8`.

### Named Rules
- **The Zero-Important Theme Rule.** Ninguna regla de color o tema claro puede usar `!important` ni parches `body.light-theme`; todo cambio de apariencia ocurre reasignando variables CSS bajo `[data-theme="light"]`, `[data-theme="dark"]` y `[data-brand]`.
- **The Windows Native Control Rule.** Todo `<select>` y `<option>` declara explícitamente `background-color: var(--select-bg)` y `color: var(--select-color)` para evitar menús nativos ilegibles en Windows.
- **The Semantic Rarity Rule.** Los colores de acento y estado solo codifican acciones primarias, selección activa o estado financiero/operativo; nunca se emplean como decoración ambiental.

## Typography

**Body & UI Font:** `Plus Jakarta Sans` (respaldo `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`)
**Data & Mono Font:** `JetBrains Mono` (respaldo `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`)

**Character:** Escala compacta y predecible de modo Operate (`1.125–1.25` entre niveles) que prioriza el escaneo horizontal de tablas y formularios de cobro rápido.

### Hierarchy
- **Display / KPI Hero** (`800`, `1.375rem–1.75rem`, `line-height: 1.15`, `JetBrains Mono` + `tabular-nums`): Cifras monetarias de caja diaria, saldos totales y recuento de vigentes.
- **Headline / View Title** (`800`, `1.25rem–1.5rem`, `line-height: 1.25`, `-0.025em`, `text-wrap: balance`): Títulos principales de cada vista (`.ui-view-title`).
- **Title / Card & Modal** (`800`, `1rem–1.125rem`, `line-height: 1.25`, `-0.02em`): Encabezados de tarjetas, grupos de horario y modales (`.ui-card-title`, `.ui-modal-title`).
- **Body & Inputs** (`500`, `1rem` / `16px`, `line-height: 1.5`): Texto corriente y valor de todos los campos `.ui-input` y `.ui-select` para legibilidad y prevención de zoom automático en iOS Safari.
- **Label & Table Header** (`700`, `0.75rem` / `12px`, `line-height: 1.3`): Etiquetas de campo (`.ui-label`), encabezados de tabla y badges compactos.
- **Data / Receipt Mono** (`700`, `0.75rem–1.5rem`, `JetBrains Mono` + `tabular-nums`): Números de recibo (`#000105`), fechas (`DD/MM/YYYY`), teléfonos y montos en tablas y cajas de saldo.

### Named Rules
- **The No-Kicker Rule.** Prohibido colocar etiquetas ALL-CAPS decorativas (`eyebrow` / `kicker`) encima de encabezados; cada título habla por sí mismo.
- **The Tabular Ledger Rule.** Toda celda numérica, fecha, saldo y correlativo de recibo debe activar `font-variant-numeric: tabular-nums` (`.ui-mono` / `.ui-tabular` / `.ui-cell-mono`).

## Layout

La estructura separa de forma fija la navegación de área de trabajo del flujo de búsqueda y cobro instantáneo:
- **Shell de Escritorio (`>= 1024px`):** Barra lateral fija izquierda `.ui-sidebar` de `288px` (`18rem`) + columna principal flexible con barra superior pegajosa `.ui-topbar` (buscador global + acción primaria de cobro) y contenedor `.ui-main` acotado a `1280px` (`80rem`).
- **Adaptación Móvil y Tablet (`< 1024px`):** La barra inferior fija `.ui-mobile-nav` concentra las 4 vistas críticas y el botón flotante central `.ui-fab` de cobro rápido, con compensación inferior que incluye `env(safe-area-inset-bottom)` para no solapar el último registro.
- **Ritmo Espacial:** Escala estricta en múltiplos de `4px` (`4, 8, 12, 16, 20, 24, 32px`). Encabezados y anclas de vista aplican `scroll-margin-top` compensando la altura de `.ui-topbar`.
- **Grilla Adaptativa de Montos (`.ui-grid-montos`):** En móvil apila a `1` columna; desde `640px` alterna entre `2` columnas (`[data-compact="true"]` cuando el número de recibo está colapsado) y `3` columnas (`[data-compact="false"]`).

## Elevation & Depth

El sistema usa **capas tonales limpias con bordes completos de `1px`** y sombras contenidas únicamente para separar planos flotantes:
- **Planos Base y Anidados:** El lienzo (`--bg-canvas`) soporta tarjetas primarias (`.ui-card`, sombra `--shadow-xs` + borde `--border-subtle`). Cualquier agrupación interna dentro de una tarjeta o modal utiliza `.ui-card-subtle` (`--surface-secondary`, `box-shadow: none`), evitando tarjetas pesadas anidadas.
- **Capas Flotantes:** Menús desplegables (`.ui-dropdown`, `--shadow-dropdown`, `z-index: 50`), modales (`.ui-modal-panel`, `--shadow-lg`, `z-index: 60–70`) y notificaciones (`.ui-toast`, `--shadow-lg`, `z-index: 80`).

### Named Rules
- **The Single-Elevation Rule.** Ninguna tarjeta combina sombras difusas amplias con bordes gruesos; la jerarquía se expresa una sola vez por nivel.
- **The Flat Nesting Rule.** Todo contenedor dentro de `.ui-card` o `.ui-modal-body` usa fondo tonal plano (`.ui-card-subtle`), nunca otra sombra elevada.

## Shapes

- **Tarjetas, Modales y Header de Vista:** Radio de `16px` (`--radius-lg`).
- **Botones, Inputs, Selectores, Segmented Controls y Contenedores Internos:** Radio de `12px` (`--radius-md`), con `8px` (`--radius-sm`) para botones compactos `sm`, segmentos internos y avatares pequeños.
- **Badges de Estado e Indicador Cloud:** Cápsula completa (`9999px`, `--radius-pill`).
- **Bordes:** Siempre completos en los cuatro lados (`1px` o `1.5px`); prohibidas las franjas de color laterales solitarias (`border-left` grueso) en tarjetas o filas redondeadas.

## Components

Catálogo normativo de clases `.ui-*` y estados `[data-*]` implementado en `src/css/styles.css`:

- **Navegación y Shell:** `.ui-shell`, `.ui-sidebar`, `.ui-brand-header`, `.ui-logo-box` (`[data-size="sm|md|lg"]`), `.ui-topbar`, `.ui-nav-item` (`[data-active="true"]`), `.ui-mobile-nav`, `.ui-mobile-nav-item` (`[data-active="true"]`), `.ui-fab`, `.ui-view-header`.
- **Superficies:** `.ui-card`, `.ui-card-subtle`, `.ui-kpi-card` (`[data-tone="success|info|warning|brand"]`), `.ui-action-card` (`[data-tone="emerald|brand|amber"]`), `.ui-list-row`, `.ui-audit-row`, `.ui-empty-state`, `.ui-banner-info`, `.ui-banner-warning`.
- **Controles e Inputs:**
  - `.ui-btn` con `[data-variant="primary|secondary|ghost|danger|warning|success|sky|whatsapp"]` y `[data-size="sm|md|lg"]`.
  - `.ui-segmented` + `.ui-segmented-btn` (`[data-active="true"]`).
  - `.ui-input` (`[data-mono="true"]`, `[data-tone="success|warning|danger|info"]`, `.ui-input--search`), `.ui-select`, `.ui-checkbox`, `.ui-checkbox-label`.
  - `.btn-metodo-pago` / `.btn-metodo-saldo` con `.active[data-metodo="EFECTIVO|YAPE_PLIN|TRANSFERENCIA|TARJETA"]`.
  - `.ui-grid-montos` (`[data-compact="true|false"]`).
- **Estados y Dominio:**
  - `.ui-badge` (`[data-tone="success|warning|danger|info|neutral|brand"]`, `[data-size="sm"]`).
  - `.ui-cloud-badge` + `.ui-cloud-dot` (`[data-sync-state="online|syncing|local|error"]`; pulso exclusivo en `syncing`, detenido bajo `prefers-reduced-motion`).
  - `.ui-role-badge` (`[data-role="ADMIN|RECEPCION"]`).
  - `.ui-saldo-box` (`[data-state="paid|debt"]`).
  - `.ui-belt-avatar` (`[data-belt="white|blue|purple|brown|black|competitor|kids"]`, `[data-size="sm"]`).
  - `.ui-dropdown` / `.autocomplete-dropdown` + `.ui-dropdown-item` (`overscroll-behavior: contain`).
  - `.ui-table-wrap`, `.ui-table`, `.ui-row-anulado` (sin tachado sobre la columna final de acciones).
  - `.ui-modal-backdrop` (`[data-priority="critical"]`), `.ui-modal-panel` (`[data-size="sm|md|lg|xl"]`), `.ui-modal-header`, `.ui-modal-body`, `.ui-modal-footer`.
  - `.ui-toast-container`, `.ui-toast` (`[data-tone="success|warning|error|info"]`, `[data-closing="true"]`).
- **Movimiento y Foco:** Transiciones declaradas por propiedad explícita (`150ms–280ms`, `cubic-bezier(0.2, 0, 0, 1)`), anillo `:focus-visible` de `2px`, áreas táctiles `>= 44px` en móvil y `@media print` dedicado a `#print-receipt-area`.

## Do's and Don'ts

### Do:
- **Do** usar exclusivamente variables de `src/css/tokens.css` y clases semánticas `.ui-*` + atributos `[data-*]` para gobernar tema, marca y estado.
- **Do** mantener `font-size: 1rem` (`16px`) en todos los `.ui-input` y `.ui-select`, y `min-height: 44px` en todos los controles interactivos móviles.
- **Do** aplicar `font-variant-numeric: tabular-nums` (`.ui-mono` / `.ui-tabular` / `.ui-cell-mono`) en precios, saldos, fechas y números de recibo.
- **Do** declarar transiciones con propiedades explícitas (`background-color`, `border-color`, `color`, `opacity`, `transform`) y respetar `prefers-reduced-motion: reduce`.
- **Do** preservar `overscroll-behavior: contain` en modales y menús desplegables y `env(safe-area-inset-bottom)` en la barra móvil inferior.

### Don't:
- **Don't** escribir `body.light-theme`, clases de utilidad oscuras sobrescritas ni una sola regla `!important` para forzar contraste.
- **Don't** usar `transition: all` ni animaciones decorativas continuas fuera del estado `[data-sync-state="syncing"]`.
- **Don't** colocar kickers/eyebrows en ALL-CAPS sobre encabezados, texto en gradiente ni barras gruesas de borde en un solo lado de tarjetas redondeadas.
- **Don't** ocultar el contorno de foco (`outline: none`) sin un reemplazo visible de `:focus-visible`.
- **Don't** anidar tarjetas con sombras elevadas dentro de otras tarjetas o modales; usar `.ui-card-subtle` plano.
