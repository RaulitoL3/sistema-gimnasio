/**
 * CONTROLADOR PRINCIPAL DE INTERFAZ (UI) - SISTEMA DE GIMNASIO DE ARTES MARCIALES
 */
(function (global) {
  const {
    store,
    getLocalDateISO,
    formatDatePE,
    formatDateTimePE,
    calcularFechaFin
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
  let vistaAlumnosModo = 'TARJETAS'; // 'TARJETAS' | 'TABLA'
  let modoModalPago = 'NUEVO'; // 'NUEVO' | 'EXISTENTE'
  let tipoOperacionPago = 'INSCRIPCION_Y_MENSUALIDAD'; // 'INSCRIPCION_Y_MENSUALIDAD' | 'SOLO_INSCRIPCION' | 'MENSUALIDAD'
  let reciboActualEnVisor = null;
  let ultimoTotalSincronizado = 0;

  function mostrarToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colores = {
      success: 'bg-emerald-600 border-emerald-400 text-white keep-white-text',
      warning: 'bg-amber-500 border-amber-300 text-slate-950',
      error: 'bg-red-600 border-red-400 text-white keep-white-text',
      info: 'bg-sky-600 border-sky-400 text-white keep-white-text'
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

  /**
   * Devuelve colores e iniciales según el cinturón/grado del alumno
   */
  function obtenerEstiloCinturon(grado = '') {
    const g = grado.toLowerCase();
    if (g.includes('azul')) {
      return { bg: 'bg-blue-600 text-white border-blue-400', label: '🔵 Cinturón Azul' };
    }
    if (g.includes('morado')) {
      return { bg: 'bg-purple-600 text-white border-purple-400', label: '🟣 Cinturón Morado' };
    }
    if (g.includes('marrón') || g.includes('marron')) {
      return { bg: 'bg-amber-800 text-white border-amber-600', label: '🟤 Cinturón Marrón' };
    }
    if (g.includes('negro')) {
      return { bg: 'bg-slate-950 text-amber-400 border-amber-400', label: '⚫ Cinturón Negro' };
    }
    if (g.includes('competidor')) {
      return { bg: 'bg-red-600 text-white border-red-400', label: '🔴 Competidor' };
    }
    if (g.includes('infantil') || g.includes('kids')) {
      return { bg: 'bg-emerald-600 text-white border-emerald-400', label: '🟢 Infantil / Kids' };
    }
    return { bg: 'bg-slate-200 text-slate-800 border-slate-400', label: '⚪ Principiante / Blanco' };
  }

  function obtenerIniciales(nombres = '', apellidos = '') {
    const n = (nombres || '').trim().charAt(0).toUpperCase();
    const a = (apellidos || '').trim().charAt(0).toUpperCase();
    return (n + a) || '🥋';
  }

  /**
   * Aplica tema Claro/Oscuro, color de marca y logo de la academia
   */
  function aplicarIdentidadVisual() {
    const cfg = store.state.configuracion;
    const colorTema = cfg.color_tema || 'ROJO';
    const temaVisual = cfg.tema_visual || 'CLARO';

    document.body.setAttribute('data-brand', colorTema);
    document.body.classList.toggle('light-theme', temaVisual === 'CLARO');

    const txtToggle = document.getElementById('texto-toggle-tema');
    if (txtToggle) {
      txtToggle.textContent =
        temaVisual === 'CLARO' ? '☀️ Modo Claro (Fácil lectura)' : '🌙 Modo Oscuro Activo';
    }

    // Logo en menú lateral y en vista previa de configuración
    const logoUrl = cfg.logo_url || '';
    const headerImg = document.getElementById('header-gym-logo-img');
    const headerFallback = document.getElementById('header-gym-logo-fallback');
    const cfgImg = document.getElementById('cfg-logo-preview');
    const cfgFallback = document.getElementById('cfg-logo-fallback');

    if (logoUrl) {
      if (headerImg) {
        headerImg.src = logoUrl;
        headerImg.classList.remove('hidden');
      }
      if (headerFallback) headerFallback.classList.add('hidden');
      if (cfgImg) {
        cfgImg.src = logoUrl;
        cfgImg.classList.remove('hidden');
      }
      if (cfgFallback) cfgFallback.classList.add('hidden');
    } else {
      if (headerImg) headerImg.classList.add('hidden');
      if (headerFallback) headerFallback.classList.remove('hidden');
      if (cfgImg) cfgImg.classList.add('hidden');
      if (cfgFallback) cfgFallback.classList.remove('hidden');
    }
  }

  function cambiarTab(tabName) {
    if ((tabName === 'configuracion' || tabName === 'planes') && !esAdmin()) {
      mostrarToast('Se requiere clave de Administrador para entrar a esta sección', 'warning');
      abrirModal('modal-login-admin');
      setTimeout(() => document.getElementById('login-input-pin')?.focus(), 80);
      return;
    }
    tabActual = tabName;
    const tabs = ['dashboard', 'alumnos', 'horarios', 'recibos', 'planes', 'configuracion'];
    tabs.forEach((t) => {
      const sec = document.getElementById(`view-${t}`);
      if (sec) sec.classList.toggle('hidden', t !== tabName);
    });

    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      const isSelected = btn.getAttribute('data-tab') === tabName;
      btn.className = isSelected
        ? 'nav-tab-btn keep-white-text w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-sm font-extrabold brand-bg text-white shadow-md whitespace-nowrap transition cursor-pointer'
        : 'nav-tab-btn w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800 hover:text-white whitespace-nowrap transition cursor-pointer';
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

  function actualizarFiltroHorariosAlumnos() {
    const selectFiltro = document.getElementById('filtro-alumnos-horario');
    if (!selectFiltro) return;
    const valorActual = selectFiltro.value || 'TODOS';
    const horarios = store.state.horarios || [];

    selectFiltro.innerHTML =
      `<option value="TODOS">Todos los horarios (${store.state.alumnos.length})</option>` +
      horarios
        .map((h) => {
          const count = store.state.alumnos.filter((a) => a.horario_id === h.id).length;
          return `<option value="${h.id}">🕒 ${h.hora} (${h.dias}) — ${h.nombre} [${count}]</option>`;
        })
        .join('') +
      `<option value="SIN_HORARIO">⚪ Sin horario asignado</option>`;

    if ([...selectFiltro.options].some((o) => o.value === valorActual)) {
      selectFiltro.value = valorActual;
    }
  }

  // =========================================================================
  // RENDERIZADO GENERAL REACTIVO
  // =========================================================================
  function renderTodo() {
    const cfg = store.state.configuracion;
    const moneda = cfg.moneda || 'S/';

    aplicarIdentidadVisual();
    actualizarFiltroHorariosAlumnos();

    // Cabecera / Sidebar
    document.getElementById('header-gym-name').textContent = cfg.nombre_academia || 'GIMNASIO ARTES MARCIALES';
    document.getElementById('header-gym-subtitle').textContent = cfg.subtitulo || 'Artes Marciales & Deportes de Contacto';
    document.getElementById('nav-badge-recibos').textContent = store.state.recibos.filter((r) => !r.anulado).length;
    document.getElementById('nav-badge-alumnos').textContent = store.state.alumnos.length;
    const badgeHorarios = document.getElementById('nav-badge-horarios');
    if (badgeHorarios) {
      badgeHorarios.textContent = (store.state.horarios || []).length;
    }

    const badgeRol = document.getElementById('badge-rol-actual');
    const btnRol = document.getElementById('btn-cambiar-rol');
    if (badgeRol && btnRol) {
      if (esAdmin()) {
        badgeRol.textContent = 'ADMIN (PAPÁ)';
        btnRol.className =
          'text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 flex items-center gap-1 transition cursor-pointer';
      } else {
        badgeRol.textContent = 'MODO RECEPCIÓN 🔒';
        btnRol.className =
          'text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition cursor-pointer';
      }
    }

    renderDashboard(moneda);
    renderTablaRecibos(moneda);
    renderTablaAlumnos(moneda);
    renderHorarios(moneda);
    renderPlanes(moneda);
    renderConfiguracion();
    refreshIcons();
  }

  // =========================================================================
  // 1. RENDER DASHBOARD (INICIO Y RECEPCIÓN)
  // =========================================================================
  function renderDashboard(moneda) {
    const hoyISO = getLocalDateISO();
    const mesActualPrefix = hoyISO.slice(0, 7); // YYYY-MM

    const recibosValidos = store.getRecibosDetallados().filter((r) => !r.anulado);

    // Ingresos de Hoy
    const recibosHoy = recibosValidos.filter((r) => getLocalDateISO(new Date(r.fecha_pago)) === hoyISO);
    const totalHoy = recibosHoy.reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);

    document.getElementById('kpi-ingresos-hoy').textContent = `${moneda} ${totalHoy.toFixed(2)}`;
    document.getElementById('kpi-ingresos-hoy-detalle').textContent = `${recibosHoy.length} recibo(s) cobrado(s) hoy`;

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

    // Saldos Pendientes ("Lo que nos deben")
    const membresiasConSaldo = store.state.membresias.filter((m) => Number(m.saldo_pendiente) > 0 && m.estado_pago !== 'ANULADO');
    const totalSaldos = membresiasConSaldo.reduce((acc, m) => acc + Number(m.saldo_pendiente || 0), 0);

    document.getElementById('kpi-saldos-pendientes').textContent = `${moneda} ${totalSaldos.toFixed(2)}`;
    document.getElementById('kpi-saldos-detalle').textContent = `${membresiasConSaldo.length} alumno(s) con saldo por pagar`;

    // Estado de Alumnos
    const alumnosConEstado = store.getAlumnosConEstado();
    const activos = alumnosConEstado.filter((a) => a.estado_vigencia === 'ACTIVO' || a.estado_vigencia === 'POR_VENCER');
    const porVencer = alumnosConEstado.filter((a) => a.estado_vigencia === 'POR_VENCER');
    const vencidos = alumnosConEstado.filter((a) => a.estado_vigencia === 'VENCIDO');

    document.getElementById('kpi-alumnos-activos').textContent = `${activos.length} Al Día`;
    document.getElementById('kpi-alumnos-alertas').textContent = `${porVencer.length} por vencer • ${vencidos.length} vencidos`;

    // Bandeja 1: Alertas de Vencimiento
    const alertasVencimiento = [...porVencer, ...vencidos].sort((a, b) => (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999));
    document.getElementById('badge-count-vencimientos').textContent = alertasVencimiento.length;

    const contenedorVenc = document.getElementById('dashboard-lista-vencimientos');
    if (alertasVencimiento.length === 0) {
      contenedorVenc.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-sm font-medium">
          🎉 ¡Excelente! Todos los alumnos están al día con sus mensualidades.
        </div>`;
    } else {
      contenedorVenc.innerHTML = alertasVencimiento
        .map((alu) => {
          const mem = alu.ultima_membresia;
          const esVencido = alu.dias_restantes < 0;
          const badgeHtml = esVencido
            ? `<span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">🔴 Venció hace ${Math.abs(alu.dias_restantes)} día(s)</span>`
            : alu.dias_restantes === 0
            ? `<span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">🟡 Vence HOY</span>`
            : `<span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">🟡 Vence en ${alu.dias_restantes} día(s)</span>`;

          const waLink = generarLinkWhatsAppRecordatorio(alu, store.state.configuracion, 'VENCIMIENTO');

          return `
            <div class="p-4 hover:bg-slate-800/40 transition flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-extrabold text-sm sm:text-base text-white">${alu.nombre_completo}</span>
                  ${badgeHtml}
                </div>
                <p class="text-xs text-slate-400 mt-1 tabular-nums">
                  ${mem ? `${mem.concepto} • Vence el: <b class="text-slate-200">${formatDatePE(mem.fecha_fin)}</b>` : ''}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <a
                  href="${waLink}"
                  target="_blank"
                  rel="noopener"
                  title="Enviar recordatorio por WhatsApp"
                  class="keep-white-text px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <i data-lucide="message-circle" class="w-4 h-4"></i>
                  <span>Avisar</span>
                </a>
                <button
                  type="button"
                  onclick="window.AppUI.abrirModalRenovar('${alu.id}')"
                  class="keep-white-text px-3.5 py-2 rounded-xl brand-bg text-white text-xs font-extrabold cursor-pointer"
                >
                  Cobrar Mes
                </button>
              </div>
            </div>`;
        })
        .join('');
    }

    // Bandeja 2: Alumnos con Saldo Pendiente ("Lo que deben")
    document.getElementById('badge-count-saldos').textContent = membresiasConSaldo.length;
    const contenedorSaldos = document.getElementById('dashboard-lista-saldos');

    if (membresiasConSaldo.length === 0) {
      contenedorSaldos.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-sm font-medium">
          ✅ Ningún alumno debe saldo pendiente en este momento.
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
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-extrabold text-sm sm:text-base text-white">${alu.nombre_completo}</span>
                  <span class="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">
                    ⚠️ Debe ${moneda} ${Number(mem.saldo_pendiente).toFixed(2)}
                  </span>
                </div>
                <p class="text-xs text-slate-400 mt-1 tabular-nums">
                  ${mem.concepto} • Total: ${moneda} ${Number(mem.total_a_pagar).toFixed(2)} (Ya pagó: ${moneda} ${Number(mem.monto_pagado_acumulado).toFixed(2)})
                </p>
              </div>
              <div class="flex items-center gap-2">
                <a
                  href="${waLink}"
                  target="_blank"
                  rel="noopener"
                  class="keep-white-text px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <i data-lucide="message-circle" class="w-4 h-4"></i>
                  <span>WhatsApp</span>
                </a>
                <button
                  type="button"
                  onclick="window.AppUI.abrirModalCobrarSaldo('${mem.id}')"
                  class="keep-white-text px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold cursor-pointer"
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
      ? `<span class="inline-flex items-center gap-1 text-xs font-black text-amber-400 tabular-nums">Debe ${moneda} ${saldo.toFixed(2)}</span>`
      : `<span class="text-xs font-bold text-emerald-400 tabular-nums">No debe nada</span>`;

    return `
      <tr class="${claseAnulado} transition">
        <td class="py-3.5 px-4 font-mono font-black text-emerald-400 tabular-nums">
          #${r.numero_recibo}
        </td>
        ${
          !compacto
            ? `<td class="py-3.5 px-4 text-xs font-medium text-slate-300 tabular-nums whitespace-nowrap">${formatDateTimePE(r.fecha_pago)}</td>`
            : ''
        }
        <td class="py-3.5 px-4">
          <button
            type="button"
            onclick="window.AppUI.abrirHistorialAlumno('${r.alumno_id}')"
            class="font-extrabold text-white hover:text-red-400 text-left transition cursor-pointer"
          >
            ${r.nombre_completo}
          </button>
        </td>
        <td class="py-3.5 px-4 text-xs font-semibold text-slate-300">${m.concepto || 'Membresía'}</td>
        <td class="py-3.5 px-4 text-xs font-bold text-slate-200 tabular-nums whitespace-nowrap">${formatDatePE(m.fecha_inicio)}</td>
        <td class="py-3.5 px-4 text-xs font-bold text-red-300 tabular-nums whitespace-nowrap">${
          m.tipo_operacion === 'SOLO_INSCRIPCION'
            ? `<span class="text-xs font-extrabold text-emerald-400">PAGO ÚNICO (INSCRITO)</span>`
            : formatDatePE(m.fecha_fin)
        }</td>
        <td class="py-3.5 px-4 text-right font-bold text-slate-200 tabular-nums whitespace-nowrap">${moneda} ${Number(m.total_a_pagar || 0).toFixed(2)}</td>
        <td class="py-3.5 px-4 text-right font-black text-emerald-400 tabular-nums whitespace-nowrap">${moneda} ${Number(r.monto_abonado || 0).toFixed(2)}</td>
        <td class="py-3.5 px-4 text-right tabular-nums whitespace-nowrap">${badgeSaldo}</td>
        ${
          !compacto
            ? `<td class="py-3.5 px-4 text-center">
                <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                  ${METODO_LABELS[r.metodo_pago] || r.metodo_pago}
                </span>
              </td>`
            : ''
        }
        <td class="py-3.5 px-4 text-center whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5">
            <button
              type="button"
              onclick="window.AppUI.verComprobanteDigital('${r.id}')"
              title="Ver Comprobante Digital / Enviar por WhatsApp"
              class="keep-white-text px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white cursor-pointer"
            >
              Recibo Digital
            </button>
            ${
              !r.anulado && saldo > 0
                ? `<button
                    type="button"
                    onclick="window.AppUI.abrirModalCobrarSaldo('${m.id}')"
                    title="Cobrar lo que debe de esta membresía"
                    class="keep-white-text px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white cursor-pointer"
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
                    class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950/60 text-xs font-bold text-slate-400 hover:text-red-300 cursor-pointer"
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
          <td colspan="11" class="py-10 text-center text-slate-400 text-sm font-medium">
            No se encontraron recibos con esos filtros.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtrados.map((r) => crearFilaReciboHTML(r, moneda, false)).join('');
  }

  // =========================================================================
  // 3. RENDER PADRÓN DE ALUMNOS (TARJETAS VISUALES + TABLA)
  // =========================================================================
  function getAlumnosFiltrados() {
    const texto = (document.getElementById('filtro-alumnos-texto')?.value || '').trim().toLowerCase();
    const estado = document.getElementById('filtro-alumnos-estado')?.value || 'TODOS';
    const horarioFiltro = document.getElementById('filtro-alumnos-horario')?.value || 'TODOS';

    return store.getAlumnosConEstado().filter((a) => {
      if (texto) {
        const matchNombre = a.nombre_completo.toLowerCase().includes(texto);
        const matchTel = String(a.telefono_whatsapp || '').toLowerCase().includes(texto);
        const matchGrado = String(a.grado_cinturon || '').toLowerCase().includes(texto);
        const matchHorario = String(a.horario_texto || '').toLowerCase().includes(texto);
        if (!matchNombre && !matchTel && !matchGrado && !matchHorario) return false;
      }

      if (horarioFiltro !== 'TODOS') {
        if (horarioFiltro === 'SIN_HORARIO') {
          if (a.horario_id) return false;
        } else if (a.horario_id !== horarioFiltro) {
          return false;
        }
      }

      if (estado === 'ACTIVO' && a.estado_vigencia !== 'ACTIVO') return false;
      if (estado === 'SOLO_INSCRITO' && a.estado_vigencia !== 'SOLO_INSCRITO') return false;
      if (estado === 'POR_VENCER' && a.estado_vigencia !== 'POR_VENCER') return false;
      if (estado === 'VENCIDO' && a.estado_vigencia !== 'VENCIDO') return false;
      if (estado === 'CON_DEUDA' && !(a.saldo_total_pendiente > 0)) return false;

      return true;
    });
  }

  function setModoVistaAlumnos(modo) {
    vistaAlumnosModo = modo;
    const btnTarjetas = document.getElementById('btn-vista-alumnos-tarjetas');
    const btnTabla = document.getElementById('btn-vista-alumnos-tabla');
    const contTarjetas = document.getElementById('contenedor-alumnos-tarjetas');
    const contTabla = document.getElementById('contenedor-alumnos-tabla');

    if (modo === 'TARJETAS') {
      if (btnTarjetas) btnTarjetas.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold brand-bg text-white keep-white-text cursor-pointer';
      if (btnTabla) btnTabla.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white cursor-pointer';
      contTarjetas?.classList.remove('hidden');
      contTabla?.classList.add('hidden');
    } else {
      if (btnTabla) btnTabla.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold brand-bg text-white keep-white-text cursor-pointer';
      if (btnTarjetas) btnTarjetas.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white cursor-pointer';
      contTabla?.classList.remove('hidden');
      contTarjetas?.classList.add('hidden');
    }
  }

  function renderTablaAlumnos(moneda) {
    const tbody = document.getElementById('tabla-alumnos-body');
    const gridTarjetas = document.getElementById('contenedor-alumnos-tarjetas');
    const alumnos = getAlumnosFiltrados();

    if (alumnos.length === 0) {
      if (gridTarjetas) {
        gridTarjetas.innerHTML = `
          <div class="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-sm font-medium">
            No se encontraron alumnos con ese criterio de búsqueda o horario.
          </div>`;
      }
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="py-10 text-center text-slate-400 text-sm">
              No se encontraron alumnos con ese criterio.
            </td>
          </tr>`;
      }
      return;
    }

    // 1. Renderizar Tarjetas Visuales Grandes con Avatar de Cinturón, Horario y Estado Gigante
    if (gridTarjetas) {
      gridTarjetas.innerHTML = alumnos
        .map((a) => {
          const mem = a.ultima_membresia;
          const belt = obtenerEstiloCinturon(a.grado_cinturon);
          const iniciales = obtenerIniciales(a.nombres, a.apellidos);

          let estadoBannerClass = 'bg-slate-800 text-slate-300 border-slate-700';
          let estadoBannerTexto = '⚪ SIN MENSUALIDAD ACTIVA';

          if (a.estado_vigencia === 'ACTIVO') {
            estadoBannerClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
            estadoBannerTexto = `🟢 AL DÍA • Quedan ${a.dias_restantes} día(s)`;
          } else if (a.estado_vigencia === 'SOLO_INSCRITO') {
            estadoBannerClass = 'bg-sky-500/15 text-sky-400 border-sky-500/30';
            estadoBannerTexto = `🎓 INSCRITO • FALTA PAGAR 1ER MES`;
          } else if (a.estado_vigencia === 'POR_VENCER') {
            estadoBannerClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
            estadoBannerTexto = `🟡 POR VENCER • En ${a.dias_restantes} día(s)`;
          } else if (a.estado_vigencia === 'VENCIDO') {
            estadoBannerClass = 'bg-red-500/15 text-red-400 border-red-500/30';
            estadoBannerTexto = `🔴 MENSUALIDAD VENCIDA • Hace ${Math.abs(a.dias_restantes)} día(s)`;
          }

          const memConDeuda = a.membresias_historial?.find((m) => Number(m.saldo_pendiente) > 0);

          return `
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition">
              <div class="space-y-3.5">
                <!-- Estado Gigante Arriba -->
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-black px-3 py-1 rounded-full border ${estadoBannerClass}">
                    ${estadoBannerTexto}
                  </span>
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                    ${a.inscripcion_pagada !== false ? '🎓 Inscrito' : '⚠️ Sin Inscripción'}
                  </span>
                </div>

                <!-- Avatar de color de cinturón + Nombre Grande -->
                <div class="flex items-center gap-3.5">
                  <div class="w-14 h-14 rounded-2xl border-2 flex items-center justify-center font-black text-lg flex-shrink-0 shadow-sm ${belt.bg}">
                    ${iniciales}
                  </div>
                  <div class="min-w-0 flex-1">
                    <button
                      type="button"
                      onclick="window.AppUI.abrirHistorialAlumno('${a.id}')"
                      class="font-black text-base sm:text-lg text-white hover:text-red-400 text-left truncate block w-full cursor-pointer"
                    >
                      ${a.nombre_completo}
                    </button>
                    <p class="text-xs font-bold text-slate-400 mt-0.5">${belt.label}</p>
                    <p class="text-xs font-bold text-sky-400 mt-0.5 truncate">🕒 ${a.horario_texto || 'Sin horario asignado'}</p>
                    ${
                      a.telefono_whatsapp
                        ? `<p class="text-xs text-slate-400 tabular-nums mt-0.5">📱 WhatsApp: <b>${a.telefono_whatsapp}</b></p>`
                        : ''
                    }
                  </div>
                </div>

                <!-- Caja de Fechas y "Lo que debe" en lenguaje sencillo -->
                <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400 font-semibold">Último Plan:</span>
                    <span class="font-extrabold text-white">${mem ? mem.concepto : a.estado_vigencia === 'SOLO_INSCRITO' ? 'Solo Matrícula / Inscripción' : '—'}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400 font-semibold">Vigencia del Mes:</span>
                    <span class="font-bold text-slate-200 tabular-nums">
                      ${mem ? `${formatDatePE(mem.fecha_inicio)} al <b class="text-red-400">${formatDatePE(mem.fecha_fin)}</b>` : 'Pendiente de iniciar mes'}
                    </span>
                  </div>
                  <div class="flex items-center justify-between pt-1.5 border-t border-slate-800">
                    <span class="text-slate-400 font-bold">Lo que debe (Saldo):</span>
                    ${
                      a.saldo_total_pendiente > 0
                        ? `<span class="text-sm font-black text-amber-400 tabular-nums">⚠️ Debe ${moneda} ${a.saldo_total_pendiente.toFixed(2)}</span>`
                        : `<span class="font-extrabold text-emerald-400">✅ No debe nada (${moneda} 0.00)</span>`
                    }
                  </div>
                </div>
              </div>

              <!-- Botones Grandes de Acción en la Tarjeta -->
              <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onclick="window.AppUI.abrirHistorialAlumno('${a.id}')"
                  class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-extrabold text-slate-200 cursor-pointer"
                >
                  📄 Ficha (${a.total_membresias})
                </button>
                <button
                  type="button"
                  onclick="window.AppUI.abrirModalEditarAlumno('${a.id}')"
                  title="Cambiar Horario, Cinturón o Datos del Alumno"
                  class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-extrabold text-slate-200 cursor-pointer"
                >
                  ✏️ Horario / Datos
                </button>
                ${
                  memConDeuda
                    ? `<button
                        type="button"
                        onclick="window.AppUI.abrirModalCobrarSaldo('${memConDeuda.id}')"
                        class="keep-white-text py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-black text-white cursor-pointer"
                      >
                        💰 Deuda
                      </button>`
                    : ''
                }
                <button
                  type="button"
                  onclick="window.AppUI.abrirModalRenovar('${a.id}')"
                  class="keep-white-text flex-1 py-2 px-3 rounded-xl brand-bg text-xs font-black text-white cursor-pointer"
                >
                  ${a.estado_vigencia === 'SOLO_INSCRITO' ? '🥊 Cobrar 1er Mes' : '🥊 Cobrar Mes'}
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }

    // 2. Renderizar también la Tabla Clásica
    if (tbody) {
      tbody.innerHTML = alumnos
        .map((a) => {
          const mem = a.ultima_membresia;
          let badgeVigencia = `<span class="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400">Sin membresía</span>`;
          if (a.estado_vigencia === 'ACTIVO') {
            badgeVigencia = `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 tabular-nums">🟢 Al Día (${a.dias_restantes}d)</span>`;
          } else if (a.estado_vigencia === 'SOLO_INSCRITO') {
            badgeVigencia = `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">🎓 Inscrito (Falta 1er Mes)</span>`;
          } else if (a.estado_vigencia === 'POR_VENCER') {
            badgeVigencia = `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">🟡 Vence en ${a.dias_restantes}d</span>`;
          } else if (a.estado_vigencia === 'VENCIDO') {
            badgeVigencia = `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 tabular-nums">🔴 Vencido (${Math.abs(a.dias_restantes)}d)</span>`;
          }

          const badgeInscrito =
            a.inscripcion_pagada !== false
              ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">🎓 Inscrito</span>`
              : `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">⚠️ Sin inscripción</span>`;

          const saldoHtml =
            a.saldo_total_pendiente > 0
              ? `<span class="font-black text-amber-400 tabular-nums">Debe ${moneda} ${a.saldo_total_pendiente.toFixed(2)}</span>`
              : `<span class="text-emerald-400 font-bold tabular-nums">No debe nada</span>`;

          return `
            <tr class="hover:bg-slate-800/40 transition">
              <td class="py-3.5 px-4">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onclick="window.AppUI.abrirHistorialAlumno('${a.id}')"
                    class="font-bold text-white hover:text-red-400 text-left block cursor-pointer"
                  >
                    ${a.nombre_completo}
                  </button>
                  ${badgeInscrito}
                </div>
                <span class="text-[11px] text-slate-400">${a.total_membresias} registro(s)</span>
              </td>
              <td class="py-3.5 px-4 text-xs">
                <div class="font-semibold text-slate-200">${a.grado_cinturon || 'Principiante'}</div>
                <div class="text-[11px] font-bold text-sky-400 mt-0.5">🕒 ${a.horario_texto || 'Sin horario'}</div>
              </td>
              <td class="py-3.5 px-4 text-xs text-slate-300 tabular-nums">
                <div>${a.telefono_whatsapp || '—'}</div>
                ${a.contacto_emergencia ? `<div class="text-[11px] text-slate-400">Emerg: ${a.contacto_emergencia}</div>` : ''}
              </td>
              <td class="py-3.5 px-4 text-xs font-semibold text-slate-200">${mem ? mem.concepto : a.estado_vigencia === 'SOLO_INSCRITO' ? 'Solo Inscripción' : '—'}</td>
              <td class="py-3.5 px-4 text-xs font-semibold text-slate-200 tabular-nums">${mem ? formatDatePE(mem.fecha_inicio) : '—'}</td>
              <td class="py-3.5 px-4 text-xs font-semibold text-red-300 tabular-nums">${mem ? formatDatePE(mem.fecha_fin) : '—'}</td>
              <td class="py-3.5 px-4 text-center whitespace-nowrap">${badgeVigencia}</td>
              <td class="py-3.5 px-4 text-right whitespace-nowrap">${saldoHtml}</td>
              <td class="py-3.5 px-4 text-center whitespace-nowrap">
                <div class="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onclick="window.AppUI.abrirModalEditarAlumno('${a.id}')"
                    title="Cambiar horario, cinturón o datos"
                    class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onclick="window.AppUI.abrirHistorialAlumno('${a.id}')"
                    class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    Ver Ficha
                  </button>
                  <button
                    type="button"
                    onclick="window.AppUI.abrirModalRenovar('${a.id}')"
                    class="keep-white-text px-3 py-1.5 rounded-xl brand-bg text-xs font-bold text-white cursor-pointer"
                  >
                    ${a.estado_vigencia === 'SOLO_INSCRITO' ? '+ 1er Mes' : 'Cobrar Mes'}
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // =========================================================================
  // 3B. RENDER HORARIOS Y GRUPOS DE ENTRENAMIENTO
  // =========================================================================
  function renderHorarios(moneda) {
    const contenedor = document.getElementById('lista-horarios-grupos');
    if (!contenedor) return;

    const horarios = store.state.horarios || [];
    const todosAlumnos = store.getAlumnosConEstado();

    const crearFilaAlumnoHorarioHTML = (alu) => {
      const belt = obtenerEstiloCinturon(alu.grado_cinturon);
      let badgeEstado = `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Sin plan</span>`;
      if (alu.estado_vigencia === 'ACTIVO') {
        badgeEstado = `<span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Al Día (${alu.dias_restantes}d)</span>`;
      } else if (alu.estado_vigencia === 'SOLO_INSCRITO') {
        badgeEstado = `<span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">🎓 Solo Inscrito</span>`;
      } else if (alu.estado_vigencia === 'POR_VENCER') {
        badgeEstado = `<span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 Vence en ${alu.dias_restantes}d</span>`;
      } else if (alu.estado_vigencia === 'VENCIDO') {
        badgeEstado = `<span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">🔴 Vencido (${Math.abs(alu.dias_restantes)}d)</span>`;
      }

      return `
        <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black flex-shrink-0 ${belt.bg}">
              ${obtenerIniciales(alu.nombres, alu.apellidos)}
            </span>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onclick="window.AppUI.abrirHistorialAlumno('${alu.id}')"
                  class="font-bold text-xs sm:text-sm text-white hover:text-red-400 truncate cursor-pointer"
                >
                  ${alu.nombre_completo}
                </button>
                ${badgeEstado}
                ${
                  alu.saldo_total_pendiente > 0
                    ? `<span class="text-[11px] font-black text-amber-400 tabular-nums">⚠️ Debe ${moneda}${alu.saldo_total_pendiente.toFixed(0)}</span>`
                    : ''
                }
              </div>
              <p class="text-[11px] text-slate-400">${belt.label} ${alu.telefono_whatsapp ? `• 📱 ${alu.telefono_whatsapp}` : ''}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onclick="window.AppUI.abrirModalEditarAlumno('${alu.id}')"
              title="Cambiar de horario o editar datos"
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
            >
              ✏️ Cambiar Turno
            </button>
            <button
              type="button"
              onclick="window.AppUI.abrirModalRenovar('${alu.id}')"
              class="keep-white-text px-3 py-1.5 rounded-lg brand-bg text-xs font-bold text-white cursor-pointer"
            >
              ${alu.estado_vigencia === 'SOLO_INSCRITO' ? '+ 1er Mes' : 'Cobrar Mes'}
            </button>
          </div>
        </div>
      `;
    };

    const tarjetasHorariosHTML = horarios
      .map((h) => {
        const alumnosDelGrupo = todosAlumnos.filter((a) => a.horario_id === h.id);
        const cantAlDia = alumnosDelGrupo.filter((a) => a.estado_vigencia === 'ACTIVO').length;
        const cantAlerta = alumnosDelGrupo.filter(
          (a) => a.estado_vigencia === 'POR_VENCER' || a.estado_vigencia === 'SOLO_INSCRITO'
        ).length;
        const cantVencidos = alumnosDelGrupo.filter((a) => a.estado_vigencia === 'VENCIDO').length;

        return `
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <!-- Cabecera del Horario -->
            <div class="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30">
                    🥋 ${h.disciplina || 'General'}
                  </span>
                  <span class="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30">
                    📅 ${h.dias}
                  </span>
                  <span class="text-xs font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    🕒 ${h.hora}
                  </span>
                </div>
                <h4 class="font-black text-base sm:text-lg text-white mt-2">${h.nombre}</h4>
              </div>

              <!-- Contadores del Grupo -->
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-black px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-white">
                  👥 ${alumnosDelGrupo.length} Alumno(s)
                </span>
                <span class="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-400">
                  🟢 ${cantAlDia} Al Día
                </span>
                ${
                  cantAlerta > 0
                    ? `<span class="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-400">🟡 ${cantAlerta} Alerta/Insc</span>`
                    : ''
                }
                ${
                  cantVencidos > 0
                    ? `<span class="text-xs font-bold px-2.5 py-1 rounded-xl bg-red-500/15 text-red-400">🔴 ${cantVencidos} Vencido(s)</span>`
                    : ''
                }
              </div>
            </div>

            <!-- Lista de Alumnos en este Horario -->
            <div class="space-y-2">
              ${
                alumnosDelGrupo.length === 0
                  ? `<div class="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                      Aún no hay alumnos asignados a este turno.
                    </div>`
                  : alumnosDelGrupo.map(crearFilaAlumnoHorarioHTML).join('')
              }
            </div>

            <!-- Pie de acciones del Horario -->
            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onclick="window.AppUI.inscribirEnHorario('${h.id}')"
                class="keep-white-text px-3.5 py-2 rounded-xl brand-bg text-xs font-bold text-white cursor-pointer"
              >
                + Inscribir Alumno en este Turno
              </button>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick="window.AppUI.editarHorario('${h.id}')"
                  class="text-xs font-bold text-sky-400 hover:text-sky-300 px-2.5 py-1 cursor-pointer"
                >
                  Editar Horario
                </button>
                <button
                  type="button"
                  onclick="window.AppUI.eliminarHorario('${h.id}')"
                  class="text-xs font-bold text-red-400 hover:text-red-300 px-2.5 py-1 cursor-pointer"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Alumnos que aún no tienen horario asignado
    const alumnosSinHorario = todosAlumnos.filter(
      (a) => !a.horario_id || !horarios.some((h) => h.id === a.horario_id)
    );

    const bloqueSinHorarioHTML =
      alumnosSinHorario.length > 0
        ? `
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-black text-base text-white">⚪ Alumnos Pendientes de Asignar a un Horario (${alumnosSinHorario.length})</h4>
                <p class="text-xs text-slate-400">Haz clic en "✏️ Cambiar Turno" para elegir en qué horario entrenan</p>
              </div>
            </div>
            <div class="space-y-2">
              ${alumnosSinHorario.map(crearFilaAlumnoHorarioHTML).join('')}
            </div>
          </div>
        `
        : '';

    contenedor.innerHTML = tarjetasHorariosHTML + bloqueSinHorarioHTML;
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
        <div class="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30">
                ${p.disciplina}
              </span>
              <span class="text-xs font-bold text-slate-400 tabular-nums">${p.duracion_dias} días</span>
            </div>
            <h4 class="font-black text-base text-white mt-2.5">${p.nombre}</h4>
            <p class="text-2xl font-black text-emerald-400 mt-1 tabular-nums">${moneda} ${Number(p.precio_sugerido).toFixed(2)}</p>
          </div>
          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onclick="window.AppUI.editarPlan('${p.id}')"
              class="text-xs font-bold text-sky-400 hover:text-sky-300 px-2.5 py-1 cursor-pointer"
            >
              Editar Precio
            </button>
            <button
              type="button"
              onclick="window.AppUI.eliminarPlan('${p.id}')"
              class="text-xs font-bold text-red-400 hover:text-red-300 px-2.5 py-1 cursor-pointer"
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
    if (document.getElementById('cfg-color-tema')) {
      document.getElementById('cfg-color-tema').value = cfg.color_tema || 'ROJO';
    }
    if (document.getElementById('cfg-tema-visual')) {
      document.getElementById('cfg-tema-visual').value = cfg.tema_visual || 'CLARO';
    }
    if (document.getElementById('cfg-precio-inscripcion')) {
      document.getElementById('cfg-precio-inscripcion').value = Number(cfg.precio_inscripcion ?? 30).toFixed(2);
    }
    document.getElementById('cfg-proximo-recibo').value = cfg.proximo_nro_recibo || 1;
    document.getElementById('cfg-dias-alerta').value = cfg.dias_alerta_vencimiento || 5;
    if (document.getElementById('cfg-pin-admin')) {
      document.getElementById('cfg-pin-admin').value = cfg.pin_admin || '1234';
    }
    if (document.getElementById('cfg-pedir-pin-inicio')) {
      document.getElementById('cfg-pedir-pin-inicio').checked = Boolean(cfg.pedir_pin_inicio);
    }
    const creds = global.SupabaseSync ? global.SupabaseSync.obtenerCredenciales(store) : { url: '', anonKey: '' };
    document.getElementById('cfg-supabase-url').value = cfg.supabase_url || creds.url || '';
    document.getElementById('cfg-supabase-key').value = cfg.supabase_anon_key || creds.anonKey || '';
  }

  // =========================================================================
  // FLUJO MODAL 1: INSCRIPCIÓN / MENSUALIDAD / BOTONES DE ACCIÓN SEPARADOS
  // =========================================================================
  function poblarSelectoresModalPago() {
    const selectPlan = document.getElementById('pago-select-plan');
    const planes = store.state.planes;
    const moneda = store.state.configuracion.moneda || 'S/';

    selectPlan.innerHTML =
      planes
        .map(
          (p) =>
            `<option value="${p.id}">${p.nombre} — ${moneda} ${Number(p.precio_sugerido).toFixed(2)} (${p.duracion_dias} días)</option>`
        )
        .join('') + `<option value="PERSONALIZADO">✍️ Otro monto / Plan personalizado</option>`;

    const selectHorario = document.getElementById('pago-horario');
    if (selectHorario) {
      const horarios = store.state.horarios || [];
      selectHorario.innerHTML =
        horarios
          .map(
            (h) =>
              `<option value="${h.id}">🕒 ${h.hora} (${h.dias}) — ${h.nombre}</option>`
          )
          .join('') + `<option value="">-- Sin horario fijo / Horario libre --</option>`;
    }

    const selectAlumno = document.getElementById('pago-select-alumno');
    const alumnos = store.getAlumnosConEstado();
    selectAlumno.innerHTML =
      `<option value="">-- Haz clic aquí para elegir al alumno --</option>` +
      alumnos
        .map(
          (a) =>
            `<option value="${a.id}">${a.nombre_completo} (${
              a.ultima_membresia
                ? `Vence: ${formatDatePE(a.ultima_membresia.fecha_fin)}`
                : a.estado_vigencia === 'SOLO_INSCRITO'
                ? '🎓 Inscrito - Falta pagar 1er Mes'
                : 'Sin mensualidad'
            })</option>`
        )
        .join('');
  }

  function setModoAlumnoModal(modo) {
    modoModalPago = modo;
    const btnNuevo = document.getElementById('btn-modo-alumno-nuevo');
    const btnExistente = document.getElementById('btn-modo-alumno-existente');
    const bloqueExistente = document.getElementById('bloque-selector-existente');
    const badgeInscripcion = document.getElementById('badge-estado-inscripcion-modal');

    if (modo === 'NUEVO') {
      btnNuevo.className = 'py-2.5 px-3 rounded-lg text-xs sm:text-sm font-extrabold brand-bg text-white keep-white-text transition cursor-pointer';
      btnExistente.className = 'py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition cursor-pointer';
      bloqueExistente.classList.add('hidden');
      document.getElementById('pago-select-alumno').value = '';
      document.getElementById('banner-renovacion-flexible').classList.add('hidden');
      if (badgeInscripcion) badgeInscripcion.classList.add('hidden');
      setTipoOperacionModal('INSCRIPCION_Y_MENSUALIDAD');
    } else {
      btnExistente.className = 'py-2.5 px-3 rounded-lg text-xs sm:text-sm font-extrabold brand-bg text-white keep-white-text transition cursor-pointer';
      btnNuevo.className = 'py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition cursor-pointer';
      bloqueExistente.classList.remove('hidden');
      setTipoOperacionModal('MENSUALIDAD');
    }
  }

  function setTipoOperacionModal(tipo) {
    tipoOperacionPago = tipo;
    document.querySelectorAll('.btn-tipo-operacion').forEach((btn) => {
      const esActivo = btn.getAttribute('data-tipo-op') === tipo;
      btn.className = esActivo
        ? 'btn-tipo-operacion py-2.5 px-3 rounded-lg text-xs font-extrabold brand-bg text-white keep-white-text transition cursor-pointer'
        : 'btn-tipo-operacion py-2.5 px-3 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer';
    });

    const incluyeInscripcion = tipo === 'INSCRIPCION_Y_MENSUALIDAD' || tipo === 'SOLO_INSCRIPCION';
    const soloInscripcion = tipo === 'SOLO_INSCRIPCION';

    document.getElementById('bloque-costo-inscripcion')?.classList.toggle('hidden', !incluyeInscripcion);
    document.getElementById('bloque-select-plan')?.classList.toggle('hidden', soloInscripcion);
    document.getElementById('bloque-fecha-fin')?.classList.toggle('hidden', soloInscripcion);
    document.getElementById('botones-duracion-rapida')?.classList.toggle('hidden', soloInscripcion);

    const lblFechaInicio = document.getElementById('label-pago-fecha-inicio');
    if (lblFechaInicio) {
      lblFechaInicio.textContent = soloInscripcion ? '📅 Fecha de Inscripción *' : '📅 Día que Inicia *';
    }

    aplicarPlanSeleccionado();
  }

  function aplicarPlanSeleccionado() {
    const planId = document.getElementById('pago-select-plan')?.value;
    const plan = store.state.planes.find((p) => p.id === planId);
    const fechaInicio = document.getElementById('pago-fecha-inicio')?.value || getLocalDateISO();
    const montoInscripcion = Number(document.getElementById('pago-monto-inscripcion')?.value || 0);

    if (tipoOperacionPago === 'SOLO_INSCRIPCION') {
      document.getElementById('pago-concepto').value = 'Inscripción / Matrícula en el Sistema';
      document.getElementById('pago-fecha-fin').value = fechaInicio;
      const total = montoInscripcion.toFixed(2);
      document.getElementById('pago-total-pagar').value = total;
      document.getElementById('pago-monto-abonado').value = total;
      ultimoTotalSincronizado = Number(total);
    } else if (plan) {
      const precioPlan = Number(plan.precio_sugerido || 0);
      if (tipoOperacionPago === 'INSCRIPCION_Y_MENSUALIDAD') {
        document.getElementById('pago-concepto').value = `Inscripción + ${plan.nombre}`;
        document.getElementById('pago-fecha-fin').value = calcularFechaFin(fechaInicio, plan.duracion_dias);
        const total = (montoInscripcion + precioPlan).toFixed(2);
        document.getElementById('pago-total-pagar').value = total;
        document.getElementById('pago-monto-abonado').value = total;
        ultimoTotalSincronizado = Number(total);
      } else {
        document.getElementById('pago-concepto').value = plan.nombre;
        document.getElementById('pago-fecha-fin').value = calcularFechaFin(fechaInicio, plan.duracion_dias);
        const total = precioPlan.toFixed(2);
        document.getElementById('pago-total-pagar').value = total;
        document.getElementById('pago-monto-abonado').value = total;
        ultimoTotalSincronizado = Number(total);
      }
    } else if (planId === 'PERSONALIZADO') {
      if (!document.getElementById('pago-fecha-fin').value) {
        document.getElementById('pago-fecha-fin').value = calcularFechaFin(fechaInicio, 30);
      }
      const conceptoEl = document.getElementById('pago-concepto');
      if (!conceptoEl.value || conceptoEl.value.includes('Inscripción / Matrícula')) {
        conceptoEl.value =
          tipoOperacionPago === 'INSCRIPCION_Y_MENSUALIDAD'
            ? 'Inscripción + Plan Personalizado'
            : 'Plan Personalizado';
      }
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
      caja.className = 'rounded-xl p-3.5 border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between';
      txtEstado.className = 'text-xs font-extrabold text-emerald-400';
      txtEstado.textContent = 'PAGADO COMPLETO (NO DEBE NADA)';
      txtSaldo.className = 'text-2xl font-black text-emerald-400 tabular-nums';
    } else {
      caja.className = 'rounded-xl p-3.5 border border-amber-500/40 bg-amber-500/10 flex items-center justify-between';
      txtEstado.className = 'text-xs font-extrabold text-amber-400';
      txtEstado.textContent = 'QUEDA DEBIENDO SALDO';
      txtSaldo.className = 'text-2xl font-black text-amber-400 tabular-nums';
    }

    const nroRecibo = document.getElementById('pago-numero-recibo').value;
    const duplicado = store.existeNumeroRecibo(nroRecibo);
    document.getElementById('aviso-recibo-duplicado').classList.toggle('hidden', !duplicado);
  }

  /**
   * Abre la ventana correspondiente a los 3 botones grandes del inicio:
   * - 'INSCRIBIR_NUEVO'
   * - 'COBRAR_MENSUALIDAD'
   * - 'COBRAR_SALDO'
   */
  function abrirModalAccionDirecta(tipoAccion, horarioPreseleccionadoId = null) {
    if (tipoAccion === 'COBRAR_SALDO') {
      const memsConDeuda = store.state.membresias.filter(
        (m) => Number(m.saldo_pendiente) > 0 && m.estado_pago !== 'ANULADO'
      );
      if (memsConDeuda.length === 0) {
        mostrarToast('🎉 ¡Excelente! Ningún alumno tiene deudas o saldos pendientes por cobrar.', 'info');
        return;
      }
      const selectorBloque = document.getElementById('bloque-selector-deudor');
      const selectDeudor = document.getElementById('saldo-select-membresia');
      const moneda = store.state.configuracion.moneda || 'S/';

      if (selectorBloque && selectDeudor) {
        selectorBloque.classList.remove('hidden');
        selectDeudor.innerHTML = memsConDeuda
          .map((m) => {
            const alu = store.state.alumnos.find((a) => a.id === m.alumno_id);
            const nombre = alu ? `${alu.nombres} ${alu.apellidos}` : 'Alumno';
            return `<option value="${m.id}">${nombre} — Debe ${moneda} ${Number(m.saldo_pendiente).toFixed(2)} (${m.concepto})</option>`;
          })
          .join('');
      }
      cargarMembresiaEnModalSaldo(memsConDeuda[0].id);
      abrirModal('modal-cobrar-saldo');
      return;
    }

    poblarSelectoresModalPago();
    const precioInscDefault = Number(store.state.configuracion.precio_inscripcion ?? 30).toFixed(2);
    if (document.getElementById('pago-monto-inscripcion')) {
      document.getElementById('pago-monto-inscripcion').value = precioInscDefault;
    }

    document.getElementById('pago-nombres').value = '';
    document.getElementById('pago-apellidos').value = '';
    document.getElementById('pago-whatsapp').value = '';
    document.getElementById('pago-grado').value = 'Principiante / Blanco';
    document.getElementById('pago-emergencia').value = '';
    document.getElementById('pago-observacion').value = '';
    document.getElementById('pago-metodo').value = 'EFECTIVO';
    document.getElementById('pago-fecha-inicio').value = getLocalDateISO();
    document.getElementById('pago-numero-recibo').value = store.getProximoNumeroReciboFormateado();

    if (horarioPreseleccionadoId && document.getElementById('pago-horario')) {
      document.getElementById('pago-horario').value = horarioPreseleccionadoId;
    }

    if (tipoAccion === 'COBRAR_MENSUALIDAD') {
      document.getElementById('modal-pago-titulo').textContent = '🥊 2. Cobrar Mensualidad a Alumno Inscrito';
      document.getElementById('modal-pago-subtitulo').textContent = 'Elige al alumno registrado para cobrar su mes de clases';
      setModoAlumnoModal('EXISTENTE');
      abrirModal('modal-nuevo-pago');
      setTimeout(() => document.getElementById('pago-select-alumno')?.focus(), 80);
    } else {
      document.getElementById('modal-pago-titulo').textContent = '🎓 1. Inscribir Alumno Nuevo';
      document.getElementById('modal-pago-subtitulo').textContent = 'Registra los datos del nuevo alumno, su horario y su pago de inscripción';
      setModoAlumnoModal('NUEVO');
      abrirModal('modal-nuevo-pago');
      setTimeout(() => document.getElementById('pago-nombres')?.focus(), 80);
    }
  }

  function inscribirEnHorario(horarioId) {
    abrirModalAccionDirecta('INSCRIBIR_NUEVO', horarioId);
  }

  function abrirModalNuevoPago() {
    abrirModalAccionDirecta('INSCRIBIR_NUEVO');
  }

  function abrirModalRenovar(alumnoId) {
    poblarSelectoresModalPago();
    const precioInscDefault = Number(store.state.configuracion.precio_inscripcion ?? 30).toFixed(2);
    if (document.getElementById('pago-monto-inscripcion')) {
      document.getElementById('pago-monto-inscripcion').value = precioInscDefault;
    }
    setModoAlumnoModal('EXISTENTE');

    document.getElementById('modal-pago-titulo').textContent = '🥊 Cobrar Mensualidad / Renovar';
    document.getElementById('modal-pago-subtitulo').textContent = 'Verifica el horario, plan, fechas de inicio/fin y el monto que abona hoy';
    document.getElementById('pago-select-alumno').value = alumnoId;
    cargarDatosAlumnoEnModal(alumnoId);

    document.getElementById('pago-numero-recibo').value = store.getProximoNumeroReciboFormateado();
    document.getElementById('pago-observacion').value = '';
    abrirModal('modal-nuevo-pago');
  }

  function cargarDatosAlumnoEnModal(alumnoId) {
    const alu = store.getAlumnosConEstado().find((a) => a.id === alumnoId);
    const banner = document.getElementById('banner-renovacion-flexible');
    const badgeInscripcion = document.getElementById('badge-estado-inscripcion-modal');

    if (!alu) {
      banner.classList.add('hidden');
      if (badgeInscripcion) badgeInscripcion.classList.add('hidden');
      return;
    }

    document.getElementById('pago-nombres').value = alu.nombres || '';
    document.getElementById('pago-apellidos').value = alu.apellidos || '';
    document.getElementById('pago-whatsapp').value = alu.telefono_whatsapp || '';
    document.getElementById('pago-grado').value = alu.grado_cinturon || 'Principiante / Blanco';
    document.getElementById('pago-emergencia').value = alu.contacto_emergencia || '';
    if (document.getElementById('pago-horario')) {
      document.getElementById('pago-horario').value = alu.horario_id || '';
    }

    const yaTieneInscripcion = alu.inscripcion_pagada !== false;
    if (badgeInscripcion) {
      badgeInscripcion.classList.remove('hidden');
      if (yaTieneInscripcion) {
        badgeInscripcion.className =
          'text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        badgeInscripcion.textContent = '🎓 Ya tiene Inscripción pagada';
      } else {
        badgeInscripcion.className =
          'text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
        badgeInscripcion.textContent = '⚠️ Aún no registra Inscripción';
      }
    }

    const mem = alu.ultima_membresia;
    if (mem) {
      banner.classList.remove('hidden');
      document.getElementById('texto-vencimiento-anterior').innerHTML =
        `Último vencimiento: <b class="text-white">${formatDatePE(mem.fecha_fin)}</b>`;

      if (mem.plan_id && store.state.planes.some((p) => p.id === mem.plan_id)) {
        document.getElementById('pago-select-plan').value = mem.plan_id;
      }

      document.getElementById('pago-fecha-inicio').value = mem.fecha_fin;
    } else {
      banner.classList.add('hidden');
      document.getElementById('pago-fecha-inicio').value = getLocalDateISO();
    }

    setTipoOperacionModal(yaTieneInscripcion ? 'MENSUALIDAD' : 'INSCRIPCION_Y_MENSUALIDAD');
  }

  // =========================================================================
  // FLUJO MODAL 2: COBRAR SALDO PENDIENTE ("LO QUE DEBE")
  // =========================================================================
  function cargarMembresiaEnModalSaldo(membresiaId) {
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
  }

  function abrirModalCobrarSaldo(membresiaId) {
    document.getElementById('bloque-selector-deudor')?.classList.add('hidden');
    cargarMembresiaEnModalSaldo(membresiaId);
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
    const textoInscripcion = alu.inscripcion_pagada !== false ? '🎓 Inscripción Pagada' : '⚠️ Sin Inscripción';
    document.getElementById('hist-alumno-subtitulo').textContent =
      `${textoInscripcion} • 🕒 ${alu.horario_texto || 'Sin horario'} • ${alu.grado_cinturon || 'Principiante'} • WhatsApp: ${alu.telefono_whatsapp || 'No registrado'}`;

    const recibosAlumno = store
      .getRecibosDetallados()
      .filter((r) => r.alumno_id === alumnoId);

    const htmlMembresias =
      alu.membresias_historial.length === 0
        ? `<p class="text-xs text-slate-400">Sin membresías registradas.</p>`
        : alu.membresias_historial
            .map(
              (m) => `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-extrabold text-sm text-white">${m.concepto}</span>
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    m.estado_pago === 'PAGADO'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-300'
                  }">${m.estado_pago === 'PAGADO' ? 'PAGADO COMPLETO' : 'DEBE SALDO'}</span>
                </div>
                <p class="text-xs text-slate-400 mt-1 tabular-nums">
                  ${
                    m.tipo_operacion === 'SOLO_INSCRIPCION'
                      ? `Fecha de Inscripción: <b>${formatDatePE(m.fecha_inicio)}</b> • <b class="text-emerald-400">PAGO ÚNICO DE INSCRIPCIÓN</b>`
                      : `Día que inicia: <b>${formatDatePE(m.fecha_inicio)}</b> • Día que vence: <b class="text-red-300">${formatDatePE(m.fecha_fin)}</b>`
                  }
                </p>
              </div>
              <div class="text-right tabular-nums">
                <div class="text-xs text-slate-300">Total a Pagar: <b>${moneda} ${Number(m.total_a_pagar).toFixed(2)}</b></div>
                <div class="text-xs ${Number(m.saldo_pendiente) > 0 ? 'text-amber-400 font-black' : 'text-emerald-400 font-bold'}">
                  Lo que debe: ${moneda} ${Number(m.saldo_pendiente).toFixed(2)}
                </div>
                ${
                  Number(m.saldo_pendiente) > 0
                    ? `<button
                        type="button"
                        onclick="window.AppUI.cerrarModal('modal-historial-alumno'); window.AppUI.abrirModalCobrarSaldo('${m.id}')"
                        class="keep-white-text mt-1.5 px-3 py-1 rounded-lg bg-amber-600 text-white font-black text-xs cursor-pointer"
                      >
                        Cobrar lo que debe
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
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 ${
              r.anulado ? 'opacity-50 line-through' : ''
            }">
              <div class="flex items-center gap-3">
                <span class="font-mono font-black text-sm text-emerald-400 tabular-nums">#${r.numero_recibo}</span>
                <div>
                  <p class="text-xs font-bold text-white">${r.observacion || r.membresia?.concepto}</p>
                  <p class="text-[11px] text-slate-400 tabular-nums">${formatDateTimePE(r.fecha_pago)} • ${METODO_LABELS[r.metodo_pago] || r.metodo_pago}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-black text-sm text-emerald-400 tabular-nums">${moneda} ${Number(r.monto_abonado).toFixed(2)}</span>
                <button
                  type="button"
                  onclick="window.AppUI.verComprobanteDigital('${r.id}')"
                  class="keep-white-text px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white cursor-pointer"
                >
                  Ver Recibo
                </button>
              </div>
            </div>`
            )
            .join('');

    document.getElementById('hist-alumno-contenido').innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onclick="window.AppUI.cerrarModal('modal-historial-alumno'); window.AppUI.abrirModalRenovar('${alu.id}')"
            class="keep-white-text px-4 py-2.5 rounded-xl brand-bg text-white font-extrabold text-xs sm:text-sm cursor-pointer"
          >
            + Cobrar Nueva Mensualidad
          </button>
          <button
            type="button"
            onclick="window.AppUI.cerrarModal('modal-historial-alumno'); window.AppUI.abrirModalEditarAlumno('${alu.id}')"
            class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs sm:text-sm cursor-pointer"
          >
            ✏️ Cambiar Horario / Cinturón / Datos
          </button>
        </div>
        <button
          type="button"
          onclick="window.AppUI.eliminarAlumnoConfirm('${alu.id}')"
          class="text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer"
        >
          Eliminar Alumno
        </button>
      </div>
      <div>
        <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">Historial de Inscripción y Mensualidades (${alu.membresias_historial.length})</h4>
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
  // FLUJO MODAL 5: EDITAR DATOS, HORARIO Y CINTURÓN DEL ALUMNO DIRECTAMENTE
  // =========================================================================
  function abrirModalEditarAlumno(alumnoId) {
    const alu = store.getAlumnosConEstado().find((a) => a.id === alumnoId);
    if (!alu) return;

    const selectHorario = document.getElementById('edit-alu-horario');
    if (selectHorario) {
      const horarios = store.state.horarios || [];
      selectHorario.innerHTML =
        horarios
          .map(
            (h) =>
              `<option value="${h.id}">🕒 ${h.hora} (${h.dias}) — ${h.nombre}</option>`
          )
          .join('') + `<option value="">-- Sin horario asignado --</option>`;
      selectHorario.value = alu.horario_id || '';
    }

    document.getElementById('edit-alu-id').value = alu.id;
    document.getElementById('edit-alu-nombres').value = alu.nombres || '';
    document.getElementById('edit-alu-apellidos').value = alu.apellidos || '';
    document.getElementById('edit-alu-grado').value = alu.grado_cinturon || 'Principiante / Blanco';
    document.getElementById('edit-alu-whatsapp').value = alu.telefono_whatsapp || '';
    document.getElementById('edit-alu-emergencia').value = alu.contacto_emergencia || '';
    if (document.getElementById('edit-alu-inscripcion')) {
      document.getElementById('edit-alu-inscripcion').checked = alu.inscripcion_pagada !== false;
    }

    abrirModal('modal-editar-alumno');
    refreshIcons();
  }

  // =========================================================================
  // ACCIONES DE HORARIOS, PLANES, RECIBOS Y SUBIDA DE LOGO
  // =========================================================================
  function editarHorario(horarioId) {
    const h = (store.state.horarios || []).find((x) => x.id === horarioId);
    if (!h) return;
    document.getElementById('form-horario-titulo').textContent = 'Editar Horario / Turno';
    document.getElementById('horario-id').value = h.id;
    document.getElementById('horario-nombre').value = h.nombre || '';
    document.getElementById('horario-dias').value = h.dias || '';
    document.getElementById('horario-hora').value = h.hora || '';
    document.getElementById('horario-disciplina').value = h.disciplina || '';
    document.getElementById('btn-cancelar-horario')?.classList.remove('hidden');
    document.getElementById('horario-nombre')?.focus();
  }

  function resetFormHorario() {
    if (document.getElementById('form-horario-titulo')) {
      document.getElementById('form-horario-titulo').textContent = 'Agregar Nuevo Horario / Turno';
    }
    if (document.getElementById('horario-id')) {
      document.getElementById('horario-id').value = '';
    }
    document.getElementById('form-horario')?.reset();
    document.getElementById('btn-cancelar-horario')?.classList.add('hidden');
  }

  function eliminarHorario(horarioId) {
    if (!esAdmin()) {
      mostrarToast('Solo el Administrador puede eliminar horarios', 'warning');
      abrirModal('modal-login-admin');
      return;
    }
    if (!confirm('¿Deseas eliminar este horario/turno? Los alumnos conservarán su historial.')) return;
    store.eliminarHorario(horarioId);
    mostrarToast('Horario eliminado', 'info');
  }

  function editarPlan(planId) {
    const p = store.state.planes.find((x) => x.id === planId);
    if (!p) return;
    document.getElementById('form-plan-titulo').textContent = 'Editar Plan / Mensualidad';
    document.getElementById('plan-id').value = p.id;
    document.getElementById('plan-nombre').value = p.nombre;
    document.getElementById('plan-disciplina').value = p.disciplina;
    document.getElementById('plan-duracion').value = p.duracion_dias;
    document.getElementById('plan-precio').value = p.precio_sugerido;
    document.getElementById('btn-cancelar-plan').classList.remove('hidden');
  }

  function resetFormPlan() {
    document.getElementById('form-plan-titulo').textContent = 'Agregar Plan o Mensualidad';
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

  function procesarSubidaLogo(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 220;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        store.actualizarConfiguracion({ logo_url: dataUrl });
        mostrarToast('¡Logo del gimnasio actualizado!');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // =========================================================================
  // BUSCADOR INSTANTÁNEO DE RECEPCIÓN (BARRA SUPERIOR GIGANTE)
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
      resultsBox.innerHTML = `<div class="p-4 text-sm text-slate-400 text-center font-medium">Sin resultados para "${query}"</div>`;
      resultsBox.classList.remove('hidden');
      return;
    }

    let html = '';

    if (alumnosMatch.length > 0) {
      html += `<div class="px-4 py-2 bg-slate-950 text-xs font-extrabold uppercase tracking-wider text-slate-400">Alumnos Encontrados</div>`;
      html += alumnosMatch
        .map((a) => {
          const mem = a.ultima_membresia;
          const semaforo =
            a.estado_vigencia === 'ACTIVO'
              ? '🟢 AL DÍA'
              : a.estado_vigencia === 'SOLO_INSCRITO'
              ? '🎓 SOLO INSCRITO (FALTA 1ER MES)'
              : a.estado_vigencia === 'POR_VENCER'
              ? `🟡 VENCE EN ${a.dias_restantes}D`
              : a.estado_vigencia === 'VENCIDO'
              ? '🔴 VENCIDO'
              : '⚪ SIN PLAN';

          return `
            <div class="p-3.5 hover:bg-slate-800/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-extrabold text-sm sm:text-base text-white">${a.nombre_completo}</span>
                  <span class="text-xs font-extrabold">${semaforo}</span>
                </div>
                <p class="text-xs text-slate-400 tabular-nums mt-0.5">
                  ${mem ? `${mem.concepto} • Vence: ${formatDatePE(mem.fecha_fin)}` : a.estado_vigencia === 'SOLO_INSCRITO' ? 'Inscrito (Pendiente 1ra Mensualidad)' : 'Sin membresía'}
                  ${a.saldo_total_pendiente > 0 ? ` • <b class="text-amber-400">Lo que debe: ${moneda} ${a.saldo_total_pendiente.toFixed(2)}</b>` : ''}
                </p>
              </div>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  onclick="document.getElementById('global-search-results').classList.add('hidden'); window.AppUI.abrirHistorialAlumno('${a.id}')"
                  class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                >
                  Ver Ficha
                </button>
                <button
                  type="button"
                  onclick="document.getElementById('global-search-results').classList.add('hidden'); window.AppUI.abrirModalRenovar('${a.id}')"
                  class="keep-white-text px-3 py-1.5 rounded-xl brand-bg text-xs font-bold text-white cursor-pointer"
                >
                  ${a.estado_vigencia === 'SOLO_INSCRITO' ? '+ 1er Mes' : 'Cobrar Mes'}
                </button>
              </div>
            </div>`;
        })
        .join('');
    }

    if (recibosMatch.length > 0) {
      html += `<div class="px-4 py-2 bg-slate-950 text-xs font-extrabold uppercase tracking-wider text-slate-400">Recibos por Número</div>`;
      html += recibosMatch
        .map(
          (r) => `
          <div class="p-3.5 hover:bg-slate-800/40 border-b border-slate-800 flex items-center justify-between gap-2">
            <div>
              <span class="font-mono font-black text-sm text-emerald-400">#${r.numero_recibo}</span>
              <span class="text-sm font-extrabold text-white ml-2">${r.nombre_completo}</span>
              <p class="text-xs text-slate-400 tabular-nums">
                ${r.membresia?.concepto} • Pagó: ${moneda} ${Number(r.monto_abonado).toFixed(2)}
              </p>
            </div>
            <button
              type="button"
              onclick="document.getElementById('global-search-results').classList.add('hidden'); window.AppUI.verComprobanteDigital('${r.id}')"
              class="keep-white-text px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold cursor-pointer"
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
    store.subscribe(() => renderTodo());

    // Navegación por menú lateral
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => cambiarTab(btn.getAttribute('data-tab')));
    });

    // Conmutar vista de alumnos: Tarjetas Grandes vs Tabla
    document.getElementById('btn-vista-alumnos-tarjetas')?.addEventListener('click', () => setModoVistaAlumnos('TARJETAS'));
    document.getElementById('btn-vista-alumnos-tabla')?.addEventListener('click', () => setModoVistaAlumnos('TABLA'));

    // Botones de cambio rápido entre Modo Claro y Modo Oscuro
    const toggleTemaFn = () => {
      const actual = store.state.configuracion.tema_visual || 'CLARO';
      const nuevo = actual === 'CLARO' ? 'OSCURO' : 'CLARO';
      store.actualizarConfiguracion({ tema_visual: nuevo });
      mostrarToast(nuevo === 'CLARO' ? '☀️ Modo Claro activado' : '🌙 Modo Oscuro activado', 'info');
    };
    document.getElementById('btn-toggle-tema')?.addEventListener('click', toggleTemaFn);
    document.getElementById('btn-toggle-tema-mobile')?.addEventListener('click', toggleTemaFn);

    // Subir o quitar Logo del Gimnasio
    document.getElementById('input-subir-logo')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) procesarSubidaLogo(file);
    });
    document.getElementById('btn-quitar-logo')?.addEventListener('click', () => {
      store.actualizarConfiguracion({ logo_url: '' });
      mostrarToast('Logo quitado', 'info');
    });

    // Cerrar modales
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => cerrarModal(btn.getAttribute('data-close-modal')));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        [
          'modal-nuevo-pago',
          'modal-cobrar-saldo',
          'modal-comprobante',
          'modal-historial-alumno',
          'modal-editar-alumno'
        ].forEach(cerrarModal);
        document.getElementById('global-search-results')?.classList.add('hidden');
      }
    });

    // Buscador global gigante
    const globalSearchInput = document.getElementById('global-search-input');
    globalSearchInput?.addEventListener('input', (e) => manejarBusquedaGlobal(e.target.value));
    document.addEventListener('click', (e) => {
      const box = document.getElementById('global-search-results');
      if (box && !box.contains(e.target) && e.target !== globalSearchInput) {
        box.classList.add('hidden');
      }
    });

    // Botón superior "Registrar Cobro Rápido"
    document.getElementById('btn-open-nuevo-pago')?.addEventListener('click', abrirModalNuevoPago);

    // Conmutador Alumno Nuevo vs Existente en Modal 1
    document.getElementById('btn-modo-alumno-nuevo')?.addEventListener('click', () => setModoAlumnoModal('NUEVO'));
    document.getElementById('btn-modo-alumno-existente')?.addEventListener('click', () => setModoAlumnoModal('EXISTENTE'));

    // Conmutador de modalidad de operación
    document.querySelectorAll('.btn-tipo-operacion').forEach((btn) => {
      btn.addEventListener('click', () => setTipoOperacionModal(btn.getAttribute('data-tipo-op')));
    });

    document.getElementById('pago-monto-inscripcion')?.addEventListener('input', aplicarPlanSeleccionado);

    document.getElementById('pago-select-alumno')?.addEventListener('change', (e) => {
      cargarDatosAlumnoEnModal(e.target.value);
    });

    document.getElementById('saldo-select-membresia')?.addEventListener('change', (e) => {
      cargarMembresiaEnModalSaldo(e.target.value);
    });

    // Botones de renovación flexible
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
      if (tipoOperacionPago === 'SOLO_INSCRIPCION') {
        document.getElementById('pago-fecha-fin').value = e.target.value;
        return;
      }
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

      if (modoModalPago === 'EXISTENTE' && !alumnoId) {
        mostrarToast('Por favor selecciona primero al alumno registrado en la lista superior', 'warning');
        document.getElementById('pago-select-alumno')?.focus();
        return;
      }

      const resultado = store.registrarInscripcionOPago({
        alumnoId,
        nombres: document.getElementById('pago-nombres').value,
        apellidos: document.getElementById('pago-apellidos').value,
        telefono_whatsapp: document.getElementById('pago-whatsapp').value,
        grado_cinturon: document.getElementById('pago-grado').value,
        horario_id: document.getElementById('pago-horario')?.value || null,
        contacto_emergencia: document.getElementById('pago-emergencia').value,
        tipo_operacion: tipoOperacionPago,
        incluye_inscripcion: tipoOperacionPago !== 'MENSUALIDAD',
        monto_inscripcion: document.getElementById('pago-monto-inscripcion')?.value || 0,
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
      mostrarToast(`Recibo #${resultado.recibo.numero_recibo} guardado correctamente`);

      if (submitMode === 'digital') {
        verComprobanteDigital(resultado.recibo.id);
      }
    });

    // Submit Formulario Editar Alumno (Horario, Cinturón, Datos)
    document.getElementById('form-editar-alumno')?.addEventListener('submit', (e) => {
      e.preventDefault();
      store.guardarAlumno({
        id: document.getElementById('edit-alu-id').value,
        nombres: document.getElementById('edit-alu-nombres').value,
        apellidos: document.getElementById('edit-alu-apellidos').value,
        horario_id: document.getElementById('edit-alu-horario').value || null,
        grado_cinturon: document.getElementById('edit-alu-grado').value,
        telefono_whatsapp: document.getElementById('edit-alu-whatsapp').value,
        contacto_emergencia: document.getElementById('edit-alu-emergencia').value,
        inscripcion_pagada: Boolean(document.getElementById('edit-alu-inscripcion')?.checked)
      });
      cerrarModal('modal-editar-alumno');
      mostrarToast('Datos y horario del alumno actualizados');
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

    ['filtro-alumnos-texto', 'filtro-alumnos-estado', 'filtro-alumnos-horario'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () =>
        renderTablaAlumnos(store.state.configuracion.moneda || 'S/')
      );
      document.getElementById(id)?.addEventListener('change', () =>
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

    // Gestión de Horarios / Turnos
    document.querySelectorAll('.btn-quick-dias').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('horario-dias');
        if (input) input.value = btn.getAttribute('data-quick-dias') || '';
      });
    });

    document.querySelectorAll('.btn-quick-hora').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('horario-hora');
        if (input) input.value = btn.getAttribute('data-quick-hora') || '';
      });
    });

    document.getElementById('form-horario')?.addEventListener('submit', (e) => {
      e.preventDefault();
      store.guardarHorario({
        id: document.getElementById('horario-id').value || null,
        nombre: document.getElementById('horario-nombre').value,
        dias: document.getElementById('horario-dias').value,
        hora: document.getElementById('horario-hora').value,
        disciplina: document.getElementById('horario-disciplina').value
      });
      resetFormHorario();
      mostrarToast('Horario / Turno guardado correctamente');
    });

    document.getElementById('btn-cancelar-horario')?.addEventListener('click', resetFormHorario);

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
        color_tema: document.getElementById('cfg-color-tema')?.value || 'ROJO',
        tema_visual: document.getElementById('cfg-tema-visual')?.value || 'CLARO',
        precio_inscripcion: Number(document.getElementById('cfg-precio-inscripcion')?.value ?? 30),
        proximo_nro_recibo: Number(document.getElementById('cfg-proximo-recibo').value) || 1,
        dias_alerta_vencimiento: Number(document.getElementById('cfg-dias-alerta').value) || 5,
        pin_admin: document.getElementById('cfg-pin-admin')?.value.trim() || '1234',
        pedir_pin_inicio: Boolean(document.getElementById('cfg-pedir-pin-inicio')?.checked)
      });
      mostrarToast('Configuración, colores y precios actualizados');
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
    abrirModalAccionDirecta,
    inscribirEnHorario,
    abrirModalNuevoPago,
    abrirModalRenovar,
    abrirModalCobrarSaldo,
    verComprobanteDigital,
    abrirHistorialAlumno,
    abrirModalEditarAlumno,
    editarHorario,
    eliminarHorario,
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
