/**
 * CONTROLADOR PRINCIPAL DE INTERFAZ (UI) - SISTEMA DE GIMNASIO DE ARTES MARCIALES
 */
(function (global) {
  const {
    store,
    getLocalDateISO,
    formatDatePE,
    formatDateTimePE,
    calcularFechaFin,
    addDaysISO
  } = global.GymStore;

  const {
    dibujarReciboEnCanvas,
    descargarCanvasComoPNG,
    copiarCanvasAlPortapapeles,
    generarLinkWhatsAppRecibo,
    generarLinkWhatsAppRecordatorio,
    METODO_LABELS
  } = global.ReceiptGenerator;

  const {
    exportarRecibosExcel,
    exportarAlumnosExcel,
    exportarBackupJSON
  } = global.ExcelExporter;

  const { probarConexionSupabase, subirDatosASupabase } = global.SupabaseSync;

  let tabActual = 'dashboard';
  let modoModalPago = 'NUEVO'; // 'NUEVO' | 'EXISTENTE'
  let reciboActualEnVisor = null;
  let ultimoTotalSincronizado = 0;

  function mostrarToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colores = {
      success: 'bg-emerald-600 border-emerald-400 text-white',
      warning: 'bg-amber-500 border-amber-300 text-slate-950',
      error: 'bg-red-600 border-red-400 text-white',
      info: 'bg-sky-600 border-sky-400 text-white'
    };
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all duration-300 ${colores[tipo] || colores.success}`;
    toast.innerHTML = `<span>${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 300);
    }, 3400);
  }

  function refreshIcons() {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }
  }

  function esAdmin() {
    return (store.state.configuracion.rol_actual || 'ADMIN') === 'ADMIN';
  }

  function cambiarTab(tabName) {
    if ((tabName === 'configuracion' || tabName === 'planes') && !esAdmin()) {
      mostrarToast('Se requiere clave de Administrador para entrar a esta sección', 'warning');
      abrirModal('modal-login-admin');
      setTimeout(() => document.getElementById('login-input-pin')?.focus(), 80);
      return;
    }
    tabActual = tabName;
    const tabs = ['dashboard', 'recibos', 'alumnos', 'planes', 'configuracion'];
    tabs.forEach((t) => {
      const sec = document.getElementById(`view-${t}`);
      if (sec) sec.classList.toggle('hidden', t !== tabName);
    });

    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      const isSelected = btn.getAttribute('data-tab') === tabName;
      btn.className = isSelected
        ? 'nav-tab-btn flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 border-red-500 text-red-400 whitespace-nowrap transition cursor-pointer'
        : 'nav-tab-btn flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 whitespace-nowrap transition cursor-pointer';
    });

    renderTodo();
  }

  function abrirModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function cerrarModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  // =========================================================================
  // RENDERIZADO GENERAL REACTIVO
  // =========================================================================
  function renderTodo() {
    const cfg = store.state.configuracion;
    const moneda = cfg.moneda || 'S/';

    // Cabecera
    document.getElementById('header-gym-name').textContent = cfg.nombre_academia || 'GIMNASIO ARTES MARCIALES';
    document.getElementById('header-gym-subtitle').textContent = cfg.subtitulo || 'Artes Marciales & Deportes de Contacto';
    document.getElementById('nav-badge-recibos').textContent = store.state.recibos.filter((r) => !r.anulado).length;
    document.getElementById('nav-badge-alumnos').textContent = store.state.alumnos.length;

    const badgeRol = document.getElementById('badge-rol-actual');
    const btnRol = document.getElementById('btn-cambiar-rol');
    if (badgeRol && btnRol) {
      if (esAdmin()) {
        badgeRol.textContent = 'ADMIN (PAPÁ)';
        btnRol.className =
          'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 flex items-center gap-1 transition cursor-pointer';
      } else {
        badgeRol.textContent = 'MODO RECEPCIÓN 🔒';
        btnRol.className =
          'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition cursor-pointer';
      }
    }

    renderDashboard(moneda);
    renderTablaRecibos(moneda);
    renderTablaAlumnos(moneda);
    renderPlanes(moneda);
    renderConfiguracion();
    refreshIcons();
  }

  // =========================================================================
  // 1. RENDER DASHBOARD
  // =========================================================================
  function renderDashboard(moneda) {
    const hoyISO = getLocalDateISO();
    const mesActualPrefix = hoyISO.slice(0, 7); // YYYY-MM

    const recibosValidos = store.getRecibosDetallados().filter((r) => !r.anulado);

    // Ingresos de Hoy
    const recibosHoy = recibosValidos.filter((r) => getLocalDateISO(new Date(r.fecha_pago)) === hoyISO);
    const totalHoy = recibosHoy.reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);

    document.getElementById('kpi-ingresos-hoy').textContent = `${moneda} ${totalHoy.toFixed(2)}`;
    document.getElementById('kpi-ingresos-hoy-detalle').textContent = `${recibosHoy.length} recibo(s) emitido(s) hoy`;

    // Ingresos del Mes
    const recibosMes = recibosValidos.filter((r) => getLocalDateISO(new Date(r.fecha_pago)).startsWith(mesActualPrefix));
    const totalMes = recibosMes.reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
    const totalMesEfectivo = recibosMes
      .filter((r) => r.metodo_pago === 'EFECTIVO')
      .reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
    const totalMesDigital = totalMes - totalMesEfectivo;

    if (esAdmin()) {
      document.getElementById('kpi-ingresos-mes').textContent = `${moneda} ${totalMes.toFixed(2)}`;
      document.getElementById('kpi-ingresos-mes-detalle').textContent = `Efectivo: ${moneda} ${totalMesEfectivo.toFixed(0)} • Yape/Otros: ${moneda} ${totalMesDigital.toFixed(0)}`;
    } else {
      document.getElementById('kpi-ingresos-mes').textContent = '🔒 Solo Admin';
      document.getElementById('kpi-ingresos-mes-detalle').textContent = 'Protegido en Modo Recepción';
    }

    // Saldos Pendientes
    const membresiasConSaldo = store.state.membresias.filter((m) => Number(m.saldo_pendiente) > 0 && m.estado_pago !== 'ANULADO');
    const totalSaldos = membresiasConSaldo.reduce((acc, m) => acc + Number(m.saldo_pendiente || 0), 0);

    document.getElementById('kpi-saldos-pendientes').textContent = `${moneda} ${totalSaldos.toFixed(2)}`;
    document.getElementById('kpi-saldos-detalle').textContent = `${membresiasConSaldo.length} membresía(s) con pago parcial`;

    // Estado de Alumnos
    const alumnosConEstado = store.getAlumnosConEstado();
    const activos = alumnosConEstado.filter((a) => a.estado_vigencia === 'ACTIVO' || a.estado_vigencia === 'POR_VENCER');
    const porVencer = alumnosConEstado.filter((a) => a.estado_vigencia === 'POR_VENCER');
    const vencidos = alumnosConEstado.filter((a) => a.estado_vigencia === 'VENCIDO');

    document.getElementById('kpi-alumnos-activos').textContent = `${activos.length} Activos`;
    document.getElementById('kpi-alumnos-alertas').textContent = `${porVencer.length} por vencer • ${vencidos.length} vencidos`;

    // Bandeja 1: Alertas de Vencimiento
    const alertasVencimiento = [...porVencer, ...vencidos].sort((a, b) => (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999));
    document.getElementById('badge-count-vencimientos').textContent = alertasVencimiento.length;

    const contenedorVenc = document.getElementById('dashboard-lista-vencimientos');
    if (alertasVencimiento.length === 0) {
      contenedorVenc.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-sm">
          🎉 ¡Excelente! Todos los alumnos están al día con sus fechas de membresía.
        </div>`;
    } else {
      contenedorVenc.innerHTML = alertasVencimiento
        .map((alu) => {
          const mem = alu.ultima_membresia;
          const esVencido = alu.dias_restantes < 0;
          const badgeHtml = esVencido
            ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Venció hace ${Math.abs(alu.dias_restantes)} día(s)</span>`
            : alu.dias_restantes === 0
            ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Vence HOY</span>`
            : `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Vence en ${alu.dias_restantes} día(s)</span>`;

          const waLink = generarLinkWhatsAppRecordatorio(alu, store.state.configuracion, 'VENCIMIENTO');

          return `
            <div class="p-4 hover:bg-slate-800/40 transition flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-white">${alu.nombre_completo}</span>
                  ${badgeHtml}
                </div>
                <p class="text-xs text-slate-400 mt-1 tabular-nums">
                  ${mem ? `${mem.concepto} • Del ${formatDatePE(mem.fecha_inicio)} al <b class="text-slate-200">${formatDatePE(mem.fecha_fin)}</b>` : ''}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <a
                  href="${waLink}"
                  target="_blank"
                  rel="noopener"
                  title="Enviar recordatorio por WhatsApp"
                  class="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                  <span>WhatsApp</span>
                </a>
                <button
                  type="button"
                  onclick="window.AppUI.abrirModalRenovar('${alu.id}')"
                  class="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                >
                  Renovar
                </button>
              </div>
            </div>`;
        })
        .join('');
    }

    // Bandeja 2: Alumnos con Saldo Pendiente
    document.getElementById('badge-count-saldos').textContent = membresiasConSaldo.length;
    const contenedorSaldos = document.getElementById('dashboard-lista-saldos');

    if (membresiasConSaldo.length === 0) {
      contenedorSaldos.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-sm">
          ✅ Ningún alumno tiene saldos pendientes por pagar.
        </div>`;
    } else {
      contenedorSaldos.innerHTML = membresiasConSaldo
        .map((mem) => {
          const alu = alumnosConEstado.find((a) => a.id === mem.alumno_id) || {
            id: mem.alumno_id,
            nombres: 'Alumno',
            apellidos: '',
            nombre_completo: 'Alumno'
          };
          const waLink = generarLinkWhatsAppRecordatorio(alu, store.state.configuracion, 'SALDO');

          return `
            <div class="p-4 hover:bg-slate-800/40 transition flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-white">${alu.nombre_completo}</span>
                  <span class="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">
                    Debe ${moneda} ${Number(mem.saldo_pendiente).toFixed(2)}
                  </span>
                </div>
                <p class="text-xs text-slate-400 mt-1 tabular-nums">
                  ${mem.concepto} • Total: ${moneda} ${Number(mem.total_a_pagar).toFixed(2)} (Abonó: ${moneda} ${Number(mem.monto_pagado_acumulado).toFixed(2)})
                </p>
              </div>
              <div class="flex items-center gap-2">
                <a
                  href="${waLink}"
                  target="_blank"
                  rel="noopener"
                  class="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                  <span>Avisar</span>
                </a>
                <button
                  type="button"
                  onclick="window.AppUI.abrirModalCobrarSaldo('${mem.id}')"
                  class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Cobrar Saldo
                </button>
              </div>
            </div>`;
        })
        .join('');
    }

    // Tabla Últimos Recibos en Dashboard
    const ultimosRecibos = store.getRecibosDetallados().slice(0, 8);
    const tbodyUltimos = document.getElementById('dashboard-ultimos-recibos');
    tbodyUltimos.innerHTML = ultimosRecibos
      .map((r) => crearFilaReciboHTML(r, moneda, true))
      .join('');
  }

  function crearFilaReciboHTML(r, moneda, compacto = false) {
    const m = r.membresia || {};
    const saldo = Number(m.saldo_pendiente || 0);
    const claseAnulado = r.anulado ? 'opacity-50 line-through bg-red-950/20' : 'hover:bg-slate-800/40';

    const badgeSaldo = r.anulado
      ? `<span class="text-xs font-bold text-red-400">ANULADO</span>`
      : saldo > 0
      ? `<span class="inline-flex items-center gap-1 text-xs font-bold text-amber-400 tabular-nums">${moneda} ${saldo.toFixed(2)}</span>`
      : `<span class="text-xs font-semibold text-emerald-400 tabular-nums">${moneda} 0.00</span>`;

    return `
      <tr class="${claseAnulado} transition">
        <td class="py-3 px-4 font-mono font-bold text-emerald-400 tabular-nums">
          #${r.numero_recibo}
        </td>
        ${
          !compacto
            ? `<td class="py-3 px-4 text-xs text-slate-300 tabular-nums whitespace-nowrap">${formatDateTimePE(r.fecha_pago)}</td>`
            : ''
        }
        <td class="py-3 px-4">
          <button
            type="button"
            onclick="window.AppUI.abrirHistorialAlumno('${r.alumno_id}')"
            class="font-bold text-white hover:text-red-400 text-left transition cursor-pointer"
          >
            ${r.nombre_completo}
          </button>
        </td>
        <td class="py-3 px-4 text-xs text-slate-300">${m.concepto || 'Membresía'}</td>
        <td class="py-3 px-4 text-xs font-semibold text-slate-200 tabular-nums whitespace-nowrap">${formatDatePE(m.fecha_inicio)}</td>
        <td class="py-3 px-4 text-xs font-semibold text-red-300 tabular-nums whitespace-nowrap">${formatDatePE(m.fecha_fin)}</td>
        <td class="py-3 px-4 text-right font-semibold text-slate-200 tabular-nums whitespace-nowrap">${moneda} ${Number(m.total_a_pagar || 0).toFixed(2)}</td>
        <td class="py-3 px-4 text-right font-black text-emerald-400 tabular-nums whitespace-nowrap">${moneda} ${Number(r.monto_abonado || 0).toFixed(2)}</td>
        <td class="py-3 px-4 text-right tabular-nums whitespace-nowrap">${badgeSaldo}</td>
        ${
          !compacto
            ? `<td class="py-3 px-4 text-center">
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
                  ${METODO_LABELS[r.metodo_pago] || r.metodo_pago}
                </span>
              </td>`
            : ''
        }
        <td class="py-3 px-4 text-center whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5">
            <button
              type="button"
              onclick="window.AppUI.verComprobanteDigital('${r.id}')"
              title="Ver Comprobante Digital / Enviar por WhatsApp"
              class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 border border-slate-700 cursor-pointer"
            >
              Recibo Digital
            </button>
            ${
              !r.anulado && saldo > 0
                ? `<button
                    type="button"
                    onclick="window.AppUI.abrirModalCobrarSaldo('${m.id}')"
                    title="Cobrar el saldo restante de esta membresía"
                    class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-bold text-amber-300 border border-amber-500/30 cursor-pointer"
                  >
                    Cobrar Saldo
                  </button>`
                : ''
            }
            ${
              !compacto
                ? `<button
                    type="button"
                    onclick="window.AppUI.anularOReactivarRecibo('${r.id}')"
                    title="${r.anulado ? 'Reactivar recibo' : 'Anular recibo'}"
                    class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-red-950/60 text-xs text-slate-400 hover:text-red-300 cursor-pointer"
                  >
                    ${r.anulado ? 'Reactivar' : 'Anular'}
                  </button>`
                : ''
            }
          </div>
        </td>
      </tr>
    `;
  }

  // =========================================================================
  // 2. RENDER TABLA DE RECIBOS Y CAJA
  // =========================================================================
  function getRecibosFiltrados() {
    const texto = (document.getElementById('filtro-recibos-texto')?.value || '').trim().toLowerCase();
    const periodo = document.getElementById('filtro-recibos-periodo')?.value || 'TODOS';
    const metodo = document.getElementById('filtro-recibos-metodo')?.value || 'TODOS';

    const hoyISO = getLocalDateISO();
    const mesActualPrefix = hoyISO.slice(0, 7);

    return store.getRecibosDetallados().filter((r) => {
      if (texto) {
        const matchRecibo = String(r.numero_recibo).toLowerCase().includes(texto);
        const matchNombre = String(r.nombre_completo).toLowerCase().includes(texto);
        const matchConcepto = String(r.membresia?.concepto || '').toLowerCase().includes(texto);
        if (!matchRecibo && !matchNombre && !matchConcepto) return false;
      }

      if (metodo !== 'TODOS' && r.metodo_pago !== metodo) return false;

      const fechaReciboISO = getLocalDateISO(new Date(r.fecha_pago));
      if (periodo === 'HOY' && fechaReciboISO !== hoyISO) return false;
      if (periodo === 'MES' && !fechaReciboISO.startsWith(mesActualPrefix)) return false;
      if (periodo === 'CON_SALDO' && !(Number(r.membresia?.saldo_pendiente) > 0)) return false;

      return true;
    });
  }

  function renderTablaRecibos(moneda) {
    const filtrados = getRecibosFiltrados();
    const totalFiltrado = filtrados
      .filter((r) => !r.anulado)
      .reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);

    const elTotal = document.getElementById('recibos-total-filtrado');
    if (elTotal) elTotal.textContent = `${moneda} ${totalFiltrado.toFixed(2)}`;

    const tbody = document.getElementById('tabla-recibos-body');
    if (!tbody) return;

    if (filtrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="py-10 text-center text-slate-400 text-sm">
            No se encontraron recibos con los filtros seleccionados.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtrados.map((r) => crearFilaReciboHTML(r, moneda, false)).join('');
  }

  // =========================================================================
  // 3. RENDER PADRÓN DE ALUMNOS Y VIGENCIAS
  // =========================================================================
  function getAlumnosFiltrados() {
    const texto = (document.getElementById('filtro-alumnos-texto')?.value || '').trim().toLowerCase();
    const estado = document.getElementById('filtro-alumnos-estado')?.value || 'TODOS';

    return store.getAlumnosConEstado().filter((a) => {
      if (texto) {
        const matchNombre = a.nombre_completo.toLowerCase().includes(texto);
        const matchTel = String(a.telefono_whatsapp || '').toLowerCase().includes(texto);
        const matchGrado = String(a.grado_cinturon || '').toLowerCase().includes(texto);
        if (!matchNombre && !matchTel && !matchGrado) return false;
      }

      if (estado === 'ACTIVO' && a.estado_vigencia !== 'ACTIVO') return false;
      if (estado === 'POR_VENCER' && a.estado_vigencia !== 'POR_VENCER') return false;
      if (estado === 'VENCIDO' && a.estado_vigencia !== 'VENCIDO') return false;
      if (estado === 'CON_DEUDA' && !(a.saldo_total_pendiente > 0)) return false;

      return true;
    });
  }

  function renderTablaAlumnos(moneda) {
    const tbody = document.getElementById('tabla-alumnos-body');
    if (!tbody) return;
    const alumnos = getAlumnosFiltrados();

    if (alumnos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-10 text-center text-slate-400 text-sm">
            No se encontraron alumnos con ese criterio.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = alumnos
      .map((a) => {
        const mem = a.ultima_membresia;
        let badgeVigencia = `<span class="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400">Sin membresía</span>`;
        if (a.estado_vigencia === 'ACTIVO') {
          badgeVigencia = `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 tabular-nums">🟢 Activo (${a.dias_restantes}d)</span>`;
        } else if (a.estado_vigencia === 'POR_VENCER') {
          badgeVigencia = `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">🟡 Vence en ${a.dias_restantes}d</span>`;
        } else if (a.estado_vigencia === 'VENCIDO') {
          badgeVigencia = `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 tabular-nums">🔴 Vencido (${Math.abs(a.dias_restantes)}d)</span>`;
        }

        const saldoHtml =
          a.saldo_total_pendiente > 0
            ? `<span class="font-black text-amber-400 tabular-nums">${moneda} ${a.saldo_total_pendiente.toFixed(2)}</span>`
            : `<span class="text-slate-400 tabular-nums">${moneda} 0.00</span>`;

        return `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="py-3.5 px-4">
              <button
                type="button"
                onclick="window.AppUI.abrirHistorialAlumno('${a.id}')"
                class="font-bold text-white hover:text-red-400 text-left block cursor-pointer"
              >
                ${a.nombre_completo}
              </button>
              <span class="text-[11px] text-slate-400">${a.total_membresias} membresía(s) registrada(s)</span>
            </td>
            <td class="py-3.5 px-4 text-xs text-slate-300">${a.grado_cinturon || 'Principiante'}</td>
            <td class="py-3.5 px-4 text-xs text-slate-300 tabular-nums">
              <div>${a.telefono_whatsapp || '—'}</div>
              ${a.contacto_emergencia ? `<div class="text-[11px] text-slate-400">Emerg: ${a.contacto_emergencia}</div>` : ''}
            </td>
            <td class="py-3.5 px-4 text-xs font-semibold text-slate-200">${mem ? mem.concepto : '—'}</td>
            <td class="py-3.5 px-4 text-xs font-semibold text-slate-200 tabular-nums">${mem ? formatDatePE(mem.fecha_inicio) : '—'}</td>
            <td class="py-3.5 px-4 text-xs font-semibold text-red-300 tabular-nums">${mem ? formatDatePE(mem.fecha_fin) : '—'}</td>
            <td class="py-3.5 px-4 text-center whitespace-nowrap">${badgeVigencia}</td>
            <td class="py-3.5 px-4 text-right whitespace-nowrap">${saldoHtml}</td>
            <td class="py-3.5 px-4 text-center whitespace-nowrap">
              <div class="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onclick="window.AppUI.abrirHistorialAlumno('${a.id}')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Ficha / Pagos
                </button>
                <button
                  type="button"
                  onclick="window.AppUI.abrirModalRenovar('${a.id}')"
                  class="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-xs font-bold text-red-300 cursor-pointer"
                >
                  Renovar
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  // =========================================================================
  // 4. RENDER PLANES Y DISCIPLINAS
  // =========================================================================
  function renderPlanes(moneda) {
    const grid = document.getElementById('lista-planes-grid');
    if (!grid) return;

    grid.innerHTML = store.state.planes
      .map(
        (p) => `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                ${p.disciplina}
              </span>
              <span class="text-xs text-slate-400 tabular-nums">${p.duracion_dias} días</span>
            </div>
            <h4 class="font-bold text-base text-white mt-2">${p.nombre}</h4>
            <p class="text-xl font-black text-emerald-400 mt-1 tabular-nums">${moneda} ${Number(p.precio_sugerido).toFixed(2)}</p>
          </div>
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onclick="window.AppUI.editarPlan('${p.id}')"
              class="text-xs font-semibold text-sky-400 hover:text-sky-300 px-2 py-1 cursor-pointer"
            >
              Editar
            </button>
            <button
              type="button"
              onclick="window.AppUI.eliminarPlan('${p.id}')"
              class="text-xs font-semibold text-red-400 hover:text-red-300 px-2 py-1 cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        </div>
      `
      )
      .join('');
  }

  // =========================================================================
  // 5. RENDER CONFIGURACIÓN
  // =========================================================================
  function renderConfiguracion() {
    const cfg = store.state.configuracion;
    document.getElementById('cfg-nombre').value = cfg.nombre_academia || '';
    document.getElementById('cfg-subtitulo').value = cfg.subtitulo || '';
    document.getElementById('cfg-telefono').value = cfg.telefono || '';
    document.getElementById('cfg-moneda').value = cfg.moneda || 'S/';
    document.getElementById('cfg-direccion').value = cfg.direccion || '';
    document.getElementById('cfg-proximo-recibo').value = cfg.proximo_nro_recibo || 1;
    document.getElementById('cfg-dias-alerta').value = cfg.dias_alerta_vencimiento || 5;
    if (document.getElementById('cfg-pin-admin')) {
      document.getElementById('cfg-pin-admin').value = cfg.pin_admin || '1234';
    }
    if (document.getElementById('cfg-pedir-pin-inicio')) {
      document.getElementById('cfg-pedir-pin-inicio').checked = Boolean(cfg.pedir_pin_inicio);
    }
    document.getElementById('cfg-supabase-url').value = cfg.supabase_url || '';
    document.getElementById('cfg-supabase-key').value = cfg.supabase_anon_key || '';
  }

  // =========================================================================
  // FLUJO MODAL 1: NUEVO RECIBO / INSCRIPCIÓN / RENOVACIÓN
  // =========================================================================
  function poblarSelectoresModalPago() {
    const selectPlan = document.getElementById('pago-select-plan');
    const planes = store.state.planes;
    const moneda = store.state.configuracion.moneda || 'S/';

    selectPlan.innerHTML =
      planes
        .map(
          (p) =>
            `<option value="${p.id}">${p.nombre} — ${moneda} ${Number(p.precio_sugerido).toFixed(2)} (${p.duracion_dias}d)</option>`
        )
        .join('') + `<option value="PERSONALIZADO">✍️ Otro / Plan Personalizado</option>`;

    const selectAlumno = document.getElementById('pago-select-alumno');
    const alumnos = store.getAlumnosConEstado();
    selectAlumno.innerHTML =
      `<option value="">-- Seleccionar alumno registrado --</option>` +
      alumnos
        .map(
          (a) =>
            `<option value="${a.id}">${a.nombre_completo} (${a.ultima_membresia ? `Vence: ${formatDatePE(a.ultima_membresia.fecha_fin)}` : 'Sin membresía'})</option>`
        )
        .join('');
  }

  function setModoAlumnoModal(modo) {
    modoModalPago = modo;
    const btnNuevo = document.getElementById('btn-modo-alumno-nuevo');
    const btnExistente = document.getElementById('btn-modo-alumno-existente');
    const bloqueExistente = document.getElementById('bloque-selector-existente');

    if (modo === 'NUEVO') {
      btnNuevo.className = 'py-2 px-3 rounded-lg text-xs font-bold bg-red-600 text-white transition cursor-pointer';
      btnExistente.className = 'py-2 px-3 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer';
      bloqueExistente.classList.add('hidden');
      document.getElementById('pago-select-alumno').value = '';
      document.getElementById('banner-renovacion-flexible').classList.add('hidden');
    } else {
      btnExistente.className = 'py-2 px-3 rounded-lg text-xs font-bold bg-red-600 text-white transition cursor-pointer';
      btnNuevo.className = 'py-2 px-3 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer';
      bloqueExistente.classList.remove('hidden');
    }
  }

  function aplicarPlanSeleccionado() {
    const planId = document.getElementById('pago-select-plan').value;
    const plan = store.state.planes.find((p) => p.id === planId);
    const fechaInicio = document.getElementById('pago-fecha-inicio').value || getLocalDateISO();

    if (plan) {
      document.getElementById('pago-concepto').value = plan.nombre;
      document.getElementById('pago-fecha-fin').value = calcularFechaFin(fechaInicio, plan.duracion_dias);
      const precio = Number(plan.precio_sugerido || 0).toFixed(2);
      document.getElementById('pago-total-pagar').value = precio;
      document.getElementById('pago-monto-abonado').value = precio;
      ultimoTotalSincronizado = Number(precio);
    }
    actualizarPreviewSaldoModal();
  }

  function actualizarPreviewSaldoModal() {
    const moneda = store.state.configuracion.moneda || 'S/';
    const total = Number(document.getElementById('pago-total-pagar').value || 0);
    const abonado = Number(document.getElementById('pago-monto-abonado').value || 0);
    const saldo = Math.max(0, Number((total - abonado).toFixed(2)));

    const caja = document.getElementById('caja-resumen-saldo');
    const txtEstado = document.getElementById('pago-estado-texto');
    const txtSaldo = document.getElementById('pago-saldo-preview');

    txtSaldo.textContent = `${moneda} ${saldo.toFixed(2)}`;

    if (saldo <= 0.009) {
      caja.className = 'rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between';
      txtEstado.className = 'text-xs font-bold text-emerald-400';
      txtEstado.textContent = 'PAGADO COMPLETO';
      txtSaldo.className = 'text-xl font-black text-emerald-400 tabular-nums';
    } else {
      caja.className = 'rounded-xl p-3 border border-amber-500/40 bg-amber-500/10 flex items-center justify-between';
      txtEstado.className = 'text-xs font-bold text-amber-300';
      txtEstado.textContent = 'QUEDA SALDO PENDIENTE';
      txtSaldo.className = 'text-xl font-black text-amber-400 tabular-nums';
    }

    // Validar número de recibo duplicado
    const nroRecibo = document.getElementById('pago-numero-recibo').value;
    const duplicado = store.existeNumeroRecibo(nroRecibo);
    document.getElementById('aviso-recibo-duplicado').classList.toggle('hidden', !duplicado);
  }

  function abrirModalNuevoPago() {
    poblarSelectoresModalPago();
    setModoAlumnoModal('NUEVO');

    document.getElementById('modal-pago-titulo').textContent = 'Registrar Nuevo Recibo / Inscripción';
    document.getElementById('pago-nombres').value = '';
    document.getElementById('pago-apellidos').value = '';
    document.getElementById('pago-whatsapp').value = '';
    document.getElementById('pago-grado').value = 'Principiante / Blanco';
    document.getElementById('pago-emergencia').value = '';
    document.getElementById('pago-observacion').value = '';
    document.getElementById('pago-metodo').value = 'EFECTIVO';

    const hoy = getLocalDateISO();
    document.getElementById('pago-fecha-inicio').value = hoy;
    document.getElementById('pago-numero-recibo').value = store.getProximoNumeroReciboFormateado();

    aplicarPlanSeleccionado();
    abrirModal('modal-nuevo-pago');
    setTimeout(() => document.getElementById('pago-nombres')?.focus(), 80);
  }

  function abrirModalRenovar(alumnoId) {
    poblarSelectoresModalPago();
    setModoAlumnoModal('EXISTENTE');

    document.getElementById('modal-pago-titulo').textContent = 'Renovar Membresía / Nuevo Recibo';
    document.getElementById('pago-select-alumno').value = alumnoId;
    cargarDatosAlumnoEnModal(alumnoId);

    document.getElementById('pago-numero-recibo').value = store.getProximoNumeroReciboFormateado();
    document.getElementById('pago-observacion').value = '';
    abrirModal('modal-nuevo-pago');
  }

  function cargarDatosAlumnoEnModal(alumnoId) {
    const alu = store.getAlumnosConEstado().find((a) => a.id === alumnoId);
    const banner = document.getElementById('banner-renovacion-flexible');
    if (!alu) {
      banner.classList.add('hidden');
      return;
    }

    document.getElementById('pago-nombres').value = alu.nombres || '';
    document.getElementById('pago-apellidos').value = alu.apellidos || '';
    document.getElementById('pago-whatsapp').value = alu.telefono_whatsapp || '';
    document.getElementById('pago-grado').value = alu.grado_cinturon || 'Principiante / Blanco';
    document.getElementById('pago-emergencia').value = alu.contacto_emergencia || '';

    const mem = alu.ultima_membresia;
    if (mem) {
      banner.classList.remove('hidden');
      document.getElementById('texto-vencimiento-anterior').innerHTML =
        `Último fin: <b class="text-white">${formatDatePE(mem.fecha_fin)}</b>`;

      if (mem.plan_id && store.state.planes.some((p) => p.id === mem.plan_id)) {
        document.getElementById('pago-select-plan').value = mem.plan_id;
      }

      // Por defecto, continuar desde la fecha de finalización anterior
      document.getElementById('pago-fecha-inicio').value = mem.fecha_fin;
      aplicarPlanSeleccionado();
    } else {
      banner.classList.add('hidden');
      document.getElementById('pago-fecha-inicio').value = getLocalDateISO();
      aplicarPlanSeleccionado();
    }
  }

  // =========================================================================
  // FLUJO MODAL 2: COBRAR SALDO PENDIENTE
  // =========================================================================
  function abrirModalCobrarSaldo(membresiaId) {
    const mem = store.state.membresias.find((m) => m.id === membresiaId);
    if (!mem) return;
    const alu = store.state.alumnos.find((a) => a.id === mem.alumno_id);
    const moneda = store.state.configuracion.moneda || 'S/';

    document.getElementById('saldo-membresia-id').value = mem.id;
    document.getElementById('saldo-alumno-nombre').textContent = alu
      ? `${alu.nombres} ${alu.apellidos}`
      : 'Alumno';
    document.getElementById('saldo-membresia-detalle').textContent =
      `${mem.concepto} (${formatDatePE(mem.fecha_inicio)} al ${formatDatePE(mem.fecha_fin)})`;
    document.getElementById('saldo-monto-actual').textContent =
      `${moneda} ${Number(mem.saldo_pendiente).toFixed(2)}`;

    document.getElementById('saldo-numero-recibo').value = store.getProximoNumeroReciboFormateado();
    document.getElementById('saldo-monto-abonar').value = Number(mem.saldo_pendiente).toFixed(2);
    document.getElementById('saldo-monto-abonar').max = Number(mem.saldo_pendiente).toFixed(2);
    document.getElementById('saldo-metodo-pago').value = 'EFECTIVO';
    document.getElementById('saldo-observacion').value = '';

    abrirModal('modal-cobrar-saldo');
  }

  // =========================================================================
  // FLUJO MODAL 3: VISOR DE COMPROBANTE DIGITAL
  // =========================================================================
  function verComprobanteDigital(reciboId) {
    const detalle = store.getRecibosDetallados().find((r) => r.id === reciboId);
    if (!detalle) return;
    reciboActualEnVisor = detalle;

    const canvas = document.getElementById('canvas-comprobante');
    dibujarReciboEnCanvas(canvas, detalle, store.state.configuracion);

    const waBtn = document.getElementById('btn-whatsapp-recibo');
    waBtn.href = generarLinkWhatsAppRecibo(detalle, store.state.configuracion);

    abrirModal('modal-comprobante');
    refreshIcons();
  }

  // =========================================================================
  // FLUJO MODAL 4: FICHA E HISTORIAL DEL ALUMNO
  // =========================================================================
  function abrirHistorialAlumno(alumnoId) {
    const alu = store.getAlumnosConEstado().find((a) => a.id === alumnoId);
    if (!alu) return;
    const moneda = store.state.configuracion.moneda || 'S/';

    document.getElementById('hist-alumno-nombre').textContent = alu.nombre_completo;
    document.getElementById('hist-alumno-subtitulo').textContent =
      `${alu.grado_cinturon || 'Principiante'} • WhatsApp: ${alu.telefono_whatsapp || 'No registrado'} • Emergencia: ${alu.contacto_emergencia || 'No registrado'}`;

    const recibosAlumno = store
      .getRecibosDetallados()
      .filter((r) => r.alumno_id === alumnoId);

    const htmlMembresias =
      alu.membresias_historial.length === 0
        ? `<p class="text-xs text-slate-400">Sin membresías registradas.</p>`
        : alu.membresias_historial
            .map(
              (m) => `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-white">${m.concepto}</span>
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    m.estado_pago === 'PAGADO'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-300'
                  }">${m.estado_pago}</span>
                </div>
                <p class="text-xs text-slate-400 mt-1 tabular-nums">
                  Inicio: <b>${formatDatePE(m.fecha_inicio)}</b> • Finalización: <b class="text-red-300">${formatDatePE(m.fecha_fin)}</b>
                </p>
              </div>
              <div class="text-right tabular-nums">
                <div class="text-xs text-slate-300">Total a Pagar: <b>${moneda} ${Number(m.total_a_pagar).toFixed(2)}</b></div>
                <div class="text-xs ${Number(m.saldo_pendiente) > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}">
                  Saldo: ${moneda} ${Number(m.saldo_pendiente).toFixed(2)}
                </div>
                ${
                  Number(m.saldo_pendiente) > 0
                    ? `<button
                        type="button"
                        onclick="window.AppUI.cerrarModal('modal-historial-alumno'); window.AppUI.abrirModalCobrarSaldo('${m.id}')"
                        class="mt-1 px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-black text-[11px] cursor-pointer"
                      >
                        Cobrar Saldo
                      </button>`
                    : ''
                }
              </div>
            </div>`
            )
            .join('');

    const htmlRecibos =
      recibosAlumno.length === 0
        ? `<p class="text-xs text-slate-400">Sin recibos emitidos.</p>`
        : recibosAlumno
            .map(
              (r) => `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 ${
              r.anulado ? 'opacity-50 line-through' : ''
            }">
              <div class="flex items-center gap-3">
                <span class="font-mono font-bold text-sm text-emerald-400 tabular-nums">#${r.numero_recibo}</span>
                <div>
                  <p class="text-xs font-semibold text-white">${r.observacion || r.membresia?.concepto}</p>
                  <p class="text-[11px] text-slate-400 tabular-nums">${formatDateTimePE(r.fecha_pago)} • ${METODO_LABELS[r.metodo_pago] || r.metodo_pago}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-black text-sm text-emerald-400 tabular-nums">${moneda} ${Number(r.monto_abonado).toFixed(2)}</span>
                <button
                  type="button"
                  onclick="window.AppUI.verComprobanteDigital('${r.id}')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 cursor-pointer"
                >
                  Ver Recibo
                </button>
              </div>
            </div>`
            )
            .join('');

    document.getElementById('hist-alumno-contenido').innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div class="flex gap-2">
          <button
            type="button"
            onclick="window.AppUI.cerrarModal('modal-historial-alumno'); window.AppUI.abrirModalRenovar('${alu.id}')"
            class="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
          >
            + Nueva Renovación / Recibo
          </button>
        </div>
        <button
          type="button"
          onclick="window.AppUI.eliminarAlumnoConfirm('${alu.id}')"
          class="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
        >
          Eliminar Alumno
        </button>
      </div>
      <div>
        <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">Historial de Membresías (${alu.membresias_historial.length})</h4>
        <div class="space-y-2">${htmlMembresias}</div>
      </div>
      <div>
        <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">Recibos Emitidos (${recibosAlumno.length})</h4>
        <div class="space-y-2">${htmlRecibos}</div>
      </div>
    `;

    abrirModal('modal-historial-alumno');
  }

  // =========================================================================
  // ACCIONES DE PLANES Y RECIBOS
  // =========================================================================
  function editarPlan(planId) {
    const p = store.state.planes.find((x) => x.id === planId);
    if (!p) return;
    document.getElementById('form-plan-titulo').textContent = 'Editar Plan / Disciplina';
    document.getElementById('plan-id').value = p.id;
    document.getElementById('plan-nombre').value = p.nombre;
    document.getElementById('plan-disciplina').value = p.disciplina;
    document.getElementById('plan-duracion').value = p.duracion_dias;
    document.getElementById('plan-precio').value = p.precio_sugerido;
    document.getElementById('btn-cancelar-plan').classList.remove('hidden');
  }

  function resetFormPlan() {
    document.getElementById('form-plan-titulo').textContent = 'Agregar Plan / Disciplina';
    document.getElementById('plan-id').value = '';
    document.getElementById('form-plan').reset();
    document.getElementById('plan-duracion').value = 30;
    document.getElementById('btn-cancelar-plan').classList.add('hidden');
  }

  function eliminarPlan(planId) {
    if (!confirm('¿Deseas eliminar este plan del catálogo?')) return;
    store.eliminarPlan(planId);
    mostrarToast('Plan eliminado del catálogo', 'info');
  }

  function anularOReactivarRecibo(reciboId) {
    if (!esAdmin()) {
      mostrarToast('Solo el Administrador puede anular o reactivar recibos', 'warning');
      abrirModal('modal-login-admin');
      return;
    }
    const rec = store.toggleAnularRecibo(reciboId);
    if (!rec) return;
    mostrarToast(
      rec.anulado ? `Recibo #${rec.numero_recibo} anulado. Saldo recalculado.` : `Recibo #${rec.numero_recibo} reactivado.`,
      rec.anulado ? 'warning' : 'success'
    );
  }

  function eliminarAlumnoConfirm(alumnoId) {
    if (!esAdmin()) {
      mostrarToast('Solo el Administrador puede eliminar alumnos', 'warning');
      abrirModal('modal-login-admin');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar este alumno y todos sus recibos asociados?')) return;
    store.eliminarAlumno(alumnoId);
    cerrarModal('modal-historial-alumno');
    mostrarToast('Alumno eliminado correctamente', 'info');
  }

  // =========================================================================
  // BUSCADOR INSTANTÁNEO DE RECEPCIÓN (BARRA SUPERIOR)
  // =========================================================================
  function manejarBusquedaGlobal(query) {
    const resultsBox = document.getElementById('global-search-results');
    const q = (query || '').trim().toLowerCase();

    if (!q) {
      resultsBox.classList.add('hidden');
      resultsBox.innerHTML = '';
      return;
    }

    const moneda = store.state.configuracion.moneda || 'S/';
    const alumnosMatch = store
      .getAlumnosConEstado()
      .filter(
        (a) =>
          a.nombre_completo.toLowerCase().includes(q) ||
          String(a.telefono_whatsapp || '').includes(q)
      )
      .slice(0, 5);

    const recibosMatch = store
      .getRecibosDetallados()
      .filter((r) => String(r.numero_recibo).toLowerCase().includes(q))
      .slice(0, 4);

    if (alumnosMatch.length === 0 && recibosMatch.length === 0) {
      resultsBox.innerHTML = `<div class="p-4 text-xs text-slate-400 text-center">Sin coincidencias para "${query}"</div>`;
      resultsBox.classList.remove('hidden');
      return;
    }

    let html = '';

    if (alumnosMatch.length > 0) {
      html += `<div class="px-3.5 py-2 bg-slate-950 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Alumnos Encontrados</div>`;
      html += alumnosMatch
        .map((a) => {
          const mem = a.ultima_membresia;
          const semaforo =
            a.estado_vigencia === 'ACTIVO'
              ? '🟢 ACTIVO'
              : a.estado_vigencia === 'POR_VENCER'
              ? `🟡 VENCE EN ${a.dias_restantes}D`
              : a.estado_vigencia === 'VENCIDO'
              ? '🔴 VENCIDO'
              : '⚪ SIN PLAN';

          return `
            <div class="p-3 hover:bg-slate-800/70 border-b border-slate-800 flex items-center justify-between gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-white">${a.nombre_completo}</span>
                  <span class="text-[11px] font-bold">${semaforo}</span>
                </div>
                <p class="text-xs text-slate-400 tabular-nums">
                  ${mem ? `${mem.concepto} • Vence: ${formatDatePE(mem.fecha_fin)}` : 'Sin membresía'}
                  ${a.saldo_total_pendiente > 0 ? ` • <b class="text-amber-400">Debe ${moneda} ${a.saldo_total_pendiente.toFixed(2)}</b>` : ''}
                </p>
              </div>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  onclick="document.getElementById('global-search-results').classList.add('hidden'); window.AppUI.abrirHistorialAlumno('${a.id}')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                >
                  Ver Ficha
                </button>
                <button
                  type="button"
                  onclick="document.getElementById('global-search-results').classList.add('hidden'); window.AppUI.abrirModalRenovar('${a.id}')"
                  class="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white cursor-pointer"
                >
                  Renovar
                </button>
              </div>
            </div>`;
        })
        .join('');
    }

    if (recibosMatch.length > 0) {
      html += `<div class="px-3.5 py-2 bg-slate-950 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Recibos por Número</div>`;
      html += recibosMatch
        .map(
          (r) => `
          <div class="p-3 hover:bg-slate-800/70 border-b border-slate-800 flex items-center justify-between gap-2">
            <div>
              <span class="font-mono font-bold text-xs text-emerald-400">#${r.numero_recibo}</span>
              <span class="text-xs font-bold text-white ml-2">${r.nombre_completo}</span>
              <p class="text-[11px] text-slate-400 tabular-nums">
                ${r.membresia?.concepto} • Abonó: ${moneda} ${Number(r.monto_abonado).toFixed(2)}
              </p>
            </div>
            <button
              type="button"
              onclick="document.getElementById('global-search-results').classList.add('hidden'); window.AppUI.verComprobanteDigital('${r.id}')"
              class="px-2.5 py-1 rounded-lg bg-sky-600/20 border border-sky-500/30 text-sky-300 text-xs font-bold cursor-pointer"
            >
              Ver Recibo
            </button>
          </div>`
        )
        .join('');
    }

    resultsBox.innerHTML = html;
    resultsBox.classList.remove('hidden');
  }

  // =========================================================================
  // INICIALIZACIÓN DE EVENTOS DOM
  // =========================================================================
  function initEventListeners() {
    // Suscribir cambios del store
    store.subscribe(() => renderTodo());

    // Navegación por pestañas
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => cambiarTab(btn.getAttribute('data-tab')));
    });

    // Cerrar modales
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => cerrarModal(btn.getAttribute('data-close-modal')));
    });

    // Cerrar modales con tecla Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ['modal-nuevo-pago', 'modal-cobrar-saldo', 'modal-comprobante', 'modal-historial-alumno'].forEach(cerrarModal);
        document.getElementById('global-search-results')?.classList.add('hidden');
      }
    });

    // Buscador global de recepción
    const globalSearchInput = document.getElementById('global-search-input');
    globalSearchInput?.addEventListener('input', (e) => manejarBusquedaGlobal(e.target.value));
    document.addEventListener('click', (e) => {
      const box = document.getElementById('global-search-results');
      if (box && !box.contains(e.target) && e.target !== globalSearchInput) {
        box.classList.add('hidden');
      }
    });

    // Botón principal "+ Nuevo Recibo / Inscripción"
    document.getElementById('btn-open-nuevo-pago')?.addEventListener('click', abrirModalNuevoPago);

    // Conmutador Alumno Nuevo vs Existente en Modal 1
    document.getElementById('btn-modo-alumno-nuevo')?.addEventListener('click', () => setModoAlumnoModal('NUEVO'));
    document.getElementById('btn-modo-alumno-existente')?.addEventListener('click', () => setModoAlumnoModal('EXISTENTE'));

    document.getElementById('pago-select-alumno')?.addEventListener('change', (e) => {
      cargarDatosAlumnoEnModal(e.target.value);
    });

    // Botones de renovación flexible (Continuar desde vencimiento vs Iniciar desde Hoy)
    document.getElementById('btn-renovar-continuar')?.addEventListener('click', () => {
      const aluId = document.getElementById('pago-select-alumno').value;
      const alu = store.getAlumnosConEstado().find((a) => a.id === aluId);
      if (alu?.ultima_membresia) {
        document.getElementById('pago-fecha-inicio').value = alu.ultima_membresia.fecha_fin;
        aplicarPlanSeleccionado();
      }
    });

    document.getElementById('btn-renovar-hoy')?.addEventListener('click', () => {
      document.getElementById('pago-fecha-inicio').value = getLocalDateISO();
      aplicarPlanSeleccionado();
    });

    // Cambio de Plan o Fecha de Inicio recalcula Fecha de Finalización
    document.getElementById('pago-select-plan')?.addEventListener('change', aplicarPlanSeleccionado);
    document.getElementById('pago-fecha-inicio')?.addEventListener('change', (e) => {
      const planId = document.getElementById('pago-select-plan').value;
      const plan = store.state.planes.find((p) => p.id === planId);
      const dias = plan ? plan.duracion_dias : 30;
      document.getElementById('pago-fecha-fin').value = calcularFechaFin(e.target.value, dias);
    });

    // Botones rápidos de duración (+1 Mes, +3 Meses, +15 Días)
    document.querySelectorAll('.quick-dur-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dias = Number(btn.getAttribute('data-quick-duration')) || 30;
        const inicio = document.getElementById('pago-fecha-inicio').value || getLocalDateISO();
        document.getElementById('pago-fecha-fin').value = calcularFechaFin(inicio, dias);
      });
    });

    // Sincronización inteligente de Total a Pagar y Monto Abonado
    document.getElementById('pago-total-pagar')?.addEventListener('input', (e) => {
      const nuevoTotal = Number(e.target.value || 0);
      const inputAbonado = document.getElementById('pago-monto-abonado');
      if (Number(inputAbonado.value) === ultimoTotalSincronizado) {
        inputAbonado.value = e.target.value;
      }
      ultimoTotalSincronizado = nuevoTotal;
      actualizarPreviewSaldoModal();
    });

    document.getElementById('pago-monto-abonado')?.addEventListener('input', actualizarPreviewSaldoModal);
    document.getElementById('pago-numero-recibo')?.addEventListener('input', actualizarPreviewSaldoModal);

    // Submit Formulario Nuevo Recibo / Inscripción
    document.getElementById('form-nuevo-pago')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitMode = e.submitter?.getAttribute('data-submit-mode') || 'digital';
      const alumnoId = modoModalPago === 'EXISTENTE' ? document.getElementById('pago-select-alumno').value : null;

      const resultado = store.registrarInscripcionOPago({
        alumnoId,
        nombres: document.getElementById('pago-nombres').value,
        apellidos: document.getElementById('pago-apellidos').value,
        telefono_whatsapp: document.getElementById('pago-whatsapp').value,
        grado_cinturon: document.getElementById('pago-grado').value,
        contacto_emergencia: document.getElementById('pago-emergencia').value,
        plan_id: document.getElementById('pago-select-plan').value,
        concepto: document.getElementById('pago-concepto').value,
        fecha_inicio: document.getElementById('pago-fecha-inicio').value,
        fecha_fin: document.getElementById('pago-fecha-fin').value,
        total_a_pagar: document.getElementById('pago-total-pagar').value,
        numero_recibo: document.getElementById('pago-numero-recibo').value,
        monto_abonado: document.getElementById('pago-monto-abonado').value,
        metodo_pago: document.getElementById('pago-metodo').value,
        observacion: document.getElementById('pago-observacion').value
      });

      cerrarModal('modal-nuevo-pago');
      mostrarToast(`Recibo #${resultado.recibo.numero_recibo} registrado con éxito`);

      if (submitMode === 'digital') {
        verComprobanteDigital(resultado.recibo.id);
      }
    });

    // Submit Formulario Cobrar Saldo Pendiente
    document.getElementById('form-cobrar-saldo')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const resultado = store.cobrarSaldoMembresia({
        membresia_id: document.getElementById('saldo-membresia-id').value,
        numero_recibo: document.getElementById('saldo-numero-recibo').value,
        monto_abonado: document.getElementById('saldo-monto-abonar').value,
        metodo_pago: document.getElementById('saldo-metodo-pago').value,
        observacion: document.getElementById('saldo-observacion').value
      });

      cerrarModal('modal-cobrar-saldo');
      mostrarToast(`Saldo cobrado en Recibo #${resultado.recibo.numero_recibo}`);
      verComprobanteDigital(resultado.recibo.id);
    });

    // Botones del Visor de Comprobante Digital
    document.getElementById('btn-descargar-png-recibo')?.addEventListener('click', () => {
      if (!reciboActualEnVisor) return;
      const canvas = document.getElementById('canvas-comprobante');
      descargarCanvasComoPNG(canvas, reciboActualEnVisor.numero_recibo, reciboActualEnVisor.nombre_completo);
      mostrarToast('Imagen PNG del recibo descargada');
    });

    document.getElementById('btn-copiar-imagen-recibo')?.addEventListener('click', async () => {
      try {
        const canvas = document.getElementById('canvas-comprobante');
        await copiarCanvasAlPortapapeles(canvas);
        mostrarToast('¡Imagen copiada! Pégala con Ctrl+V en WhatsApp');
      } catch (err) {
        mostrarToast('Usa el botón Descargar Imagen (.PNG)', 'info');
      }
    });

    // Filtros en vista Recibos y Alumnos
    ['filtro-recibos-texto', 'filtro-recibos-periodo', 'filtro-recibos-metodo'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () =>
        renderTablaRecibos(store.state.configuracion.moneda || 'S/')
      );
    });

    ['filtro-alumnos-texto', 'filtro-alumnos-estado'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () =>
        renderTablaAlumnos(store.state.configuracion.moneda || 'S/')
      );
    });

    // Exportación a Excel
    document.getElementById('btn-exportar-recibos-excel')?.addEventListener('click', () => {
      exportarRecibosExcel(getRecibosFiltrados(), store.state.configuracion);
      mostrarToast('Reporte de Recibos exportado a Excel (.xls)');
    });

    document.getElementById('btn-exportar-alumnos-excel')?.addEventListener('click', () => {
      exportarAlumnosExcel(getAlumnosFiltrados(), store.state.configuracion);
      mostrarToast('Padrón de Alumnos exportado a Excel (.xls)');
    });

    // Gestión de Planes
    document.getElementById('form-plan')?.addEventListener('submit', (e) => {
      e.preventDefault();
      store.guardarPlan({
        id: document.getElementById('plan-id').value || null,
        nombre: document.getElementById('plan-nombre').value,
        disciplina: document.getElementById('plan-disciplina').value,
        duracion_dias: document.getElementById('plan-duracion').value,
        precio_sugerido: document.getElementById('plan-precio').value
      });
      resetFormPlan();
      mostrarToast('Plan guardado en el catálogo');
    });

    document.getElementById('btn-cancelar-plan')?.addEventListener('click', resetFormPlan);

    // Configuración de la Academia
    document.getElementById('form-configuracion')?.addEventListener('submit', (e) => {
      e.preventDefault();
      store.actualizarConfiguracion({
        nombre_academia: document.getElementById('cfg-nombre').value.trim(),
        subtitulo: document.getElementById('cfg-subtitulo').value.trim(),
        telefono: document.getElementById('cfg-telefono').value.trim(),
        moneda: document.getElementById('cfg-moneda').value.trim() || 'S/',
        direccion: document.getElementById('cfg-direccion').value.trim(),
        proximo_nro_recibo: Number(document.getElementById('cfg-proximo-recibo').value) || 1,
        dias_alerta_vencimiento: Number(document.getElementById('cfg-dias-alerta').value) || 5,
        pin_admin: document.getElementById('cfg-pin-admin')?.value.trim() || '1234',
        pedir_pin_inicio: Boolean(document.getElementById('cfg-pedir-pin-inicio')?.checked)
      });
      mostrarToast('Configuración y Clave de Administrador actualizadas');
    });

    // Control de Acceso Admin / Modo Recepción
    document.getElementById('btn-cambiar-rol')?.addEventListener('click', () => {
      document.getElementById('login-input-pin').value = '';
      abrirModal('modal-login-admin');
      setTimeout(() => document.getElementById('login-input-pin')?.focus(), 80);
    });

    document.getElementById('form-login-admin')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const pinIngresado = document.getElementById('login-input-pin').value.trim();
      const pinCorrecto = store.state.configuracion.pin_admin || '1234';
      if (pinIngresado === pinCorrecto) {
        store.actualizarConfiguracion({ rol_actual: 'ADMIN' });
        cerrarModal('modal-login-admin');
        mostrarToast('🔓 Modo Administrador activado (Acceso Total)');
      } else {
        mostrarToast('Clave de Administrador incorrecta', 'error');
      }
    });

    document.getElementById('btn-entrar-modo-recepcion')?.addEventListener('click', () => {
      store.actualizarConfiguracion({ rol_actual: 'RECEPCION' });
      cerrarModal('modal-login-admin');
      if (tabActual === 'configuracion' || tabActual === 'planes') {
        cambiarTab('dashboard');
      }
      mostrarToast('🔒 Modo Recepción activo (Configuración y borrado bloqueados)', 'info');
    });

    // Conexión Supabase Cloud
    document.getElementById('btn-test-supabase')?.addEventListener('click', async () => {
      const url = document.getElementById('cfg-supabase-url').value.trim();
      const key = document.getElementById('cfg-supabase-key').value.trim();
      store.actualizarConfiguracion({ supabase_url: url, supabase_anon_key: key });
      try {
        await probarConexionSupabase(url, key);
        await subirDatosASupabase(store);
        mostrarToast('¡Conectado y sincronizado con Supabase Cloud!');
      } catch (err) {
        mostrarToast(err.message, 'error');
      }
    });

    // Respaldo y Restauración JSON
    document.getElementById('btn-backup-json')?.addEventListener('click', () => {
      exportarBackupJSON(store.state);
      mostrarToast('Copia de seguridad (.JSON) descargada');
    });

    document.getElementById('input-restore-json')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (parsed && Array.isArray(parsed.alumnos) && Array.isArray(parsed.recibos)) {
            store.saveState(parsed);
            store.recalcularTodasLasMembresias();
            mostrarToast('Copia de seguridad restaurada con éxito');
          } else {
            mostrarToast('El archivo JSON no tiene el formato del sistema', 'error');
          }
        } catch (err) {
          mostrarToast('Error al leer el archivo JSON', 'error');
        }
      };
      reader.readAsText(file);
    });

    // Limpiar datos de ejemplo para producción
    document.getElementById('btn-limpiar-produccion')?.addEventListener('click', () => {
      if (
        !confirm(
          '¿Deseas borrar los 4 alumnos y recibos de ejemplo para empezar tu numeración limpia desde el Recibo #000001?'
        )
      )
        return;
      store.limpiarDatosParaProduccion();
      mostrarToast('Sistema limpio y listo para operar desde el Recibo #000001');
    });

    document.getElementById('btn-restaurar-demo')?.addEventListener('click', () => {
      if (!confirm('¿Restaurar los datos de demostración?')) return;
      store.restaurarDatosDemo();
      mostrarToast('Datos de ejemplo restaurados');
    });
  }

  // Exponer funciones públicas para eventos inline
  global.AppUI = {
    cambiarTab,
    abrirModal,
    cerrarModal,
    abrirModalNuevoPago,
    abrirModalRenovar,
    abrirModalCobrarSaldo,
    verComprobanteDigital,
    abrirHistorialAlumno,
    editarPlan,
    eliminarPlan,
    anularOReactivarRecibo,
    eliminarAlumnoConfirm
  };

  document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    if (store.state.configuracion.pedir_pin_inicio) {
      store.setRolDispositivoActual('RECEPCION');
      abrirModal('modal-login-admin');
    }
    if (global.SupabaseSync && typeof global.SupabaseSync.iniciarSincronizacionTiempoReal === 'function') {
      global.SupabaseSync.iniciarSincronizacionTiempoReal(store);
    }
    renderTodo();
  });
})(window);
