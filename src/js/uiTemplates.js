/**
 * PLANTILLAS PURAS DE INTERFAZ (UI TEMPLATES) — DOJO PRECISION
 * Renderizado modular zero-build sobre clases semánticas .ui-* y atributos data-*.
 * Cero handlers inline, cero clases Tailwind de color/superficie.
 */
(function (global) {
  'use strict';

  function escapeHTML(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeId(val) {
    if (global.GymStore && typeof global.GymStore.sanitizarId === 'function') {
      return global.GymStore.sanitizarId(val);
    }
    return String(val ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function obtenerEstiloCinturon(grado = '') {
    const g = String(grado || '').toLowerCase();
    if (g.includes('azul')) {
      return { belt: 'blue', label: '🔵 Cinturón Azul' };
    }
    if (g.includes('morado')) {
      return { belt: 'purple', label: '🟣 Cinturón Morado' };
    }
    if (g.includes('marrón') || g.includes('marron')) {
      return { belt: 'brown', label: '🟤 Cinturón Marrón' };
    }
    if (g.includes('negro')) {
      return { belt: 'black', label: '⚫ Cinturón Negro' };
    }
    if (g.includes('competidor')) {
      return { belt: 'competitor', label: '🔴 Competidor' };
    }
    if (g.includes('infantil') || g.includes('kids')) {
      return { belt: 'kids', label: '🟢 Infantil / Kids' };
    }
    return { belt: 'white', label: '⚪ Principiante / Blanco' };
  }

  function obtenerIniciales(nombres = '', apellidos = '') {
    const n = String(nombres || '').trim().charAt(0).toUpperCase();
    const a = String(apellidos || '').trim().charAt(0).toUpperCase();
    return (n + a) || '🥋';
  }

  function resolveFormatDatePE(helpers) {
    if (helpers && typeof helpers.formatDatePE === 'function') {
      return helpers.formatDatePE;
    }
    if (global.GymStore && typeof global.GymStore.formatDatePE === 'function') {
      return global.GymStore.formatDatePE;
    }
    return (val) => (val ? String(val) : '—');
  }

  function resolveFormatDateTimePE(helpers) {
    if (helpers && typeof helpers.formatDateTimePE === 'function') {
      return helpers.formatDateTimePE;
    }
    if (global.GymStore && typeof global.GymStore.formatDateTimePE === 'function') {
      return global.GymStore.formatDateTimePE;
    }
    return (val) => (val ? String(val) : '—');
  }

  function resolveMetodoLabels(helpers) {
    if (helpers && helpers.METODO_LABELS) {
      return helpers.METODO_LABELS;
    }
    if (global.ReceiptGenerator && global.ReceiptGenerator.METODO_LABELS) {
      return global.ReceiptGenerator.METODO_LABELS;
    }
    return {};
  }

  function getNombreCompletoAlumno(alu) {
    if (!alu) return 'Alumno';
    if (alu.nombre_completo) return String(alu.nombre_completo);
    return `${alu.nombres || ''} ${alu.apellidos || ''}`.trim() || 'Alumno';
  }

  function toastContent(mensaje) {
    return `<span>${escapeHTML(mensaje)}</span>`;
  }

  function cloudBadgeInner(estado, texto) {
    return `<span class="ui-cloud-dot" aria-hidden="true"></span><span>${escapeHTML(texto)}</span>`;
  }

  function optionsOperadoresFiltro(operadores = [], recibos = [], filtroActual = 'TODOS') {
    const operadoresCaja = [];
    (Array.isArray(operadores) ? operadores : []).forEach((op) => {
      const val = String(op || '').trim();
      if (val && val.toUpperCase() !== 'OTRO' && !operadoresCaja.some((x) => x.toLowerCase() === val.toLowerCase())) {
        operadoresCaja.push(val);
      }
    });

    (Array.isArray(recibos) ? recibos : []).forEach((r) => {
      const cob = String(r?.cobrado_por || '').trim();
      if (cob && !operadoresCaja.some((x) => x.toLowerCase() === cob.toLowerCase())) {
        operadoresCaja.push(cob);
      }
    });

    const actualNorm = String(filtroActual || 'TODOS').trim().toLowerCase();
    const matchOperador = operadoresCaja.find((op) => op.toLowerCase() === actualNorm);
    const selectedTodos = !matchOperador ? ' selected' : '';

    return (
      `<option value="TODOS"${selectedTodos}>Todos los operadores</option>` +
      operadoresCaja
        .map((op) => {
          const selected = matchOperador && op === matchOperador ? ' selected' : '';
          return `<option value="${escapeHTML(op)}"${selected}>👤 ${escapeHTML(op)}</option>`;
        })
        .join('')
    );
  }

  function emptyState(opts = {}) {
    const { iconHtml, title, text } = opts || {};
    const defaultSvg =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>';
    const iconBlock =
      iconHtml === '' || iconHtml === null
        ? ''
        : `<div class="flex items-center justify-center" style="color: var(--text-muted); margin-bottom: 0.5rem;">${iconHtml || defaultSvg}</div>`;
    const titleBlock = title
      ? `<p class="font-bold text-sm" style="color: var(--text-primary); margin: 0;">${escapeHTML(title)}</p>`
      : '';
    const textBlock = text
      ? `<p class="${title ? 'text-xs' : 'text-sm'}" style="color: var(--text-secondary); margin: ${title ? '0.25rem 0 0' : '0'};">${escapeHTML(text)}</p>`
      : '';
    return `<div class="ui-empty-state">${iconBlock}${titleBlock}${textBlock}</div>`;
  }

  function alertaVencimientoItem(alu, helpers = {}) {
    const fmtDate = resolveFormatDatePE(helpers);
    const { generarLinkWhatsAppRecordatorio, config } = helpers || {};
    const mem = alu?.ultima_membresia || null;
    const dias = Number(alu?.dias_restantes ?? 0);
    const esVencido = dias < 0;

    const badgeHtml = esVencido
      ? `<span class="ui-badge ui-tabular" data-tone="danger">🔴 Venció hace ${Math.abs(dias)} día(s)</span>`
      : dias === 0
      ? `<span class="ui-badge ui-tabular" data-tone="warning">🟡 Vence HOY</span>`
      : `<span class="ui-badge ui-tabular" data-tone="warning">🟡 Vence en ${dias} día(s)</span>`;

    const waLink =
      typeof generarLinkWhatsAppRecordatorio === 'function'
        ? generarLinkWhatsAppRecordatorio(alu, config || {}, 'VENCIMIENTO')
        : '#';

    return `
      <div class="ui-list-row">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-extrabold text-sm" style="color: var(--text-primary);">${escapeHTML(getNombreCompletoAlumno(alu))}</span>
            ${badgeHtml}
          </div>
          <p class="text-xs ui-tabular" style="color: var(--text-secondary); margin: 0.25rem 0 0;">
            ${mem ? `${escapeHTML(mem.concepto)} • Vence el: <strong style="color: var(--text-primary);">${escapeHTML(fmtDate(mem.fecha_fin))}</strong>` : ''}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <a
            href="${escapeHTML(waLink)}"
            target="_blank"
            rel="noopener noreferrer"
            title="Enviar recordatorio por WhatsApp"
            class="ui-btn"
            data-variant="whatsapp"
            data-size="sm"
          >
            <i data-lucide="message-circle" class="w-4 h-4" aria-hidden="true"></i>
            <span>Avisar</span>
          </a>
          <button
            type="button"
            data-action="renovar-alumno"
            data-id="${safeId(alu?.id)}"
            class="ui-btn"
            data-variant="primary"
            data-size="sm"
          >
            Cobrar Mes
          </button>
        </div>
      </div>`;
  }

  function alertaSaldoItem(mem, alu, moneda = 'S/', helpers = {}) {
    const { generarLinkWhatsAppRecordatorio, config } = helpers || {};
    const mon = escapeHTML(moneda || 'S/');
    const alumno = alu || {
      id: mem?.alumno_id || '',
      nombres: 'Alumno',
      apellidos: '',
      nombre_completo: 'Alumno'
    };
    const waLink =
      typeof generarLinkWhatsAppRecordatorio === 'function'
        ? generarLinkWhatsAppRecordatorio(alumno, config || {}, 'SALDO', mem)
        : '#';

    return `
      <div class="ui-list-row">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-extrabold text-sm" style="color: var(--text-primary);">${escapeHTML(getNombreCompletoAlumno(alumno))}</span>
            <span class="ui-badge ui-tabular" data-tone="warning">⚠️ Debe ${mon} ${Number(mem?.saldo_pendiente || 0).toFixed(2)}</span>
          </div>
          <p class="text-xs ui-tabular" style="color: var(--text-secondary); margin: 0.25rem 0 0;">
            ${escapeHTML(mem?.concepto || '')} • Total: ${mon} ${Number(mem?.total_a_pagar || 0).toFixed(2)} (Ya pagó: ${mon} ${Number(mem?.monto_pagado_acumulado || 0).toFixed(2)})
          </p>
        </div>
        <div class="flex items-center gap-2">
          <a
            href="${escapeHTML(waLink)}"
            target="_blank"
            rel="noopener noreferrer"
            title="Enviar recordatorio por WhatsApp"
            class="ui-btn"
            data-variant="whatsapp"
            data-size="sm"
          >
            <i data-lucide="message-circle" class="w-4 h-4" aria-hidden="true"></i>
            <span>WhatsApp</span>
          </a>
          <button
            type="button"
            data-action="cobrar-saldo"
            data-id="${safeId(mem?.id)}"
            class="ui-btn"
            data-variant="warning"
            data-size="sm"
          >
            Cobrar Saldo
          </button>
        </div>
      </div>`;
  }

  function auditoriaItem(act, helpers = {}) {
    const fmtDateTime = resolveFormatDateTimePE(helpers);
    return `
      <div class="ui-audit-row">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="ui-badge" data-tone="neutral" data-size="sm">${escapeHTML(act?.actor || 'Sistema')}</span>
          <span class="font-extrabold" style="color: var(--text-primary);">${escapeHTML(act?.accion || '')}</span>
          <span class="ui-truncate" style="color: var(--text-secondary);">${escapeHTML(act?.detalle || '')}</span>
        </div>
        <span class="ui-tabular" style="color: var(--text-muted); white-space: nowrap;">${escapeHTML(fmtDateTime(act?.fecha))}</span>
      </div>`;
  }

  function filaRecibo(r, moneda = 'S/', compacto = false, helpers = {}) {
    const fmtDate = resolveFormatDatePE(helpers);
    const fmtDateTime = resolveFormatDateTimePE(helpers);
    const metodoLabels = resolveMetodoLabels(helpers);
    const mon = escapeHTML(moneda || 'S/');
    const m = r?.membresia || {};
    const saldo = Number(m.saldo_pendiente || 0);
    const metodoTexto = metodoLabels[r?.metodo_pago] || r?.metodo_pago || '';

    const badgeSaldo = r?.anulado
      ? '<span class="ui-badge" data-tone="danger" data-size="sm">ANULADO</span>'
      : saldo > 0
      ? `<span class="ui-badge ui-tabular" data-tone="warning" data-size="sm">Debe ${mon} ${saldo.toFixed(2)}</span>`
      : '<span class="ui-badge" data-tone="success" data-size="sm">No debe nada</span>';

    const fechaFinHtml =
      m.tipo_operacion === 'SOLO_INSCRIPCION'
        ? '<span class="ui-badge" data-tone="success" data-size="sm">PAGO ÚNICO (INSCRITO)</span>'
        : escapeHTML(fmtDate(m.fecha_fin));

    return `
      <tr class="${r?.anulado ? 'ui-row-anulado' : ''}">
        <td class="ui-cell-mono font-extrabold" style="color: var(--status-success-text);">
          #${escapeHTML(r?.numero_recibo || '')}
        </td>
        ${
          !compacto
            ? `<td class="ui-cell-mono text-xs" style="color: var(--text-secondary);">${escapeHTML(fmtDateTime(r?.fecha_pago))}</td>`
            : ''
        }
        <td>
          <button
            type="button"
            data-action="ver-historial"
            data-id="${safeId(r?.alumno_id)}"
            class="font-extrabold text-left cursor-pointer"
            style="background: transparent; border: 0; padding: 0; color: var(--text-primary); font-family: inherit;"
          >
            ${escapeHTML(r?.nombre_completo || 'Alumno')}
          </button>
        </td>
        <td class="text-xs font-semibold" style="color: var(--text-secondary);">${escapeHTML(m.concepto || 'Membresía')}</td>
        <td class="ui-cell-mono text-xs font-bold">${escapeHTML(fmtDate(m.fecha_inicio))}</td>
        <td class="ui-cell-mono text-xs font-bold" style="color: ${m.tipo_operacion === 'SOLO_INSCRIPCION' ? 'var(--status-success-text)' : 'var(--status-danger-text)'};">${fechaFinHtml}</td>
        <td class="ui-cell-mono text-right font-bold">${mon} ${Number(m.total_a_pagar || 0).toFixed(2)}</td>
        <td class="ui-cell-mono text-right font-extrabold" style="color: var(--status-success-text);">${mon} ${Number(r?.monto_abonado || 0).toFixed(2)}</td>
        <td class="text-right" style="white-space: nowrap;">${badgeSaldo}</td>
        ${
          !compacto
            ? `<td class="text-center" style="white-space: nowrap;">
                <span class="ui-badge" data-tone="neutral" data-size="sm">
                  ${escapeHTML(metodoTexto)}
                </span>
              </td>`
            : ''
        }
        <td class="text-center" style="white-space: nowrap;">
          <span class="ui-badge" data-tone="info" data-size="sm">
            👤 ${escapeHTML(r?.cobrado_por || 'Recepción')}
          </span>
        </td>
        <td class="text-center" style="white-space: nowrap;">
          <div class="inline-flex items-center gap-2">
            <button
              type="button"
              data-action="ver-comprobante"
              data-id="${safeId(r?.id)}"
              title="Ver Comprobante Digital / Enviar por WhatsApp"
              class="ui-btn"
              data-variant="sky"
              data-size="sm"
            >
              Recibo Digital
            </button>
            ${
              !r?.anulado && saldo > 0
                ? `<button
                    type="button"
                    data-action="cobrar-saldo"
                    data-id="${safeId(m.id)}"
                    title="Cobrar lo que debe de esta membresía"
                    class="ui-btn"
                    data-variant="warning"
                    data-size="sm"
                  >
                    Cobrar Saldo
                  </button>`
                : ''
            }
            ${
              !compacto
                ? `<button
                    type="button"
                    data-action="editar-recibo"
                    data-id="${safeId(r?.id)}"
                    title="Editar recibo o corregir fechas/montos (Admin)"
                    class="ui-btn"
                    data-variant="secondary"
                    data-size="sm"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    data-action="toggle-anular-recibo"
                    data-id="${safeId(r?.id)}"
                    title="${r?.anulado ? 'Reactivar recibo' : 'Anular recibo'}"
                    class="ui-btn"
                    data-variant="${r?.anulado ? 'success' : 'danger'}"
                    data-size="sm"
                  >
                    ${r?.anulado ? 'Reactivar' : 'Anular'}
                  </button>`
                : ''
            }
          </div>
        </td>
      </tr>`;
  }

  function tarjetaAlumno(a, moneda = 'S/', helpers = {}) {
    const fmtDate = resolveFormatDatePE(helpers);
    const mon = escapeHTML(moneda || 'S/');
    const mem = a?.ultima_membresia || null;
    const belt = obtenerEstiloCinturon(a?.grado_cinturon);
    const iniciales = obtenerIniciales(a?.nombres, a?.apellidos);
    const saldoPendiente = Number(a?.saldo_total_pendiente || 0);
    const tieneDeuda = saldoPendiente > 0;
    const dias = Number(a?.dias_restantes ?? 0);

    let badgePrincipalHtml = '<span class="ui-badge" data-tone="neutral">⚪ SIN MENSUALIDAD ACTIVA</span>';

    if (a?.estado_vigencia === 'ACTIVO') {
      badgePrincipalHtml = tieneDeuda
        ? `<span class="ui-badge ui-tabular" data-tone="success">🟢 VIGENTE (${dias}d)</span>`
        : `<span class="ui-badge ui-tabular" data-tone="success">🟢 VIGENTE • SIN DEUDA (${dias}d)</span>`;
    } else if (a?.estado_vigencia === 'SOLO_INSCRITO') {
      badgePrincipalHtml = a.proxima_membresia
        ? `<span class="ui-badge ui-tabular" data-tone="info">⏳ INICIA EL ${escapeHTML(fmtDate(a.proxima_membresia.fecha_inicio))}</span>`
        : '<span class="ui-badge" data-tone="info">🎓 INSCRITO • FALTA PAGAR 1ER MES</span>';
    } else if (a?.estado_vigencia === 'POR_VENCER') {
      badgePrincipalHtml = `<span class="ui-badge ui-tabular" data-tone="warning">🟡 POR VENCER • En ${dias} día(s)</span>`;
    } else if (a?.estado_vigencia === 'VENCIDO') {
      badgePrincipalHtml = a.proxima_membresia
        ? `<span class="ui-badge ui-tabular" data-tone="danger">🔴 HUECO SIN VIGENCIA • PRÓX. ${escapeHTML(fmtDate(a.proxima_membresia.fecha_inicio))}</span>`
        : `<span class="ui-badge ui-tabular" data-tone="danger">🔴 MENSUALIDAD VENCIDA • Hace ${Math.abs(dias)} día(s)</span>`;
    }

    const badgeDeudaHtml = tieneDeuda
      ? '<span class="ui-badge" data-tone="warning">⚠️ DEBE SALDO</span>'
      : '';

    const badgeInscripcionHtml =
      a?.inscripcion_pagada !== false
        ? '<span class="ui-badge" data-tone="success" data-size="sm">🎓 Inscrito</span>'
        : '<span class="ui-badge" data-tone="warning" data-size="sm">⚠️ Sin Inscripción</span>';

    const memConDeuda = (a?.membresias_historial || []).find((m) => Number(m.saldo_pendiente) > 0);
    const vigenciaPeriodoHtml = mem
      ? `${escapeHTML(fmtDate(mem.fecha_inicio))} al <strong style="color: var(--status-danger-text);">${escapeHTML(fmtDate(mem.fecha_fin))}</strong>${
          a?.proxima_membresia && a.proxima_membresia.id !== mem.id
            ? `<br><span style="color: var(--status-info-text);">⏳ Próx: ${escapeHTML(fmtDate(a.proxima_membresia.fecha_inicio))} al ${escapeHTML(fmtDate(a.proxima_membresia.fecha_fin))}</span>`
            : ''
        }`
      : 'Pendiente de iniciar mes';

    return `
      <div class="ui-card flex flex-col justify-between gap-4" style="padding: 1.25rem;">
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              ${badgePrincipalHtml}
              ${badgeDeudaHtml}
            </div>
            ${badgeInscripcionHtml}
          </div>

          <div class="flex items-center gap-3">
            <div class="ui-belt-avatar" data-belt="${escapeHTML(belt.belt)}">
              ${escapeHTML(iniciales)}
            </div>
            <div class="min-w-0 flex-1">
              <button
                type="button"
                data-action="ver-historial"
                data-id="${safeId(a?.id)}"
                class="font-extrabold text-base text-left ui-truncate block w-full cursor-pointer"
                style="background: transparent; border: 0; padding: 0; color: var(--text-primary); font-family: inherit;"
              >
                ${escapeHTML(getNombreCompletoAlumno(a))}
              </button>
              <p class="text-xs font-bold" style="color: var(--text-secondary); margin: 0.125rem 0 0;">${escapeHTML(belt.label)}</p>
              <p class="text-xs font-bold ui-truncate" style="color: var(--status-info-text); margin: 0.125rem 0 0;">🕒 ${escapeHTML(a?.horario_texto || 'Sin horario asignado')}</p>
              ${
                a?.telefono_whatsapp
                  ? `<p class="text-xs ui-tabular" style="color: var(--text-secondary); margin: 0.125rem 0 0;">📱 WhatsApp: <strong style="color: var(--text-primary);">${escapeHTML(a.telefono_whatsapp)}</strong></p>`
                  : ''
              }
            </div>
          </div>

          <div class="ui-card-subtle space-y-2 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold" style="color: var(--text-secondary);">Último Plan:</span>
              <span class="font-extrabold text-right" style="color: var(--text-primary);">${mem ? escapeHTML(mem.concepto) : a?.estado_vigencia === 'SOLO_INSCRITO' ? 'Solo Matrícula / Inscripción' : '—'}</span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold" style="color: var(--text-secondary);">Vigencia del Mes:</span>
              <span class="font-bold ui-tabular text-right" style="color: var(--text-primary);">${vigenciaPeriodoHtml}</span>
            </div>
            <div class="flex items-center justify-between gap-2" style="padding-top: 0.375rem; border-top: 1px solid var(--border-subtle);">
              <span class="font-bold" style="color: var(--text-secondary);">Lo que debe (Saldo):</span>
              ${
                tieneDeuda
                  ? `<span class="text-sm font-extrabold ui-tabular" style="color: var(--status-warning-text);">⚠️ Debe ${mon} ${saldoPendiente.toFixed(2)}</span>`
                  : `<span class="font-extrabold ui-tabular" style="color: var(--status-success-text);">✅ No debe nada (${mon} 0.00)</span>`
              }
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2" style="padding-top: 0.5rem; border-top: 1px solid var(--border-subtle);">
          <button
            type="button"
            data-action="ver-historial"
            data-id="${safeId(a?.id)}"
            class="ui-btn"
            data-variant="secondary"
            data-size="sm"
          >
            📄 Ficha (${Number(a?.total_membresias || 0)})
          </button>
          <button
            type="button"
            data-action="editar-alumno"
            data-id="${safeId(a?.id)}"
            title="Cambiar Horario, Cinturón o Datos del Alumno"
            class="ui-btn"
            data-variant="secondary"
            data-size="sm"
          >
            ✏️ Horario / Datos
          </button>
          ${
            memConDeuda
              ? `<button
                  type="button"
                  data-action="cobrar-saldo"
                  data-id="${safeId(memConDeuda.id)}"
                  class="ui-btn"
                  data-variant="warning"
                  data-size="sm"
                >
                  💰 Deuda
                </button>`
              : ''
          }
          <button
            type="button"
            data-action="renovar-alumno"
            data-id="${safeId(a?.id)}"
            class="ui-btn flex-1"
            data-variant="primary"
            data-size="sm"
          >
            ${a?.estado_vigencia === 'SOLO_INSCRITO' && !a?.proxima_membresia ? '🥊 Cobrar 1er Mes' : '🥊 Cobrar Mes'}
          </button>
        </div>
      </div>`;
  }

  function filaAlumnoTabla(a, moneda = 'S/', helpers = {}) {
    const fmtDate = resolveFormatDatePE(helpers);
    const mon = escapeHTML(moneda || 'S/');
    const mem = a?.ultima_membresia || null;
    const dias = Number(a?.dias_restantes ?? 0);
    const saldoPendiente = Number(a?.saldo_total_pendiente || 0);

    let badgeVigencia = '<span class="ui-badge" data-tone="neutral">Sin membresía</span>';
    if (a?.estado_vigencia === 'ACTIVO') {
      badgeVigencia = `<span class="ui-badge ui-tabular" data-tone="success">🟢 Vigente (${dias}d)</span>`;
    } else if (a?.estado_vigencia === 'SOLO_INSCRITO') {
      badgeVigencia = a.proxima_membresia
        ? `<span class="ui-badge ui-tabular" data-tone="info">⏳ Inicia ${escapeHTML(fmtDate(a.proxima_membresia.fecha_inicio))}</span>`
        : '<span class="ui-badge" data-tone="info">🎓 Inscrito (Falta 1er Mes)</span>';
    } else if (a?.estado_vigencia === 'POR_VENCER') {
      badgeVigencia = `<span class="ui-badge ui-tabular" data-tone="warning">🟡 Vence en ${dias}d</span>`;
    } else if (a?.estado_vigencia === 'VENCIDO') {
      badgeVigencia = `<span class="ui-badge ui-tabular" data-tone="danger">🔴 Vencido (${Math.abs(dias)}d)</span>`;
    }

    const badgeInscrito =
      a?.inscripcion_pagada !== false
        ? '<span class="ui-badge" data-tone="success" data-size="sm">🎓 Inscrito</span>'
        : '<span class="ui-badge" data-tone="warning" data-size="sm">⚠️ Sin inscripción</span>';

    const saldoHtml =
      saldoPendiente > 0
        ? `<span class="font-extrabold ui-tabular" style="color: var(--status-warning-text);">Debe ${mon} ${saldoPendiente.toFixed(2)}</span>`
        : '<span class="font-bold ui-tabular" style="color: var(--status-success-text);">No debe nada</span>';

    return `
      <tr>
        <td>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-action="ver-historial"
              data-id="${safeId(a?.id)}"
              class="font-bold text-left cursor-pointer"
              style="background: transparent; border: 0; padding: 0; color: var(--text-primary); font-family: inherit;"
            >
              ${escapeHTML(getNombreCompletoAlumno(a))}
            </button>
            ${badgeInscrito}
          </div>
          <span class="text-xs" style="color: var(--text-muted);">${Number(a?.total_membresias || 0)} registro(s)</span>
        </td>
        <td class="text-xs">
          <div class="font-semibold" style="color: var(--text-primary);">${escapeHTML(a?.grado_cinturon || 'Principiante')}</div>
          <div class="font-bold" style="color: var(--status-info-text); margin-top: 0.125rem;">🕒 ${escapeHTML(a?.horario_texto || 'Sin horario')}</div>
        </td>
        <td class="text-xs ui-tabular" style="color: var(--text-secondary);">
          <div class="ui-cell-mono">${a?.telefono_whatsapp ? escapeHTML(a.telefono_whatsapp) : '—'}</div>
          ${a?.contacto_emergencia ? `<div style="color: var(--text-muted);">Emerg: ${escapeHTML(a.contacto_emergencia)}</div>` : ''}
        </td>
        <td class="text-xs font-semibold">${mem ? escapeHTML(mem.concepto) : a?.estado_vigencia === 'SOLO_INSCRITO' ? 'Solo Inscripción' : '—'}</td>
        <td class="ui-cell-mono text-xs font-semibold">${mem ? escapeHTML(fmtDate(mem.fecha_inicio)) : '—'}</td>
        <td class="ui-cell-mono text-xs font-semibold" style="color: var(--status-danger-text);">${mem ? escapeHTML(fmtDate(mem.fecha_fin)) : '—'}</td>
        <td class="text-center" style="white-space: nowrap;">${badgeVigencia}</td>
        <td class="text-right" style="white-space: nowrap;">${saldoHtml}</td>
        <td class="text-center" style="white-space: nowrap;">
          <div class="inline-flex items-center gap-2">
            <button
              type="button"
              data-action="editar-alumno"
              data-id="${safeId(a?.id)}"
              title="Cambiar horario, cinturón o datos"
              aria-label="Editar alumno y cambiar horario o cinturón"
              class="ui-btn"
              data-variant="secondary"
              data-size="sm"
            >
              ✏️
            </button>
            <button
              type="button"
              data-action="ver-historial"
              data-id="${safeId(a?.id)}"
              class="ui-btn"
              data-variant="secondary"
              data-size="sm"
            >
              Ver Ficha
            </button>
            <button
              type="button"
              data-action="renovar-alumno"
              data-id="${safeId(a?.id)}"
              class="ui-btn"
              data-variant="primary"
              data-size="sm"
            >
              ${a?.estado_vigencia === 'SOLO_INSCRITO' && !a?.proxima_membresia ? '+ 1er Mes' : 'Cobrar Mes'}
            </button>
          </div>
        </td>
      </tr>`;
  }

  function filaAlumnoHorario(alu, moneda = 'S/', helpers = {}) {
    const fmtDate = resolveFormatDatePE(helpers);
    const mon = escapeHTML(moneda || 'S/');
    const belt = obtenerEstiloCinturon(alu?.grado_cinturon);
    const dias = Number(alu?.dias_restantes ?? 0);
    const saldoPendiente = Number(alu?.saldo_total_pendiente || 0);

    let badgeEstado = '<span class="ui-badge" data-tone="neutral" data-size="sm">Sin plan</span>';
    if (alu?.estado_vigencia === 'ACTIVO') {
      badgeEstado = `<span class="ui-badge ui-tabular" data-tone="success" data-size="sm">🟢 Vigente (${dias}d)</span>`;
    } else if (alu?.estado_vigencia === 'SOLO_INSCRITO') {
      badgeEstado = alu.proxima_membresia
        ? `<span class="ui-badge ui-tabular" data-tone="info" data-size="sm">⏳ Inicia ${escapeHTML(fmtDate(alu.proxima_membresia.fecha_inicio))}</span>`
        : '<span class="ui-badge" data-tone="info" data-size="sm">🎓 Solo Inscrito</span>';
    } else if (alu?.estado_vigencia === 'POR_VENCER') {
      badgeEstado = `<span class="ui-badge ui-tabular" data-tone="warning" data-size="sm">🟡 Vence en ${dias}d</span>`;
    } else if (alu?.estado_vigencia === 'VENCIDO') {
      badgeEstado = `<span class="ui-badge ui-tabular" data-tone="danger" data-size="sm">🔴 Vencido (${Math.abs(dias)}d)</span>`;
    }

    return `
      <div class="ui-card-subtle flex flex-wrap items-center justify-between gap-2" style="padding: 0.75rem;">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="ui-belt-avatar" data-belt="${escapeHTML(belt.belt)}" data-size="sm">
            ${escapeHTML(obtenerIniciales(alu?.nombres, alu?.apellidos))}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                data-action="ver-historial"
                data-id="${safeId(alu?.id)}"
                class="font-bold text-xs text-left ui-truncate cursor-pointer"
                style="background: transparent; border: 0; padding: 0; color: var(--text-primary); font-family: inherit;"
              >
                ${escapeHTML(getNombreCompletoAlumno(alu))}
              </button>
              ${badgeEstado}
              ${
                saldoPendiente > 0
                  ? `<span class="ui-badge ui-tabular" data-tone="warning" data-size="sm">⚠️ Debe ${mon}${saldoPendiente.toFixed(0)}</span>`
                  : ''
              }
            </div>
            <p class="text-xs" style="color: var(--text-secondary); margin: 0.125rem 0 0;">${escapeHTML(belt.label)}${alu?.telefono_whatsapp ? ` • 📱 ${escapeHTML(alu.telefono_whatsapp)}` : ''}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            data-action="editar-alumno"
            data-id="${safeId(alu?.id)}"
            title="Cambiar de horario o editar datos"
            class="ui-btn"
            data-variant="secondary"
            data-size="sm"
          >
            ✏️ Cambiar Turno
          </button>
          <button
            type="button"
            data-action="renovar-alumno"
            data-id="${safeId(alu?.id)}"
            class="ui-btn"
            data-variant="primary"
            data-size="sm"
          >
            ${alu?.estado_vigencia === 'SOLO_INSCRITO' && !alu?.proxima_membresia ? '+ 1er Mes' : 'Cobrar Mes'}
          </button>
        </div>
      </div>`;
  }

  function grupoHorarioCard(h, alumnosDelGrupo = [], moneda = 'S/', helpers = {}) {
    const lista = Array.isArray(alumnosDelGrupo) ? alumnosDelGrupo : [];
    const cantAlDia = lista.filter((a) => a.estado_vigencia === 'ACTIVO').length;
    const cantAlerta = lista.filter(
      (a) => a.estado_vigencia === 'POR_VENCER' || a.estado_vigencia === 'SOLO_INSCRITO'
    ).length;
    const cantVencidos = lista.filter((a) => a.estado_vigencia === 'VENCIDO').length;

    return `
      <div class="ui-card space-y-3" style="padding: 1.25rem;">
        <div class="flex flex-wrap items-start justify-between gap-3" style="padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle);">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="ui-badge" data-tone="brand">🥋 ${escapeHTML(h?.disciplina || 'General')}</span>
              <span class="ui-badge" data-tone="info">📅 ${escapeHTML(h?.dias || '')}</span>
              <span class="ui-badge ui-tabular" data-tone="success">🕒 ${escapeHTML(h?.hora || '')}</span>
            </div>
            <h4 class="ui-card-title" style="margin-top: 0.5rem;">${escapeHTML(h?.nombre || '')}</h4>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="ui-badge ui-tabular" data-tone="neutral">👥 ${lista.length} Alumno(s)</span>
            <span class="ui-badge ui-tabular" data-tone="success">🟢 ${cantAlDia} Vigentes</span>
            ${
              cantAlerta > 0
                ? `<span class="ui-badge ui-tabular" data-tone="warning">🟡 ${cantAlerta} Alerta/Insc</span>`
                : ''
            }
            ${
              cantVencidos > 0
                ? `<span class="ui-badge ui-tabular" data-tone="danger">🔴 ${cantVencidos} Vencido(s)</span>`
                : ''
            }
          </div>
        </div>

        <div class="space-y-2">
          ${
            lista.length === 0
              ? `<div class="ui-card-subtle text-center text-xs" style="color: var(--text-secondary);">Aún no hay alumnos asignados a este turno.</div>`
              : lista.map((alu) => filaAlumnoHorario(alu, moneda, helpers)).join('')
          }
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2" style="padding-top: 0.5rem; border-top: 1px solid var(--border-subtle);">
          <button
            type="button"
            data-action="inscribir-en-horario"
            data-id="${safeId(h?.id)}"
            class="ui-btn"
            data-variant="primary"
            data-size="sm"
          >
            + Inscribir Alumno en este Turno
          </button>
          <div class="flex items-center gap-2">
            <button
              type="button"
              data-action="editar-horario"
              data-id="${safeId(h?.id)}"
              class="ui-btn"
              data-variant="secondary"
              data-size="sm"
            >
              Editar Horario
            </button>
            <button
              type="button"
              data-action="eliminar-horario"
              data-id="${safeId(h?.id)}"
              class="ui-btn"
              data-variant="danger"
              data-size="sm"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>`;
  }

  function bloqueSinHorarioCard(alumnosSinHorario = [], moneda = 'S/', helpers = {}) {
    const lista = Array.isArray(alumnosSinHorario) ? alumnosSinHorario : [];
    if (lista.length === 0) return '';

    return `
      <div class="ui-card space-y-3" style="padding: 1.25rem;">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="ui-card-title">⚪ Alumnos Pendientes de Asignar a un Horario (${lista.length})</h4>
            <p class="ui-card-subtitle">Haz clic en "✏️ Cambiar Turno" para elegir en qué horario entrenan</p>
          </div>
        </div>
        <div class="space-y-2">
          ${lista.map((alu) => filaAlumnoHorario(alu, moneda, helpers)).join('')}
        </div>
      </div>`;
  }

  function tarjetaPlan(p, moneda = 'S/') {
    const mon = escapeHTML(moneda || 'S/');
    return `
      <div class="ui-card-subtle flex flex-col justify-between gap-3" style="padding: 1.25rem;">
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="ui-badge" data-tone="brand">${escapeHTML(p?.disciplina || '')}</span>
            <span class="text-xs font-bold ui-tabular" style="color: var(--text-secondary);">${Number(p?.duracion_dias || 0)} días</span>
          </div>
          <h4 class="ui-card-title" style="margin-top: 0.625rem;">${escapeHTML(p?.nombre || '')}</h4>
          <p class="ui-mono text-2xl font-extrabold" style="color: var(--status-success-text); margin: 0.25rem 0 0;">${mon} ${Number(p?.precio_sugerido || 0).toFixed(2)}</p>
        </div>
        <div class="flex items-center justify-end gap-2" style="padding-top: 0.75rem; border-top: 1px solid var(--border-subtle);">
          <button
            type="button"
            data-action="editar-plan"
            data-id="${safeId(p?.id)}"
            class="ui-btn"
            data-variant="secondary"
            data-size="sm"
          >
            Editar Precio
          </button>
          <button
            type="button"
            data-action="eliminar-plan"
            data-id="${safeId(p?.id)}"
            class="ui-btn"
            data-variant="danger"
            data-size="sm"
          >
            Eliminar
          </button>
        </div>
      </div>`;
  }

  function optionsPlanes(planes = [], moneda = null) {
    const list = Array.isArray(planes) ? planes : [];
    const mon = escapeHTML(moneda || global.GymStore?.store?.state?.configuracion?.moneda || 'S/');
    return (
      list
        .map(
          (p) =>
            `<option value="${safeId(p.id)}">${escapeHTML(p.nombre)} — ${mon} ${Number(p.precio_sugerido || 0).toFixed(2)} (${Number(p.duracion_dias || 0)} días)</option>`
        )
        .join('') + '<option value="PERSONALIZADO">✍️ Otro monto / Plan personalizado</option>'
    );
  }

  function optionsHorarios(horarios = [], emptyLabel = '-- Sin horario asignado --') {
    const list = Array.isArray(horarios) ? horarios : [];
    const opts = list
      .map(
        (h) =>
          `<option value="${safeId(h.id)}">🕒 ${escapeHTML(h.hora)} (${escapeHTML(h.dias)}) — ${escapeHTML(h.nombre)}</option>`
      )
      .join('');
    if (emptyLabel === null || emptyLabel === false) {
      return opts;
    }
    return `${opts}<option value="">${escapeHTML(emptyLabel)}</option>`;
  }

  function optionsAlumnos(alumnos = [], helpers = {}) {
    const fmtDate = resolveFormatDatePE(helpers);
    const list = Array.isArray(alumnos) ? alumnos : [];
    return (
      '<option value="">-- Haz clic aquí para elegir al alumno --</option>' +
      list
        .map((a) => {
          const estadoTexto =
            a.proxima_membresia && !a.membresia_vigente && a.estado_vigencia === 'SOLO_INSCRITO'
              ? `Inicia: ${fmtDate(a.proxima_membresia.fecha_inicio)}`
              : a.ultima_membresia
              ? `Vence: ${fmtDate(a.ultima_membresia.fecha_fin)}`
              : a.estado_vigencia === 'SOLO_INSCRITO'
              ? '🎓 Inscrito - Falta pagar 1er Mes'
              : 'Sin mensualidad';
          return `<option value="${safeId(a.id)}">${escapeHTML(getNombreCompletoAlumno(a))} (${escapeHTML(estadoTexto)})</option>`;
        })
        .join('')
    );
  }

  function optionsDeudores(memsConDeuda = [], alumnos = [], moneda = 'S/') {
    const mems = Array.isArray(memsConDeuda) ? memsConDeuda : [];
    const alus = Array.isArray(alumnos) ? alumnos : [];
    const mon = escapeHTML(moneda || 'S/');
    return mems
      .map((m) => {
        const alu = alus.find((a) => a.id === m.alumno_id);
        const nombre = alu ? getNombreCompletoAlumno(alu) : 'Alumno';
        return `<option value="${safeId(m.id)}">${escapeHTML(nombre)} — Debe ${mon} ${Number(m.saldo_pendiente || 0).toFixed(2)} (${escapeHTML(m.concepto)})</option>`;
      })
      .join('');
  }

  function sugerenciasAlumnosLista(filtrados = [], filtroTexto = '', helpers = {}) {
    const fmtDate = resolveFormatDatePE(helpers);
    const list = Array.isArray(filtrados) ? filtrados : [];

    if (list.length === 0) {
      return `<div class="ui-empty-state" style="padding: 0.75rem 1rem; font-size: var(--text-xs);">No se encontraron alumnos con "${escapeHTML(filtroTexto || '')}".</div>`;
    }

    return list
      .slice(0, 15)
      .map((a) => {
        const estadoTexto =
          a.proxima_membresia && !a.membresia_vigente && a.estado_vigencia === 'SOLO_INSCRITO'
            ? `Inicia: ${fmtDate(a.proxima_membresia.fecha_inicio)}`
            : a.ultima_membresia
            ? `Vence: ${fmtDate(a.ultima_membresia.fecha_fin)}`
            : a.estado_vigencia === 'SOLO_INSCRITO'
            ? '🎓 Inscrito - Sin mensualidad'
            : 'Sin mensualidad';

        return `
          <button
            type="button"
            data-pick-alumno="${safeId(a.id)}"
            class="ui-dropdown-item"
          >
            <div class="min-w-0 flex-1">
              <span class="block text-sm font-extrabold ui-truncate" style="color: var(--text-primary);">${escapeHTML(getNombreCompletoAlumno(a))}</span>
              <span class="block text-xs ui-truncate" style="color: var(--text-secondary);">${escapeHTML(a.horario_texto || 'Sin horario')} • ${escapeHTML(a.telefono_whatsapp || 'Sin celular')}</span>
            </div>
            <span class="ui-badge ui-tabular" data-tone="neutral" data-size="sm">${escapeHTML(estadoTexto)}</span>
          </button>`;
      })
      .join('');
  }

  function bannerVencimientoAnterior(alu, memBase, helpers = {}) {
    if (!alu || !memBase) return '';
    const fmtDate = resolveFormatDatePE(helpers);

    if (alu.membresia_vigente && alu.ultimo_contrato && alu.membresia_vigente.id !== alu.ultimo_contrato.id) {
      return `Vigente hasta: <strong style="color: var(--text-primary);">${escapeHTML(fmtDate(alu.membresia_vigente.fecha_fin))}</strong> • Próx. renovación termina: <strong style="color: var(--status-info-text);">${escapeHTML(fmtDate(alu.ultimo_contrato.fecha_fin))}</strong>`;
    }
    if (alu.proxima_membresia && !alu.membresia_vigente) {
      return `Próximo inicio: <strong style="color: var(--status-info-text);">${escapeHTML(fmtDate(alu.proxima_membresia.fecha_inicio))}</strong> • Termina: <strong style="color: var(--text-primary);">${escapeHTML(fmtDate(alu.proxima_membresia.fecha_fin))}</strong>`;
    }
    return `Último vencimiento: <strong style="color: var(--text-primary);">${escapeHTML(fmtDate(memBase.fecha_fin))}</strong>`;
  }

  function historialAlumnoContenido(alu, recibosAlumno = [], moneda = 'S/', helpers = {}) {
    const fmtDate = resolveFormatDatePE(helpers);
    const fmtDateTime = resolveFormatDateTimePE(helpers);
    const metodoLabels = resolveMetodoLabels(helpers);
    const mon = escapeHTML(moneda || 'S/');
    const mems = Array.isArray(alu?.membresias_historial) ? alu.membresias_historial : [];
    const recibos = Array.isArray(recibosAlumno) ? recibosAlumno : [];

    const htmlMembresias =
      mems.length === 0
        ? `<p class="text-xs" style="color: var(--text-secondary);">Sin membresías registradas.</p>`
        : mems
            .map((m) => {
              const estadoTone =
                m.estado_pago === 'PAGADO' ? 'success' : m.estado_pago === 'ANULADO' ? 'danger' : 'warning';
              const estadoLabel =
                m.estado_pago === 'PAGADO'
                  ? 'PAGADO COMPLETO'
                  : m.estado_pago === 'ANULADO'
                  ? 'ANULADO'
                  : 'DEBE SALDO';
              const saldoMem = Number(m.saldo_pendiente || 0);

              return `
                <div class="ui-card-subtle flex flex-wrap items-center justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-extrabold text-sm" style="color: var(--text-primary);">${escapeHTML(m.concepto)}</span>
                      <span class="ui-badge" data-tone="${estadoTone}" data-size="sm">${estadoLabel}</span>
                    </div>
                    <p class="text-xs ui-tabular" style="color: var(--text-secondary); margin: 0.25rem 0 0;">
                      ${
                        m.tipo_operacion === 'SOLO_INSCRIPCION'
                          ? `Fecha de Inscripción: <strong style="color: var(--text-primary);">${escapeHTML(fmtDate(m.fecha_inicio))}</strong> • <strong style="color: var(--status-success-text);">PAGO ÚNICO DE INSCRIPCIÓN</strong>`
                          : `Día que inicia: <strong style="color: var(--text-primary);">${escapeHTML(fmtDate(m.fecha_inicio))}</strong> • Día que vence: <strong style="color: var(--status-danger-text);">${escapeHTML(fmtDate(m.fecha_fin))}</strong>`
                      }
                    </p>
                  </div>
                  <div class="text-right ui-tabular">
                    <div class="text-xs" style="color: var(--text-secondary);">Total a Pagar: <strong style="color: var(--text-primary);">${mon} ${Number(m.total_a_pagar || 0).toFixed(2)}</strong></div>
                    <div class="text-xs ${saldoMem > 0 ? 'font-extrabold' : 'font-bold'}" style="color: ${saldoMem > 0 ? 'var(--status-warning-text)' : 'var(--status-success-text)'};">
                      Lo que debe: ${mon} ${saldoMem.toFixed(2)}
                    </div>
                    ${
                      saldoMem > 0
                        ? `<button
                            type="button"
                            data-action="cobrar-saldo"
                            data-id="${safeId(m.id)}"
                            data-close-modal="modal-historial-alumno"
                            class="ui-btn"
                            data-variant="warning"
                            data-size="sm"
                            style="margin-top: 0.375rem;"
                          >
                            Cobrar lo que debe
                          </button>`
                        : ''
                    }
                  </div>
                </div>`;
            })
            .join('');

    const htmlRecibos =
      recibos.length === 0
        ? `<p class="text-xs" style="color: var(--text-secondary);">Sin recibos emitidos.</p>`
        : recibos
            .map((r) => {
              const metodoTexto = metodoLabels[r.metodo_pago] || r.metodo_pago || '';
              const anuladoStyle = r.anulado
                ? 'background-color: var(--status-danger-bg); border-color: var(--status-danger-border); opacity: 0.78;'
                : '';
              const strikeStyle = r.anulado ? 'text-decoration: line-through;' : '';

              return `
                <div class="ui-card-subtle flex flex-wrap items-center justify-between gap-2" style="padding: 0.875rem; ${anuladoStyle}">
                  <div class="flex items-center gap-3 min-w-0 flex-1" style="${strikeStyle}">
                    <span class="ui-mono font-extrabold text-sm" style="color: var(--status-success-text);">#${escapeHTML(r.numero_recibo)}</span>
                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-bold" style="color: var(--text-primary); margin: 0;">${escapeHTML(r.observacion || r.membresia?.concepto || '')}</p>
                      <p class="text-xs ui-tabular" style="color: var(--text-secondary); margin: 0.125rem 0 0;">${escapeHTML(fmtDateTime(r.fecha_pago))} • ${escapeHTML(metodoTexto)}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    ${r.anulado ? '<span class="ui-badge" data-tone="danger" data-size="sm">ANULADO</span>' : ''}
                    <span class="ui-mono font-extrabold text-sm" style="color: var(--status-success-text); ${strikeStyle}">${mon} ${Number(r.monto_abonado || 0).toFixed(2)}</span>
                    <button
                      type="button"
                      data-action="ver-comprobante"
                      data-id="${safeId(r.id)}"
                      class="ui-btn"
                      data-variant="sky"
                      data-size="sm"
                    >
                      Ver Recibo
                    </button>
                  </div>
                </div>`;
            })
            .join('');

    return `
      <div class="flex flex-wrap items-center justify-between gap-2" style="padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle);">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            data-action="renovar-alumno"
            data-id="${safeId(alu?.id)}"
            data-close-modal="modal-historial-alumno"
            class="ui-btn"
            data-variant="primary"
            data-size="sm"
          >
            + Cobrar Nueva Mensualidad
          </button>
          <button
            type="button"
            data-action="editar-alumno"
            data-id="${safeId(alu?.id)}"
            data-close-modal="modal-historial-alumno"
            class="ui-btn"
            data-variant="secondary"
            data-size="sm"
          >
            ✏️ Cambiar Horario / Cinturón / Datos
          </button>
        </div>
        <button
          type="button"
          data-action="eliminar-alumno"
          data-id="${safeId(alu?.id)}"
          class="ui-btn"
          data-variant="danger"
          data-size="sm"
        >
          Eliminar Alumno
        </button>
      </div>
      <div>
        <h4 class="text-xs font-extrabold" style="color: var(--text-secondary); margin: 0 0 0.625rem;">Historial de Inscripción y Mensualidades (${mems.length})</h4>
        <div class="space-y-2">${htmlMembresias}</div>
      </div>
      <div>
        <h4 class="text-xs font-extrabold" style="color: var(--text-secondary); margin: 0 0 0.625rem;">Recibos Emitidos (${recibos.length})</h4>
        <div class="space-y-2">${htmlRecibos}</div>
      </div>`;
  }

  function busquedaGlobalContenido(alumnosMatch = [], recibosMatch = [], moneda = 'S/', helpers = {}) {
    const fmtDate = resolveFormatDatePE(helpers);
    const mon = escapeHTML(moneda || 'S/');
    const alumnos = Array.isArray(alumnosMatch) ? alumnosMatch : [];
    const recibos = Array.isArray(recibosMatch) ? recibosMatch : [];

    if (alumnos.length === 0 && recibos.length === 0) {
      const msg = helpers?.query
        ? `Sin resultados para "${helpers.query}"`
        : 'Sin resultados para tu búsqueda.';
      return emptyState({ text: msg });
    }

    let html = '';

    if (alumnos.length > 0) {
      html += '<div class="ui-dropdown-section">Alumnos Encontrados</div>';
      html += alumnos
        .map((a) => {
          const mem = a.ultima_membresia;
          let semaforoTone = 'neutral';
          let semaforoText = '⚪ SIN PLAN';

          if (a.estado_vigencia === 'ACTIVO') {
            semaforoTone = 'success';
            semaforoText = '🟢 VIGENTE';
          } else if (a.estado_vigencia === 'SOLO_INSCRITO') {
            semaforoTone = 'info';
            semaforoText = a.proxima_membresia
              ? `⏳ INICIA EL ${fmtDate(a.proxima_membresia.fecha_inicio)}`
              : '🎓 SOLO INSCRITO (FALTA 1ER MES)';
          } else if (a.estado_vigencia === 'POR_VENCER') {
            semaforoTone = 'warning';
            semaforoText = `🟡 VENCE EN ${Number(a.dias_restantes ?? 0)}D`;
          } else if (a.estado_vigencia === 'VENCIDO') {
            semaforoTone = 'danger';
            semaforoText = '🔴 VENCIDO';
          }

          const periodoDetalle = mem
            ? `${escapeHTML(mem.concepto)} • ${
                a.proxima_membresia && !a.membresia_vigente && a.estado_vigencia === 'SOLO_INSCRITO'
                  ? `Inicia: ${escapeHTML(fmtDate(mem.fecha_inicio))} al ${escapeHTML(fmtDate(mem.fecha_fin))}`
                  : `Vence: ${escapeHTML(fmtDate(mem.fecha_fin))}`
              }`
            : a.estado_vigencia === 'SOLO_INSCRITO'
            ? 'Inscrito (Pendiente 1ra Mensualidad)'
            : 'Sin membresía';

          const deudaDetalle =
            Number(a.saldo_total_pendiente || 0) > 0
              ? ` • <strong style="color: var(--status-warning-text);">Lo que debe: ${mon} ${Number(a.saldo_total_pendiente).toFixed(2)}</strong>`
              : '';

          return `
            <div class="ui-list-row">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-extrabold text-sm" style="color: var(--text-primary);">${escapeHTML(getNombreCompletoAlumno(a))}</span>
                  <span class="ui-badge" data-tone="${semaforoTone}" data-size="sm">${escapeHTML(semaforoText)}</span>
                </div>
                <p class="text-xs ui-tabular" style="color: var(--text-secondary); margin: 0.25rem 0 0;">
                  ${periodoDetalle}${deudaDetalle}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-action="ver-historial"
                  data-id="${safeId(a.id)}"
                  data-close-search="true"
                  class="ui-btn"
                  data-variant="secondary"
                  data-size="sm"
                >
                  Ver Ficha
                </button>
                <button
                  type="button"
                  data-action="renovar-alumno"
                  data-id="${safeId(a.id)}"
                  data-close-search="true"
                  class="ui-btn"
                  data-variant="primary"
                  data-size="sm"
                >
                  ${a.estado_vigencia === 'SOLO_INSCRITO' && !a.proxima_membresia ? '+ 1er Mes' : 'Cobrar Mes'}
                </button>
              </div>
            </div>`;
        })
        .join('');
    }

    if (recibos.length > 0) {
      html += '<div class="ui-dropdown-section">Recibos por Número</div>';
      html += recibos
        .map(
          (r) => `
            <div class="ui-list-row">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="ui-mono font-extrabold text-sm" style="color: var(--status-success-text);">#${escapeHTML(r.numero_recibo)}</span>
                  <span class="text-sm font-extrabold" style="color: var(--text-primary);">${escapeHTML(r.nombre_completo || 'Alumno')}</span>
                </div>
                <p class="text-xs ui-tabular" style="color: var(--text-secondary); margin: 0.25rem 0 0;">
                  ${escapeHTML(r.membresia?.concepto || '')} • Pagó: ${mon} ${Number(r.monto_abonado || 0).toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                data-action="ver-comprobante"
                data-id="${safeId(r.id)}"
                data-close-search="true"
                class="ui-btn"
                data-variant="sky"
                data-size="sm"
              >
                Ver Recibo
              </button>
            </div>`
        )
        .join('');
    }

    return html;
  }

  global.UITemplates = {
    escapeHTML,
    safeId,
    obtenerEstiloCinturon,
    obtenerIniciales,
    toastContent,
    cloudBadgeInner,
    optionsOperadoresFiltro,
    emptyState,
    alertaVencimientoItem,
    alertaSaldoItem,
    auditoriaItem,
    filaRecibo,
    tarjetaAlumno,
    filaAlumnoTabla,
    filaAlumnoHorario,
    grupoHorarioCard,
    bloqueSinHorarioCard,
    tarjetaPlan,
    optionsPlanes,
    optionsHorarios,
    optionsAlumnos,
    optionsDeudores,
    sugerenciasAlumnosLista,
    bannerVencimientoAnterior,
    historialAlumnoContenido,
    busquedaGlobalContenido
  };
})(window);
