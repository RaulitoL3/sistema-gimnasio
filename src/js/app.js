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

  const {
    escapeHTML,
    safeId,
    toastContent,
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
  } = global.UITemplates;

  let tabActual = 'dashboard';
  let vistaAlumnosModo = 'TARJETAS'; // 'TARJETAS' | 'TABLA'
  let modoModalPago = 'NUEVO'; // 'NUEVO' | 'EXISTENTE'
  let tipoOperacionPago = 'INSCRIPCION_Y_MENSUALIDAD'; // 'INSCRIPCION_Y_MENSUALIDAD' | 'SOLO_INSCRIPCION' | 'MENSUALIDAD'
  let reciboActualEnVisor = null;
  let ultimoTotalSincronizado = 0;
  let adminInactivityTimer = null;
  let configFormDirty = false;
  const ADMIN_INACTIVITY_MS = 5 * 60 * 1000; // 5 minutos

  function mostrarToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.classList.add('ui-toast');
    toast.dataset.tone = ['success', 'warning', 'error', 'info'].includes(tipo) ? tipo : 'success';
    toast.innerHTML = toastContent(mensaje);
    container.appendChild(toast);
    setTimeout(() => {
      toast.dataset.closing = 'true';
      setTimeout(() => toast.remove(), 300);
    }, 3400);
  }

  function refreshIcons() {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }
  }

  function esAdmin() {
    return (store.state.configuracion.rol_actual || 'RECEPCION') === 'ADMIN';
  }

  function reiniciarTemporizadorInactividadAdmin() {
    if (adminInactivityTimer) {
      clearTimeout(adminInactivityTimer);
      adminInactivityTimer = null;
    }
    if (!esAdmin()) return;
    adminInactivityTimer = setTimeout(() => {
      if (esAdmin()) {
        store.registrarActividad(
          'Auto-bloqueo por inactividad',
          'Sesión Admin cerrada tras 5 min sin uso',
          null,
          true
        );
        store.setRolDispositivoActual('RECEPCION');
        if (tabActual === 'configuracion' || tabActual === 'planes') {
          cambiarTab('dashboard');
        } else {
          renderTodo();
        }
        mostrarToast('🔒 Sesión Admin bloqueada por 5 min de inactividad. Volviste a Modo Recepción.', 'info');
      }
    }, ADMIN_INACTIVITY_MS);
  }

  function obtenerPerfilesOperadores() {
    const raw = store.state.configuracion.perfiles_operadores;
    const base =
      Array.isArray(raw) && raw.length > 0
        ? raw
        : ['Recepción', 'Profesor / Coach', 'Administrador'];
    const limpios = [];
    base.forEach((item) => {
      const val = String(item || '').trim();
      if (val && val.toUpperCase() !== 'OTRO' && !limpios.includes(val)) {
        limpios.push(val);
      }
    });
    return limpios.length > 0 ? limpios : ['Recepción'];
  }

  function agregarOpcionesSelect(selectEl, items) {
    selectEl.innerHTML = '';
    items.forEach(({ value, text }) => {
      const opt = document.createElement('option');
      opt.value = value;
      if (text !== undefined) opt.textContent = text;
      selectEl.appendChild(opt);
    });
  }

  function renderEmptyTableRow(tbody, colSpan, text) {
    if (!tbody) return;
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colSpan;
    td.innerHTML = emptyState({ text });
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function poblarSelectoresOperadores() {
    const perfiles = obtenerPerfilesOperadores();
    const operadorActual = store.getOperadorActual();

    const selAcceso = document.getElementById('acceso-inicial-operador');
    const inputOtroAcceso = document.getElementById('acceso-inicial-operador-otro');
    if (selAcceso) {
      const modalAbierto = !document.getElementById('modal-acceso-inicial')?.classList.contains('hidden');
      const valorPrevio = modalAbierto ? selAcceso.value : operadorActual;

      agregarOpcionesSelect(selAcceso, [
        ...perfiles.map((p) => ({ value: p, text: p })),
        { value: 'OTRO', text: '✏️ Otro nombre (escribir)…' }
      ]);

      if (valorPrevio === 'OTRO') {
        selAcceso.value = 'OTRO';
        inputOtroAcceso?.classList.remove('hidden');
      } else if (perfiles.includes(valorPrevio)) {
        selAcceso.value = valorPrevio;
        inputOtroAcceso?.classList.add('hidden');
      } else if (
        !modalAbierto &&
        operadorActual &&
        operadorActual !== 'Recepción' &&
        operadorActual !== 'Administrador'
      ) {
        selAcceso.value = 'OTRO';
        if (inputOtroAcceso) {
          inputOtroAcceso.value = operadorActual;
          inputOtroAcceso.classList.remove('hidden');
        }
      } else {
        selAcceso.value = perfiles[0];
        inputOtroAcceso?.classList.add('hidden');
      }
    }

    const selLogin = document.getElementById('login-select-operador');
    if (selLogin) {
      const modalLoginAbierto = !document.getElementById('modal-login-admin')?.classList.contains('hidden');
      const opcionesLogin = [];
      ['Administrador', ...perfiles, operadorActual].forEach((n) => {
        const val = String(n || '').trim();
        if (val && !opcionesLogin.includes(val)) opcionesLogin.push(val);
      });
      const valorPrevioLogin = modalLoginAbierto && selLogin.value ? selLogin.value : operadorActual;
      agregarOpcionesSelect(
        selLogin,
        opcionesLogin.map((p) => ({ value: p, text: p }))
      );
      selLogin.value = opcionesLogin.includes(valorPrevioLogin) ? valorPrevioLogin : 'Administrador';
    }

    const datalist = document.getElementById('lista-cobradores-sugeridos');
    if (datalist) {
      const sugerencias = [];
      [...perfiles, 'Recepción', 'Administrador', operadorActual].forEach((n) => {
        const val = String(n || '').trim();
        if (val && !sugerencias.includes(val)) sugerencias.push(val);
      });
      agregarOpcionesSelect(
        datalist,
        sugerencias.map((p) => ({ value: p }))
      );
    }

    const filtroOp = document.getElementById('filtro-recibos-operador');
    if (filtroOp) {
      const previoFiltro = filtroOp.value || 'TODOS';
      filtroOp.innerHTML = optionsOperadoresFiltro(perfiles, store.state.recibos || [], previoFiltro);
    }
  }

  function verificarAccesoInicial() {
    const pedirPin = store.state.configuracion.pedir_pin_inicio !== false;
    if (!pedirPin) {
      sessionStorage.setItem('gym_acceso_recepcion_ok', 'true');
    }
    const yaVerificado = sessionStorage.getItem('gym_acceso_recepcion_ok') === 'true';
    store.setRolDispositivoActual('RECEPCION');
    poblarSelectoresOperadores();
    if (!yaVerificado && pedirPin) {
      const errEl = document.getElementById('acceso-inicial-error');
      const inputEl = document.getElementById('acceso-inicial-pin');
      if (errEl) errEl.classList.add('hidden');
      if (inputEl) inputEl.value = '';
      abrirModal('modal-acceso-inicial');
      setTimeout(() => document.getElementById('acceso-inicial-pin')?.focus(), 100);
    }
  }

  function setMetodoPagoUI(metodo) {
    const val = metodo || 'EFECTIVO';
    const hidden = document.getElementById('pago-metodo');
    if (hidden) hidden.value = val;
    document.querySelectorAll('.btn-metodo-pago').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-metodo') === val);
    });
  }

  function setMetodoSaldoUI(metodo) {
    const val = metodo || 'EFECTIVO';
    const hidden = document.getElementById('saldo-metodo-pago');
    if (hidden) hidden.value = val;
    document.querySelectorAll('.btn-metodo-saldo').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-metodo') === val);
    });
  }

  /**
   * Aplica tema Claro/Oscuro, color de marca y logo de la academia
   */
  function aplicarIdentidadVisual() {
    const cfg = store.state.configuracion;
    const colorTema = cfg.color_tema || 'ROJO';
    const temaVisual = cfg.tema_visual || 'CLARO';
    const themeVal = temaVisual === 'OSCURO' ? 'dark' : 'light';

    document.documentElement.dataset.theme = themeVal;
    document.body.dataset.theme = themeVal;
    document.body.dataset.brand = colorTema;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', themeVal === 'dark' ? '#0B0F14' : '#F5F6F8');
    }

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
    if (tabName !== tabActual) {
      configFormDirty = false;
    }
    tabActual = tabName;
    const tabs = ['dashboard', 'alumnos', 'horarios', 'recibos', 'planes', 'configuracion'];
    tabs.forEach((t) => {
      const sec = document.getElementById(`view-${t}`);
      if (sec) sec.classList.toggle('hidden', t !== tabName);
    });

    document.querySelectorAll('.nav-tab-btn, .mobile-nav-btn').forEach((btn) => {
      const isSelected = btn.getAttribute('data-tab') === tabName;
      btn.dataset.active = isSelected ? 'true' : 'false';
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

    agregarOpcionesSelect(selectFiltro, [
      { value: 'TODOS', text: `Todos los horarios (${store.state.alumnos.length})` },
      ...horarios.map((h) => {
        const count = store.state.alumnos.filter((a) => a.horario_id === h.id).length;
        return {
          value: h.id,
          text: `🕒 ${h.hora} (${h.dias}) — ${h.nombre} [${count}]`
        };
      }),
      { value: 'SIN_HORARIO', text: '⚪ Sin horario asignado' }
    ]);

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
    poblarSelectoresOperadores();
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

    const operadorActual = store.getOperadorActual();
    const badgeRol = document.getElementById('badge-rol-actual');
    const btnRol = document.getElementById('btn-cambiar-rol');
    if (badgeRol && btnRol) {
      const admin = esAdmin();
      badgeRol.textContent = admin
        ? `🔓 ADMIN • ${operadorActual}`
        : `🔒 RECEPCIÓN • ${operadorActual}`;
      btnRol.dataset.role = admin ? 'ADMIN' : 'RECEPCION';
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

    // Ingresos de Hoy (con desglose Efectivo vs Digital)
    const recibosHoy = recibosValidos.filter((r) => getLocalDateISO(new Date(r.fecha_pago)) === hoyISO);
    const totalHoy = recibosHoy.reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
    const hoyEfectivo = recibosHoy
      .filter((r) => r.metodo_pago === 'EFECTIVO')
      .reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
    const hoyDigital = totalHoy - hoyEfectivo;

    document.getElementById('kpi-ingresos-hoy').textContent = `${moneda} ${totalHoy.toFixed(2)}`;
    document.getElementById('kpi-ingresos-hoy-detalle').textContent = `${recibosHoy.length} recibo(s) cobrado(s) hoy`;
    const kpiHoyEfectivo = document.getElementById('kpi-hoy-efectivo');
    const kpiHoyDigital = document.getElementById('kpi-hoy-digital');
    if (kpiHoyEfectivo) kpiHoyEfectivo.textContent = `💵 Efectivo: ${moneda} ${hoyEfectivo.toFixed(2)}`;
    if (kpiHoyDigital) kpiHoyDigital.textContent = `📱 Digital: ${moneda} ${hoyDigital.toFixed(2)}`;

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

    document.getElementById('kpi-alumnos-activos').textContent = `${activos.length} Vigentes`;
    document.getElementById('kpi-alumnos-alertas').textContent = `${porVencer.length} por vencer • ${vencidos.length} vencidos`;

    // Bandeja 1: Alertas de Vencimiento
    const alertasVencimiento = [...porVencer, ...vencidos].sort((a, b) => (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999));
    document.getElementById('badge-count-vencimientos').textContent = alertasVencimiento.length;

    const contenedorVenc = document.getElementById('dashboard-lista-vencimientos');
    if (contenedorVenc) {
      if (alertasVencimiento.length === 0) {
        contenedorVenc.innerHTML = emptyState({
          text: '🎉 ¡Excelente! Todos los alumnos están al día con sus mensualidades.'
        });
      } else {
        const helpersVenc = {
          formatDatePE,
          generarLinkWhatsAppRecordatorio,
          config: store.state.configuracion
        };
        contenedorVenc.innerHTML = alertasVencimiento
          .map((alu) => alertaVencimientoItem(alu, helpersVenc))
          .join('');
      }
    }

    // Bandeja 2: Alumnos con Saldo Pendiente ("Lo que deben")
    document.getElementById('badge-count-saldos').textContent = membresiasConSaldo.length;
    const contenedorSaldos = document.getElementById('dashboard-lista-saldos');

    if (contenedorSaldos) {
      if (membresiasConSaldo.length === 0) {
        contenedorSaldos.innerHTML = emptyState({
          text: '✅ Ningún alumno debe saldo pendiente en este momento.'
        });
      } else {
        const helpersSaldo = {
          generarLinkWhatsAppRecordatorio,
          config: store.state.configuracion
        };
        contenedorSaldos.innerHTML = membresiasConSaldo
          .map((mem) => {
            const alu = alumnosConEstado.find((a) => a.id === mem.alumno_id) || {
              id: mem.alumno_id,
              nombres: 'Alumno',
              apellidos: '',
              nombre_completo: 'Alumno'
            };
            return alertaSaldoItem(mem, alu, moneda, helpersSaldo);
          })
          .join('');
      }
    }

    // Tabla Últimos Recibos en Dashboard
    const ultimosRecibos = store.getRecibosDetallados().slice(0, 8);
    const tbodyUltimos = document.getElementById('dashboard-ultimos-recibos');
    if (tbodyUltimos) {
      if (ultimosRecibos.length === 0) {
        renderEmptyTableRow(tbodyUltimos, 10, 'Aún no hay recibos registrados.');
      } else {
        const helpersRecibo = { formatDatePE, formatDateTimePE, METODO_LABELS };
        tbodyUltimos.innerHTML = ultimosRecibos
          .map((r) => filaRecibo(r, moneda, true, helpersRecibo))
          .join('');
      }
    }

    // Bitácora de Auditoría en vivo (visible para saber quién realizó cada cambio)
    const bloqueAudit = document.getElementById('bloque-auditoria-admin');
    const listaAudit = document.getElementById('lista-auditoria-reciente');
    if (bloqueAudit && listaAudit) {
      bloqueAudit.classList.remove('hidden');
      const actividades = (store.state.actividades || []).slice(0, 25);
      if (actividades.length === 0) {
        listaAudit.innerHTML = emptyState({
          text: 'Aún no hay movimientos registrados en la bitácora de esta sesión.'
        });
      } else {
        listaAudit.innerHTML = actividades
          .map((act) => auditoriaItem(act, { formatDateTimePE }))
          .join('');
      }
    }

    refreshIcons();
  }

  // =========================================================================
  // 2. RENDER TABLA DE RECIBOS Y CAJA
  // =========================================================================
  function getRecibosFiltrados() {
    const texto = (document.getElementById('filtro-recibos-texto')?.value || '').trim().toLowerCase();
    const periodo = document.getElementById('filtro-recibos-periodo')?.value || 'TODOS';
    const metodo = document.getElementById('filtro-recibos-metodo')?.value || 'TODOS';
    const operador = (document.getElementById('filtro-recibos-operador')?.value || 'TODOS').trim();

    const hoyISO = getLocalDateISO();
    const mesActualPrefix = hoyISO.slice(0, 7);

    return store.getRecibosDetallados().filter((r) => {
      if (texto) {
        const matchRecibo = String(r.numero_recibo).toLowerCase().includes(texto);
        const matchNombre = String(r.nombre_completo).toLowerCase().includes(texto);
        const matchConcepto = String(r.membresia?.concepto || '').toLowerCase().includes(texto);
        const matchCobrador = String(r.cobrado_por || '').toLowerCase().includes(texto);
        if (!matchRecibo && !matchNombre && !matchConcepto && !matchCobrador) return false;
      }

      if (metodo !== 'TODOS' && r.metodo_pago !== metodo) return false;
      if (operador !== 'TODOS') {
        const cobrador = String(r.cobrado_por || 'Recepción').trim().toLowerCase();
        if (cobrador !== operador.toLowerCase()) return false;
      }

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
      renderEmptyTableRow(tbody, 12, 'No se encontraron recibos con esos filtros.');
      refreshIcons();
      return;
    }

    const helpersRecibo = { formatDatePE, formatDateTimePE, METODO_LABELS };
    tbody.innerHTML = filtrados.map((r) => filaRecibo(r, moneda, false, helpersRecibo)).join('');
    refreshIcons();
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

    const esTarjetas = modo === 'TARJETAS';
    if (btnTarjetas) btnTarjetas.dataset.active = esTarjetas ? 'true' : 'false';
    if (btnTabla) btnTabla.dataset.active = esTarjetas ? 'false' : 'true';
    contTarjetas?.classList.toggle('hidden', !esTarjetas);
    contTabla?.classList.toggle('hidden', esTarjetas);
  }

  function renderTablaAlumnos(moneda) {
    const tbody = document.getElementById('tabla-alumnos-body');
    const gridTarjetas = document.getElementById('contenedor-alumnos-tarjetas');
    const alumnos = getAlumnosFiltrados();

    if (alumnos.length === 0) {
      if (gridTarjetas) {
        gridTarjetas.innerHTML = emptyState({
          text: 'No se encontraron alumnos con ese criterio de búsqueda o horario.'
        });
        if (gridTarjetas.firstElementChild) {
          gridTarjetas.firstElementChild.style.gridColumn = '1 / -1';
        }
      }
      if (tbody) {
        renderEmptyTableRow(tbody, 9, 'No se encontraron alumnos con ese criterio.');
      }
      refreshIcons();
      return;
    }

    const helpersAlumno = { formatDatePE };
    if (gridTarjetas) {
      gridTarjetas.innerHTML = alumnos.map((a) => tarjetaAlumno(a, moneda, helpersAlumno)).join('');
    }
    if (tbody) {
      tbody.innerHTML = alumnos.map((a) => filaAlumnoTabla(a, moneda, helpersAlumno)).join('');
    }
    refreshIcons();
  }

  // =========================================================================
  // 3B. RENDER HORARIOS Y GRUPOS DE ENTRENAMIENTO
  // =========================================================================
  function renderHorarios(moneda) {
    const contenedor = document.getElementById('lista-horarios-grupos');
    if (!contenedor) return;

    const horarios = store.state.horarios || [];
    const todosAlumnos = store.getAlumnosConEstado();
    const helpersHorario = { formatDatePE };

    const tarjetasHorariosHTML = horarios
      .map((h) => {
        const alumnosDelGrupo = todosAlumnos.filter((a) => a.horario_id === h.id);
        return grupoHorarioCard(h, alumnosDelGrupo, moneda, helpersHorario);
      })
      .join('');

    // Alumnos que aún no tienen horario asignado
    const alumnosSinHorario = todosAlumnos.filter(
      (a) => !a.horario_id || !horarios.some((h) => h.id === a.horario_id)
    );
    const bloqueSinHorarioHTML = bloqueSinHorarioCard(alumnosSinHorario, moneda, helpersHorario);

    if (!tarjetasHorariosHTML && !bloqueSinHorarioHTML) {
      contenedor.innerHTML = emptyState({
        text: 'Aún no hay horarios o turnos registrados.'
      });
      if (contenedor.firstElementChild) {
        contenedor.firstElementChild.style.gridColumn = '1 / -1';
      }
    } else {
      contenedor.innerHTML = tarjetasHorariosHTML + bloqueSinHorarioHTML;
    }
    refreshIcons();
  }

  // =========================================================================
  // 4. RENDER PLANES Y DISCIPLINAS
  // =========================================================================
  function renderPlanes(moneda) {
    const grid = document.getElementById('lista-planes-grid');
    if (!grid) return;

    const planes = store.state.planes || [];
    if (planes.length === 0) {
      grid.innerHTML = emptyState({
        text: 'No hay planes registrados en el catálogo.'
      });
      if (grid.firstElementChild) {
        grid.firstElementChild.style.gridColumn = '1 / -1';
      }
    } else {
      grid.innerHTML = planes.map((p) => tarjetaPlan(p, moneda)).join('');
    }
    refreshIcons();
  }

  // =========================================================================
  // 5. RENDER CONFIGURACIÓN
  // =========================================================================
  function renderConfiguracion() {
    if (tabActual === 'configuracion' && configFormDirty) {
      return;
    }
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
    if (document.getElementById('cfg-pin-recepcion')) {
      document.getElementById('cfg-pin-recepcion').value = cfg.pin_recepcion || '2026';
    }
    if (document.getElementById('cfg-pin-admin')) {
      document.getElementById('cfg-pin-admin').value = cfg.pin_admin || '1234';
    }
    if (document.getElementById('cfg-pedir-pin-inicio')) {
      document.getElementById('cfg-pedir-pin-inicio').checked = Boolean(cfg.pedir_pin_inicio);
    }
    if (document.getElementById('cfg-perfiles-operadores')) {
      document.getElementById('cfg-perfiles-operadores').value = obtenerPerfilesOperadores().join(', ');
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

    if (selectPlan) {
      selectPlan.innerHTML = optionsPlanes(planes, moneda);
    }

    const selectHorario = document.getElementById('pago-horario');
    if (selectHorario) {
      const horarios = store.state.horarios || [];
      selectHorario.innerHTML = optionsHorarios(horarios, '-- Sin horario fijo / Horario libre --');
    }

    const selectAlumno = document.getElementById('pago-select-alumno');
    const alumnos = store.getAlumnosConEstado();
    if (selectAlumno) {
      selectAlumno.innerHTML = optionsAlumnos(alumnos, { formatDatePE });
    }
  }

  function renderSugerenciasAlumnosModalPago(filtro = '') {
    const lista = document.getElementById('pago-lista-sugerencias-alumnos');
    if (!lista) return;
    const q = (filtro || '').trim().toLowerCase();
    const alumnos = store.getAlumnosConEstado();
    const filtrados = q
      ? alumnos.filter(
          (a) =>
            a.nombre_completo.toLowerCase().includes(q) ||
            (a.telefono_whatsapp || '').toLowerCase().includes(q)
        )
      : alumnos.slice(0, 12);

    lista.innerHTML = sugerenciasAlumnosLista(filtrados, filtro, { formatDatePE });
    lista.classList.remove('hidden');
  }

  function seleccionarAlumnoEnModalPago(alumnoId) {
    const selectAlumno = document.getElementById('pago-select-alumno');
    const hiddenId = document.getElementById('pago-alumno-id');
    const searchInput = document.getElementById('pago-buscar-alumno-input');
    const lista = document.getElementById('pago-lista-sugerencias-alumnos');

    if (selectAlumno) selectAlumno.value = alumnoId || '';
    if (hiddenId) hiddenId.value = alumnoId || '';
    if (lista) lista.classList.add('hidden');

    if (alumnoId) {
      const alu = store.getAlumnosConEstado().find((a) => a.id === alumnoId);
      if (searchInput && alu) searchInput.value = alu.nombre_completo;
      cargarDatosAlumnoEnModal(alumnoId);
    } else {
      if (searchInput) searchInput.value = '';
      cargarDatosAlumnoEnModal('');
    }
  }

  function toggleMasOpcionesPagoModal(mostrarForzado = null) {
    const bloqueFechas = document.getElementById('bloque-fechas-manuales-pago');
    const bloqueRecibo = document.getElementById('bloque-nro-recibo-manual');
    const bloqueObs = document.getElementById('bloque-observacion-pago');
    const gridMontos = document.getElementById('grid-montos-pago');
    const btnToggle = document.getElementById('btn-toggle-mas-opciones-pago');
    if (!bloqueFechas || !bloqueRecibo || !bloqueObs) return;

    const estaOculto = bloqueFechas.classList.contains('hidden');
    const mostrar = mostrarForzado !== null ? Boolean(mostrarForzado) : estaOculto;

    bloqueFechas.classList.toggle('hidden', !mostrar);
    bloqueRecibo.classList.toggle('hidden', !mostrar);
    bloqueObs.classList.toggle('hidden', !mostrar);
    if (gridMontos) {
      gridMontos.dataset.compact = mostrar ? 'false' : 'true';
    }
    if (btnToggle) {
      btnToggle.textContent = mostrar ? '🔽 Ocultar opciones avanzadas' : '⚙️ Ajustar fechas / recibo / nota';
    }
  }

  function setModoAlumnoModal(modo) {
    modoModalPago = modo;
    const btnNuevo = document.getElementById('btn-modo-alumno-nuevo');
    const btnExistente = document.getElementById('btn-modo-alumno-existente');
    const bloqueExistente = document.getElementById('bloque-selector-existente');
    const badgeInscripcion = document.getElementById('badge-estado-inscripcion-modal');
    const bloqueDatos = document.getElementById('bloque-datos-personales-form');
    const resumenAlu = document.getElementById('resumen-alumno-seleccionado');
    const bloqueModalidad = document.getElementById('bloque-modalidad-cobro');

    if (modo === 'NUEVO') {
      if (btnNuevo) btnNuevo.dataset.active = 'true';
      if (btnExistente) btnExistente.dataset.active = 'false';
      bloqueExistente.classList.add('hidden');
      document.getElementById('pago-select-alumno').value = '';
      if (document.getElementById('pago-alumno-id')) document.getElementById('pago-alumno-id').value = '';
      if (document.getElementById('pago-buscar-alumno-input')) document.getElementById('pago-buscar-alumno-input').value = '';
      document.getElementById('pago-lista-sugerencias-alumnos')?.classList.add('hidden');
      document.getElementById('banner-renovacion-flexible').classList.add('hidden');
      if (resumenAlu) resumenAlu.classList.add('hidden');
      if (bloqueDatos) bloqueDatos.classList.remove('hidden');
      if (badgeInscripcion) badgeInscripcion.classList.add('hidden');
      if (bloqueModalidad) bloqueModalidad.classList.remove('hidden');
      toggleMasOpcionesPagoModal(false);
      setTipoOperacionModal('INSCRIPCION_Y_MENSUALIDAD');
    } else {
      if (btnExistente) btnExistente.dataset.active = 'true';
      if (btnNuevo) btnNuevo.dataset.active = 'false';
      bloqueExistente.classList.remove('hidden');
      if (bloqueDatos && document.getElementById('pago-select-alumno').value) {
        bloqueDatos.classList.add('hidden');
      }
      if (bloqueModalidad) bloqueModalidad.classList.add('hidden');
      toggleMasOpcionesPagoModal(false);
      setTipoOperacionModal('MENSUALIDAD');
    }
  }

  function setTipoOperacionModal(tipo) {
    tipoOperacionPago = tipo;
    document.querySelectorAll('.btn-tipo-operacion').forEach((btn) => {
      const esActivo = btn.getAttribute('data-tipo-op') === tipo;
      btn.dataset.active = esActivo ? 'true' : 'false';
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

  function aplicarPlanSeleccionado(conservarAbonoManual = false) {
    const planId = document.getElementById('pago-select-plan')?.value;
    const plan = store.state.planes.find((p) => p.id === planId);
    const fechaInicio = document.getElementById('pago-fecha-inicio')?.value || getLocalDateISO();
    const montoInscripcion = Number(document.getElementById('pago-monto-inscripcion')?.value || 0);
    const inputAbonado = document.getElementById('pago-monto-abonado');
    const conservarManual =
      conservarAbonoManual === true &&
      inputAbonado &&
      inputAbonado.value !== '' &&
      Number(inputAbonado.value) !== ultimoTotalSincronizado;

    if (tipoOperacionPago === 'SOLO_INSCRIPCION') {
      document.getElementById('pago-concepto').value = 'Inscripción / Matrícula en el Sistema';
      document.getElementById('pago-fecha-fin').value = fechaInicio;
      const total = montoInscripcion.toFixed(2);
      document.getElementById('pago-total-pagar').value = total;
      if (!conservarManual && inputAbonado) {
        inputAbonado.value = total;
      }
      ultimoTotalSincronizado = Number(total);
    } else if (plan) {
      const precioPlan = Number(plan.precio_sugerido || 0);
      if (tipoOperacionPago === 'INSCRIPCION_Y_MENSUALIDAD') {
        document.getElementById('pago-concepto').value = `Inscripción + ${plan.nombre}`;
        document.getElementById('pago-fecha-fin').value = calcularFechaFin(fechaInicio, plan.duracion_dias);
        const total = (montoInscripcion + precioPlan).toFixed(2);
        document.getElementById('pago-total-pagar').value = total;
        if (!conservarManual && inputAbonado) {
          inputAbonado.value = total;
        }
        ultimoTotalSincronizado = Number(total);
      } else {
        document.getElementById('pago-concepto').value = plan.nombre;
        document.getElementById('pago-fecha-fin').value = calcularFechaFin(fechaInicio, plan.duracion_dias);
        const total = precioPlan.toFixed(2);
        document.getElementById('pago-total-pagar').value = total;
        if (!conservarManual && inputAbonado) {
          inputAbonado.value = total;
        }
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

    if (caja) {
      caja.dataset.state = saldo <= 0.009 ? 'paid' : 'debt';
    }
    if (txtEstado) {
      txtEstado.textContent =
        saldo <= 0.009 ? 'PAGADO COMPLETO (NO DEBE NADA)' : 'QUEDA DEBIENDO SALDO';
    }

    const previewPeriodoEl = document.getElementById('texto-preview-periodo-venta');
    if (previewPeriodoEl) {
      const fIni = document.getElementById('pago-fecha-inicio')?.value || getLocalDateISO();
      const fFin = document.getElementById('pago-fecha-fin')?.value || fIni;
      const nroRecDisplay = (document.getElementById('pago-numero-recibo')?.value || store.getProximoNumeroReciboFormateado()).trim();
      previewPeriodoEl.textContent =
        tipoOperacionPago === 'SOLO_INSCRIPCION'
          ? `📝 Inscripción única (${formatDatePE(fIni)}) • 🧾 Recibo #${nroRecDisplay}`
          : `📅 Período: ${formatDatePE(fIni)} → ${formatDatePE(fFin)} • 🧾 Recibo #${nroRecDisplay}`;
    }

    const nroRecibo = document.getElementById('pago-numero-recibo').value;
    const duplicado = store.existeNumeroRecibo(nroRecibo);
    document.getElementById('aviso-recibo-duplicado').classList.toggle('hidden', !duplicado);
    if (duplicado && document.getElementById('bloque-nro-recibo-manual')?.classList.contains('hidden')) {
      toggleMasOpcionesPagoModal(true);
    }
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
        selectDeudor.innerHTML = optionsDeudores(memsConDeuda, store.state.alumnos, moneda);
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
    setMetodoPagoUI('EFECTIVO');
    const cobradorInput = document.getElementById('pago-cobrado-por');
    if (cobradorInput) cobradorInput.value = store.getOperadorActual();
    document.getElementById('pago-fecha-inicio').value = getLocalDateISO();
    document.getElementById('pago-numero-recibo').value = store.getProximoNumeroReciboFormateado();
    if (document.getElementById('pago-buscar-alumno-input')) {
      document.getElementById('pago-buscar-alumno-input').value = '';
    }
    if (document.getElementById('pago-alumno-id')) {
      document.getElementById('pago-alumno-id').value = '';
    }
    document.getElementById('resumen-alumno-seleccionado')?.classList.add('hidden');

    if (horarioPreseleccionadoId && document.getElementById('pago-horario')) {
      document.getElementById('pago-horario').value = horarioPreseleccionadoId;
    }

    if (tipoAccion === 'COBRAR_MENSUALIDAD') {
      document.getElementById('modal-pago-titulo').textContent = '🥊 Cobrar Mensualidad a Alumno Inscrito';
      document.getElementById('modal-pago-subtitulo').textContent = 'Busca al alumno por nombre o celular para renovar al instante';
      setModoAlumnoModal('EXISTENTE');
      abrirModal('modal-nuevo-pago');
      setTimeout(() => document.getElementById('pago-buscar-alumno-input')?.focus(), 80);
    } else {
      document.getElementById('modal-pago-titulo').textContent = '🎓 Inscribir Alumno Nuevo';
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
    setMetodoPagoUI('EFECTIVO');
    const cobradorInput = document.getElementById('pago-cobrado-por');
    if (cobradorInput) cobradorInput.value = store.getOperadorActual();

    document.getElementById('modal-pago-titulo').textContent = '🥊 Cobrar Mensualidad / Renovar';
    document.getElementById('modal-pago-subtitulo').textContent = 'Verifica el plan, fechas de inicio/fin y el monto que abona hoy';
    seleccionarAlumnoEnModalPago(alumnoId);

    document.getElementById('pago-numero-recibo').value = store.getProximoNumeroReciboFormateado();
    document.getElementById('pago-observacion').value = '';
    abrirModal('modal-nuevo-pago');
  }

  function cargarDatosAlumnoEnModal(alumnoId) {
    const alu = store.getAlumnosConEstado().find((a) => a.id === alumnoId);
    const banner = document.getElementById('banner-renovacion-flexible');
    const badgeInscripcion = document.getElementById('badge-estado-inscripcion-modal');
    const resumenAlu = document.getElementById('resumen-alumno-seleccionado');
    const resumenNombre = document.getElementById('resumen-alumno-nombre');
    const resumenExtra = document.getElementById('resumen-alumno-extra');
    const bloqueDatos = document.getElementById('bloque-datos-personales-form');

    if (!alu) {
      banner.classList.add('hidden');
      if (badgeInscripcion) badgeInscripcion.classList.add('hidden');
      if (resumenAlu) resumenAlu.classList.add('hidden');
      return;
    }

    if (resumenAlu && resumenNombre && resumenExtra) {
      resumenNombre.textContent = `${alu.nombre_completo} (${alu.grado_cinturon || 'Alumno'})`;
      resumenExtra.textContent = `🕒 ${alu.horario_texto || 'Sin horario'} • 📱 ${alu.telefono_whatsapp || 'Sin WhatsApp'}`;
      resumenAlu.classList.remove('hidden');
    }
    if (bloqueDatos && modoModalPago === 'EXISTENTE') {
      bloqueDatos.classList.add('hidden');
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
      badgeInscripcion.dataset.tone = yaTieneInscripcion ? 'success' : 'warning';
      badgeInscripcion.textContent = yaTieneInscripcion
        ? '🎓 Ya tiene Inscripción pagada'
        : '⚠️ Aún no registra Inscripción';
    }

    const memBase = alu.ultimo_contrato || alu.ultima_membresia;
    if (memBase) {
      banner.classList.remove('hidden');
      document.getElementById('texto-vencimiento-anterior').innerHTML = bannerVencimientoAnterior(
        alu,
        memBase,
        { formatDatePE }
      );

      if (memBase.plan_id && store.state.planes.some((p) => p.id === memBase.plan_id)) {
        document.getElementById('pago-select-plan').value = memBase.plan_id;
      }

      document.getElementById('pago-fecha-inicio').value = memBase.fecha_fin;
    } else {
      banner.classList.add('hidden');
      document.getElementById('pago-fecha-inicio').value = getLocalDateISO();
    }

    document.getElementById('bloque-modalidad-cobro')?.classList.toggle('hidden', yaTieneInscripcion);
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
    setMetodoSaldoUI('EFECTIVO');
    const saldoCobrador = document.getElementById('saldo-cobrado-por');
    if (saldoCobrador) saldoCobrador.value = store.getOperadorActual();
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

    document.getElementById('hist-alumno-contenido').innerHTML = historialAlumnoContenido(
      alu,
      recibosAlumno,
      moneda,
      { formatDatePE, formatDateTimePE, METODO_LABELS }
    );

    abrirModal('modal-historial-alumno');
    refreshIcons();
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
      selectHorario.innerHTML = optionsHorarios(horarios, '-- Sin horario asignado --');
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
    if (!esAdmin()) {
      mostrarToast('Solo el Administrador puede editar horarios', 'warning');
      abrirModal('modal-login-admin');
      return;
    }
    const h = (store.state.horarios || []).find((x) => x.id === horarioId);
    if (!h) return;
    document.getElementById('contenedor-form-horario')?.classList.remove('hidden');
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
    document.getElementById('contenedor-form-horario')?.classList.add('hidden');
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
    if (!esAdmin()) {
      mostrarToast('Solo el Administrador puede editar planes o precios', 'warning');
      abrirModal('modal-login-admin');
      return;
    }
    const p = store.state.planes.find((x) => x.id === planId);
    if (!p) return;
    document.getElementById('contenedor-form-plan')?.classList.remove('hidden');
    document.getElementById('form-plan-titulo').textContent = 'Editar Plan / Mensualidad';
    document.getElementById('plan-id').value = p.id;
    document.getElementById('plan-nombre').value = p.nombre;
    document.getElementById('plan-disciplina').value = p.disciplina;
    document.getElementById('plan-duracion').value = p.duracion_dias;
    document.getElementById('plan-precio').value = p.precio_sugerido;
    document.getElementById('btn-cancelar-plan').classList.remove('hidden');
    document.getElementById('plan-nombre')?.focus();
  }

  function resetFormPlan() {
    document.getElementById('form-plan-titulo').textContent = 'Agregar Plan o Mensualidad';
    document.getElementById('plan-id').value = '';
    document.getElementById('form-plan').reset();
    document.getElementById('plan-duracion').value = 30;
    document.getElementById('btn-cancelar-plan').classList.add('hidden');
    document.getElementById('contenedor-form-plan')?.classList.add('hidden');
  }

  function eliminarPlan(planId) {
    if (!esAdmin()) {
      mostrarToast('Solo el Administrador puede eliminar planes', 'warning');
      abrirModal('modal-login-admin');
      return;
    }
    if (!confirm('¿Deseas eliminar este plan del catálogo?')) return;
    store.eliminarPlan(planId);
    mostrarToast('Plan eliminado del catálogo', 'info');
  }

  function abrirModalEditarRecibo(reciboId) {
    if (!esAdmin()) {
      mostrarToast('Solo el Administrador puede editar recibos o fechas', 'warning');
      abrirModal('modal-login-admin');
      return;
    }
    const rec = store.getRecibosDetallados().find((r) => r.id === reciboId);
    if (!rec) return;
    const mem = rec.membresia || {};

    document.getElementById('edit-rec-id').value = rec.id;
    document.getElementById('edit-rec-alumno-info').textContent = `${rec.nombre_completo} • Recibo #${rec.numero_recibo}`;
    document.getElementById('edit-rec-numero').value = rec.numero_recibo || '';
    document.getElementById('edit-rec-metodo').value = rec.metodo_pago || 'EFECTIVO';
    document.getElementById('edit-rec-concepto').value = mem.concepto || '';
    document.getElementById('edit-rec-fecha-inicio').value = mem.fecha_inicio || '';
    document.getElementById('edit-rec-fecha-fin').value = mem.fecha_fin || '';
    document.getElementById('edit-rec-total').value = Number(mem.total_a_pagar || 0).toFixed(2);
    document.getElementById('edit-rec-abonado').value = Number(rec.monto_abonado || 0).toFixed(2);
    document.getElementById('edit-rec-cobrado-por').value = rec.cobrado_por || 'Recepción';
    document.getElementById('edit-rec-observacion').value = rec.observacion || '';

    abrirModal('modal-editar-recibo');
    refreshIcons();
  }

  function anularOReactivarRecibo(reciboId) {
    if (!esAdmin()) {
      mostrarToast('Solo el Administrador puede anular o reactivar recibos', 'warning');
      abrirModal('modal-login-admin');
      return;
    }
    try {
      const rec = store.toggleAnularRecibo(reciboId);
      if (!rec) return;
      mostrarToast(
        rec.anulado ? `Recibo #${rec.numero_recibo} anulado. Saldo recalculado.` : `Recibo #${rec.numero_recibo} reactivado.`,
        rec.anulado ? 'warning' : 'success'
      );
    } catch (err) {
      mostrarToast(err?.message || 'No se pudo cambiar el estado del recibo', 'error');
    }
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

    resultsBox.innerHTML = busquedaGlobalContenido(alumnosMatch, recibosMatch, moneda, {
      formatDatePE,
      query
    });
    resultsBox.classList.remove('hidden');
  }

  // =========================================================================
  // INICIALIZACIÓN DE EVENTOS DOM
  // =========================================================================
  function initEventListeners() {
    store.subscribe(() => renderTodo());

    // Delegación única para acciones declaradas con [data-action]
    document.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;

      const closeModalId = actionEl.getAttribute('data-close-modal');
      if (closeModalId) cerrarModal(closeModalId);

      if (actionEl.getAttribute('data-close-search') === 'true') {
        document.getElementById('global-search-results')?.classList.add('hidden');
      }

      const action = actionEl.getAttribute('data-action');
      const id = actionEl.getAttribute('data-id') || '';
      const arg = actionEl.getAttribute('data-arg') || '';

      switch (action) {
        case 'abrir-accion-directa':
          abrirModalAccionDirecta(arg);
          break;
        case 'cambiar-tab':
          cambiarTab(arg);
          break;
        case 'ver-historial':
          abrirHistorialAlumno(id);
          break;
        case 'renovar-alumno':
          abrirModalRenovar(id);
          break;
        case 'editar-alumno':
          abrirModalEditarAlumno(id);
          break;
        case 'eliminar-alumno':
          eliminarAlumnoConfirm(id);
          break;
        case 'cobrar-saldo':
          abrirModalCobrarSaldo(id);
          break;
        case 'ver-comprobante':
          verComprobanteDigital(id);
          break;
        case 'editar-recibo':
          abrirModalEditarRecibo(id);
          break;
        case 'toggle-anular-recibo':
          anularOReactivarRecibo(id);
          break;
        case 'inscribir-en-horario':
          inscribirEnHorario(id);
          break;
        case 'editar-horario':
          editarHorario(id);
          break;
        case 'eliminar-horario':
          eliminarHorario(id);
          break;
        case 'editar-plan':
          editarPlan(id);
          break;
        case 'eliminar-plan':
          eliminarPlan(id);
          break;
        case 'imprimir-comprobante':
          window.print();
          break;
        default:
          break;
      }
    });

    // Navegación por menú lateral y barra móvil inferior
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => cambiarTab(btn.getAttribute('data-tab')));
    });

    document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => cambiarTab(btn.getAttribute('data-tab')));
    });

    document.getElementById('btn-mobile-cobrar-rapido')?.addEventListener('click', abrirModalNuevoPago);

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
          'modal-editar-alumno',
          'modal-editar-recibo'
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

    // Buscador autocompletable de alumnos en Modal de Cobro
    const inputBuscarAlu = document.getElementById('pago-buscar-alumno-input');
    const listaSugAlu = document.getElementById('pago-lista-sugerencias-alumnos');
    inputBuscarAlu?.addEventListener('focus', () => renderSugerenciasAlumnosModalPago(inputBuscarAlu.value));
    inputBuscarAlu?.addEventListener('input', (e) => {
      if (document.getElementById('pago-alumno-id')) document.getElementById('pago-alumno-id').value = '';
      if (document.getElementById('pago-select-alumno')) document.getElementById('pago-select-alumno').value = '';
      renderSugerenciasAlumnosModalPago(e.target.value);
    });

    listaSugAlu?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pick-alumno]');
      if (!btn) return;
      seleccionarAlumnoEnModalPago(btn.getAttribute('data-pick-alumno'));
    });

    document.addEventListener('click', (e) => {
      if (listaSugAlu && !listaSugAlu.contains(e.target) && e.target !== inputBuscarAlu) {
        listaSugAlu.classList.add('hidden');
      }
    });

    document.getElementById('btn-editar-ficha-en-pago')?.addEventListener('click', () => {
      const bloqueDatos = document.getElementById('bloque-datos-personales-form');
      if (bloqueDatos) {
        bloqueDatos.classList.toggle('hidden');
      }
    });

    // Botones 1-clic de Método de Pago (Modal Cobro y Modal Saldo)
    document.querySelectorAll('.btn-metodo-pago').forEach((btn) => {
      btn.addEventListener('click', () => setMetodoPagoUI(btn.getAttribute('data-metodo')));
    });
    document.querySelectorAll('.btn-metodo-saldo').forEach((btn) => {
      btn.addEventListener('click', () => setMetodoSaldoUI(btn.getAttribute('data-metodo')));
    });

    document.getElementById('saldo-select-membresia')?.addEventListener('change', (e) => {
      cargarMembresiaEnModalSaldo(e.target.value);
    });

    document.getElementById('btn-toggle-mas-opciones-pago')?.addEventListener('click', () => {
      toggleMasOpcionesPagoModal();
    });

    // Botones de renovación flexible
    document.getElementById('btn-renovar-continuar')?.addEventListener('click', () => {
      const aluId = document.getElementById('pago-select-alumno').value;
      const alu = store.getAlumnosConEstado().find((a) => a.id === aluId);
      const memBase = alu?.ultimo_contrato || alu?.ultima_membresia;
      if (memBase) {
        document.getElementById('pago-fecha-inicio').value = memBase.fecha_fin;
        aplicarPlanSeleccionado(true);
      }
    });

    document.getElementById('btn-renovar-hoy')?.addEventListener('click', () => {
      document.getElementById('pago-fecha-inicio').value = getLocalDateISO();
      aplicarPlanSeleccionado(true);
    });

    // Cambio de Plan o Fecha de Inicio recalcula Fecha de Finalización
    document.getElementById('pago-select-plan')?.addEventListener('change', aplicarPlanSeleccionado);
    document.getElementById('pago-fecha-inicio')?.addEventListener('change', (e) => {
      if (tipoOperacionPago === 'SOLO_INSCRIPCION') {
        document.getElementById('pago-fecha-fin').value = e.target.value;
        actualizarPreviewSaldoModal();
        return;
      }
      const planId = document.getElementById('pago-select-plan').value;
      const plan = store.state.planes.find((p) => p.id === planId);
      const dias = plan ? plan.duracion_dias : 30;
      document.getElementById('pago-fecha-fin').value = calcularFechaFin(e.target.value, dias);
      actualizarPreviewSaldoModal();
    });

    document.getElementById('pago-fecha-fin')?.addEventListener('change', actualizarPreviewSaldoModal);

    // Botones rápidos de duración (+1 Mes, +3 Meses, +15 Días)
    document.querySelectorAll('.quick-dur-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dias = Number(btn.getAttribute('data-quick-duration')) || 30;
        const inicio = document.getElementById('pago-fecha-inicio').value || getLocalDateISO();
        document.getElementById('pago-fecha-fin').value = calcularFechaFin(inicio, dias);
        actualizarPreviewSaldoModal();
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

      const soloPagoExistente =
        modoModalPago === 'EXISTENTE' &&
        document.getElementById('bloque-datos-personales-form')?.classList.contains('hidden');

      const payloadPago = {
        alumnoId,
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
        cobrado_por: document.getElementById('pago-cobrado-por')?.value || 'Recepción',
        observacion: document.getElementById('pago-observacion').value
      };

      if (!soloPagoExistente) {
        payloadPago.nombres = document.getElementById('pago-nombres').value;
        payloadPago.apellidos = document.getElementById('pago-apellidos').value;
        payloadPago.telefono_whatsapp = document.getElementById('pago-whatsapp').value;
        payloadPago.grado_cinturon = document.getElementById('pago-grado').value;
        payloadPago.horario_id = document.getElementById('pago-horario')?.value || null;
        payloadPago.contacto_emergencia = document.getElementById('pago-emergencia').value;
      }

      try {
        const resultado = store.registrarInscripcionOPago(payloadPago);
        const creds = global.SupabaseSync?.obtenerCredenciales?.(store);
        const tieneNube = Boolean(creds?.url && creds?.anonKey);

        cerrarModal('modal-nuevo-pago');
        mostrarToast(
          tieneNube
            ? `💾 Recibo #${resultado.recibo.numero_recibo} guardado en este equipo • Sincronizando nube…`
            : `Recibo #${resultado.recibo.numero_recibo} guardado correctamente`
        );

        if (submitMode === 'digital') {
          verComprobanteDigital(resultado.recibo.id);
        }
      } catch (err) {
        mostrarToast(err?.message || 'Revisa los montos y el número de recibo antes de guardar', 'error');
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
      try {
        const resultado = store.cobrarSaldoMembresia({
          membresia_id: document.getElementById('saldo-membresia-id').value,
          numero_recibo: document.getElementById('saldo-numero-recibo').value,
          monto_abonado: document.getElementById('saldo-monto-abonar').value,
          metodo_pago: document.getElementById('saldo-metodo-pago').value,
          cobrado_por: document.getElementById('saldo-cobrado-por')?.value || 'Recepción',
          observacion: document.getElementById('saldo-observacion').value
        });
        const creds = global.SupabaseSync?.obtenerCredenciales?.(store);
        const tieneNube = Boolean(creds?.url && creds?.anonKey);

        cerrarModal('modal-cobrar-saldo');
        mostrarToast(
          tieneNube
            ? `💾 Saldo en Recibo #${resultado.recibo.numero_recibo} guardado localmente • Sincronizando nube…`
            : `Saldo cobrado en Recibo #${resultado.recibo.numero_recibo}`
        );
        verComprobanteDigital(resultado.recibo.id);
      } catch (err) {
        mostrarToast(err?.message || 'No se pudo registrar el abono de saldo', 'error');
      }
    });

    // Submit Formulario Editar Recibo / Membresía (Solo Admin)
    document.getElementById('form-editar-recibo')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!esAdmin()) {
        mostrarToast('Solo el Administrador puede editar recibos o fechas', 'warning');
        abrirModal('modal-login-admin');
        return;
      }
      const reciboId = document.getElementById('edit-rec-id').value;
      try {
        const res = store.actualizarReciboYMembresia(reciboId, {
          numero_recibo: document.getElementById('edit-rec-numero').value,
          metodo_pago: document.getElementById('edit-rec-metodo').value,
          concepto: document.getElementById('edit-rec-concepto').value,
          fecha_inicio: document.getElementById('edit-rec-fecha-inicio').value,
          fecha_fin: document.getElementById('edit-rec-fecha-fin').value,
          total_a_pagar: document.getElementById('edit-rec-total').value,
          monto_abonado: document.getElementById('edit-rec-abonado').value,
          cobrado_por: document.getElementById('edit-rec-cobrado-por').value,
          observacion: document.getElementById('edit-rec-observacion').value
        });
        if (!res) {
          mostrarToast('No se encontró el recibo para actualizar', 'error');
          return;
        }
        cerrarModal('modal-editar-recibo');
        mostrarToast(`Recibo #${res.recibo.numero_recibo} corregido correctamente`);
      } catch (err) {
        mostrarToast(err?.message || 'No se pudo corregir el recibo. Verifica montos, fechas y correlativo.', 'error');
      }
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

    document.getElementById('btn-copiar-y-whatsapp')?.addEventListener('click', async () => {
      if (!reciboActualEnVisor) return;
      const canvas = document.getElementById('canvas-comprobante');
      const waUrl = generarLinkWhatsAppRecibo(reciboActualEnVisor, store.state.configuracion);
      const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

      if (esMovil && canvas && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        try {
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            const file = new File([blob], `recibo-${reciboActualEnVisor.numero_recibo}.png`, {
              type: 'image/png'
            });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: `Recibo #${reciboActualEnVisor.numero_recibo}`,
                text: `Comprobante de pago - ${reciboActualEnVisor.nombre_completo}`
              });
              mostrarToast('✅ Comprobante compartido desde tu dispositivo');
              return;
            }
          }
        } catch (shareErr) {
          if (shareErr?.name === 'AbortError') return;
        }
      }

      try {
        await copiarCanvasAlPortapapeles(canvas);
        mostrarToast('✅ Imagen copiada al portapapeles. Abriendo WhatsApp…');
      } catch (err) {
        mostrarToast('Abriendo WhatsApp con el detalle del recibo…', 'info');
      }
      window.open(waUrl, '_blank', 'noopener');
    });

    // Filtros en vista Recibos y Alumnos
    [
      'filtro-recibos-texto',
      'filtro-recibos-periodo',
      'filtro-recibos-metodo',
      'filtro-recibos-operador'
    ].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () =>
        renderTablaRecibos(store.state.configuracion.moneda || 'S/')
      );
      el?.addEventListener('change', () =>
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

    // Exportación a Excel y Cierre de Turno WhatsApp
    document.getElementById('btn-exportar-recibos-excel')?.addEventListener('click', () => {
      exportarRecibosExcel(getRecibosFiltrados(), store.state.configuracion);
      mostrarToast('Reporte de Recibos exportado a Excel (.xls)');
    });

    document.getElementById('btn-cerrar-turno-whatsapp')?.addEventListener('click', () => {
      const cfg = store.state.configuracion;
      const moneda = cfg.moneda || 'S/';
      const hoyISO = getLocalDateISO();
      const filtroOp = (document.getElementById('filtro-recibos-operador')?.value || 'TODOS').trim();

      const todosHoy = store
        .getRecibosDetallados()
        .filter((r) => getLocalDateISO(new Date(r.fecha_pago)) === hoyISO);

      const validosHoy = todosHoy.filter((r) => !r.anulado);
      const recibosTurno =
        filtroOp !== 'TODOS'
          ? validosHoy.filter(
              (r) => String(r.cobrado_por || 'Recepción').trim().toLowerCase() === filtroOp.toLowerCase()
            )
          : validosHoy;

      const anuladosTurno =
        filtroOp !== 'TODOS'
          ? todosHoy.filter(
              (r) =>
                r.anulado &&
                String(r.cobrado_por || 'Recepción').trim().toLowerCase() === filtroOp.toLowerCase()
            )
          : todosHoy.filter((r) => r.anulado);

      const total = recibosTurno.reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
      const efectivo = recibosTurno
        .filter((r) => r.metodo_pago === 'EFECTIVO')
        .reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
      const yapePlin = recibosTurno
        .filter((r) => r.metodo_pago === 'YAPE_PLIN')
        .reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
      const transferencia = recibosTurno
        .filter((r) => r.metodo_pago === 'TRANSFERENCIA')
        .reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
      const tarjeta = recibosTurno
        .filter((r) => r.metodo_pago === 'TARJETA')
        .reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
      const digital = total - efectivo;

      const porOperador = {};
      recibosTurno.forEach((r) => {
        const op = (r.cobrado_por || 'Recepción').trim() || 'Recepción';
        porOperador[op] = (porOperador[op] || 0) + Number(r.monto_abonado || 0);
      });

      const operadorTexto =
        filtroOp !== 'TODOS'
          ? `👤 *Turno / Operador:* ${filtroOp}`
          : `👤 *Responsable que cierra:* ${store.getOperadorActual()}`;

      const resumenPorOperador =
        filtroOp === 'TODOS' && Object.keys(porOperador).length > 0
          ? [
              `--------------------------------`,
              `👥 *Desglose por operador:*`,
              ...Object.entries(porOperador).map(
                ([op, monto]) => `   • ${op}: ${moneda} ${monto.toFixed(2)}`
              )
            ]
          : [];

      const lineas = [
        `📊 *CIERRE DE TURNO - ${(cfg.nombre_academia || 'GIMNASIO').toUpperCase()}*`,
        `📅 *Fecha:* ${formatDatePE(hoyISO)}`,
        operadorTexto,
        `🧾 *Recibos cobrados:* ${recibosTurno.length}${anuladosTurno.length > 0 ? ` (${anuladosTurno.length} anulado(s))` : ''}`,
        `--------------------------------`,
        `💵 *Efectivo en caja:* ${moneda} ${efectivo.toFixed(2)}`,
        `📱 *Pagos digitales (total):* ${moneda} ${digital.toFixed(2)}`,
        `   • Yape / Plin: ${moneda} ${yapePlin.toFixed(2)}`,
        `   • Transferencia: ${moneda} ${transferencia.toFixed(2)}`,
        `   • Tarjeta: ${moneda} ${tarjeta.toFixed(2)}`,
        ...resumenPorOperador,
        `--------------------------------`,
        `💰 *TOTAL COBRADO HOY:* ${moneda} ${total.toFixed(2)}`
      ];

      const rawDigits = String(cfg.telefono || '').replace(/\D/g, '');
      const telWA =
        rawDigits.length === 9 && rawDigits.startsWith('9') ? `51${rawDigits}` : rawDigits;
      const texto = encodeURIComponent(lineas.join('\n'));
      const waUrl = telWA ? `https://wa.me/${telWA}?text=${texto}` : `https://wa.me/?text=${texto}`;

      store.registrarActividad(
        'Cierre de turno WhatsApp',
        `Total ${moneda} ${total.toFixed(2)} (${recibosTurno.length} recibo(s))`,
        null,
        true
      );
      window.open(waUrl, '_blank', 'noopener');
      mostrarToast('📲 Abriendo WhatsApp con el cierre de turno');
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
      if (!esAdmin()) {
        mostrarToast('Solo el Administrador puede crear o editar horarios', 'warning');
        abrirModal('modal-login-admin');
        return;
      }
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
    document.getElementById('btn-cerrar-form-horario')?.addEventListener('click', resetFormHorario);
    document.getElementById('btn-toggle-form-horario')?.addEventListener('click', () => {
      if (!esAdmin()) {
        mostrarToast('Solo el Administrador puede crear o editar horarios', 'warning');
        abrirModal('modal-login-admin');
        return;
      }
      const box = document.getElementById('contenedor-form-horario');
      if (!box) return;
      const estaOculto = box.classList.contains('hidden');
      if (estaOculto) {
        box.classList.remove('hidden');
        document.getElementById('horario-nombre')?.focus();
      } else {
        resetFormHorario();
      }
    });

    // Gestión de Planes
    document.getElementById('form-plan')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!esAdmin()) {
        mostrarToast('Solo el Administrador puede crear o editar planes', 'warning');
        abrirModal('modal-login-admin');
        return;
      }
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
    document.getElementById('btn-cerrar-form-plan')?.addEventListener('click', resetFormPlan);
    document.getElementById('btn-toggle-form-plan')?.addEventListener('click', () => {
      const box = document.getElementById('contenedor-form-plan');
      if (!box) return;
      const estaOculto = box.classList.contains('hidden');
      if (estaOculto) {
        if (!esAdmin()) {
          mostrarToast('Solo el Administrador puede agregar o editar planes', 'warning');
          abrirModal('modal-login-admin');
          return;
        }
        box.classList.remove('hidden');
        document.getElementById('plan-nombre')?.focus();
      } else {
        resetFormPlan();
      }
    });

    // Configuración de la Academia (dirty flag evita pisar edición mientras sincroniza la nube)
    const formConfig = document.getElementById('form-configuracion');
    formConfig?.addEventListener('input', () => {
      configFormDirty = true;
    });
    formConfig?.addEventListener('change', () => {
      configFormDirty = true;
    });
    ['cfg-supabase-url', 'cfg-supabase-key'].forEach((idEl) => {
      const el = document.getElementById(idEl);
      el?.addEventListener('input', () => {
        configFormDirty = true;
      });
      el?.addEventListener('change', () => {
        configFormDirty = true;
      });
    });

    formConfig?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!esAdmin()) {
        mostrarToast('Solo el Administrador puede guardar la configuración', 'warning');
        abrirModal('modal-login-admin');
        return;
      }
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
        pin_recepcion: document.getElementById('cfg-pin-recepcion')?.value.trim() || '2026',
        pin_admin: document.getElementById('cfg-pin-admin')?.value.trim() || '1234',
        pedir_pin_inicio: Boolean(document.getElementById('cfg-pedir-pin-inicio')?.checked),
        perfiles_operadores: (() => {
          const rawPerfiles = document.getElementById('cfg-perfiles-operadores')?.value || '';
          const parsed = [];
          rawPerfiles.split(',').forEach((item) => {
            const limpia = item.trim();
            if (limpia && limpia.toUpperCase() !== 'OTRO' && !parsed.includes(limpia)) {
              parsed.push(limpia);
            }
          });
          return parsed.length > 0 ? parsed : ['Recepción', 'Profesor / Coach', 'Administrador'];
        })()
      });
      configFormDirty = false;
      mostrarToast('Configuración, perfiles, seguridad y precios actualizados');
    });

    // Control de Acceso Doble Código con Perfiles Identificables:
    document.getElementById('acceso-inicial-operador')?.addEventListener('change', (e) => {
      const boxOtro = document.getElementById('acceso-inicial-operador-otro');
      if (!boxOtro) return;
      if (e.target.value === 'OTRO') {
        boxOtro.classList.remove('hidden');
        boxOtro.focus();
      } else {
        boxOtro.classList.add('hidden');
      }
    });

    // 1. Acceso Inicial obligatorio -> entra siempre en MODO RECEPCIÓN con operador identificado
    document.getElementById('form-acceso-inicial')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputEl = document.getElementById('acceso-inicial-pin');
      const errEl = document.getElementById('acceso-inicial-error');
      const selOp = document.getElementById('acceso-inicial-operador');
      const inputOtro = document.getElementById('acceso-inicial-operador-otro');

      let nombreOperador = (selOp?.value || 'Recepción').trim();
      if (nombreOperador === 'OTRO') {
        nombreOperador = (inputOtro?.value || '').trim();
        if (!nombreOperador) {
          if (errEl) {
            errEl.textContent = '⚠️ Escribe tu nombre para identificar quién atiende este turno.';
            errEl.classList.remove('hidden');
          }
          inputOtro?.focus();
          return;
        }
      }

      const pinIngresado = (inputEl?.value || '').trim();
      const pinRecep = store.state.configuracion.pin_recepcion || '2026';
      const pinAdmin = store.state.configuracion.pin_admin || '1234';

      if (pinIngresado === pinRecep || pinIngresado === pinAdmin) {
        if (errEl) errEl.classList.add('hidden');
        sessionStorage.setItem('gym_acceso_recepcion_ok', 'true');
        store.setOperadorActual(nombreOperador);
        store.setRolDispositivoActual('RECEPCION');
        store.registrarActividad(
          'Inicio de turno en Recepción',
          `Acceso verificado para ${nombreOperador}`,
          `${nombreOperador} (Recepción)`,
          true
        );
        cerrarModal('modal-acceso-inicial');
        renderTodo();
        mostrarToast(`🔒 Turno iniciado como ${nombreOperador} (Modo Recepción).`, 'info');
      } else {
        if (errEl) {
          errEl.textContent = '❌ Código incorrecto. Pide el código de acceso al administrador.';
          errEl.classList.remove('hidden');
        }
        if (inputEl) inputEl.select();
      }
    });

    // 2. Elevación manual a Administrador / Cambio de Rol o Perfil
    document.getElementById('btn-cambiar-rol')?.addEventListener('click', () => {
      poblarSelectoresOperadores();
      document.getElementById('login-input-pin').value = '';
      abrirModal('modal-login-admin');
      setTimeout(() => document.getElementById('login-input-pin')?.focus(), 80);
    });

    document.getElementById('form-login-admin')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const pinIngresado = document.getElementById('login-input-pin').value.trim();
      const pinCorrecto = store.state.configuracion.pin_admin || '1234';
      const nombreSel =
        (document.getElementById('login-select-operador')?.value || store.getOperadorActual() || 'Administrador').trim() ||
        'Administrador';

      if (pinIngresado === pinCorrecto) {
        store.setOperadorActual(nombreSel);
        store.setRolDispositivoActual('ADMIN');
        store.registrarActividad(
          'Elevación a Administrador',
          `Ingreso autorizado con clave Admin`,
          `${nombreSel} (Admin)`,
          true
        );
        reiniciarTemporizadorInactividadAdmin();
        cerrarModal('modal-login-admin');
        renderTodo();
        mostrarToast(`🔓 Modo Administrador activo para ${nombreSel} (Auto-bloqueo en 5 min)`);
      } else {
        mostrarToast('Clave de Administrador incorrecta', 'error');
      }
    });

    document.getElementById('btn-entrar-modo-recepcion')?.addEventListener('click', () => {
      const nombreSel = (document.getElementById('login-select-operador')?.value || '').trim();
      const nombreFinal =
        nombreSel && nombreSel !== 'Administrador'
          ? nombreSel
          : obtenerPerfilesOperadores().find((p) => p !== 'Administrador') || 'Recepción';

      store.setOperadorActual(nombreFinal);
      store.setRolDispositivoActual('RECEPCION');
      store.registrarActividad(
        'Cambio a Modo Recepción',
        `Turno asignado a ${nombreFinal}`,
        `${nombreFinal} (Recepción)`,
        true
      );
      if (adminInactivityTimer) {
        clearTimeout(adminInactivityTimer);
        adminInactivityTimer = null;
      }
      cerrarModal('modal-login-admin');
      if (tabActual === 'configuracion' || tabActual === 'planes') {
        cambiarTab('dashboard');
      } else {
        renderTodo();
      }
      mostrarToast(`🔒 Modo Recepción activo (${nombreFinal})`, 'info');
    });

    ['click', 'keydown', 'mousemove', 'touchstart'].forEach((evtName) => {
      document.addEventListener(
        evtName,
        () => {
          if (esAdmin()) reiniciarTemporizadorInactividadAdmin();
        },
        { passive: true }
      );
    });

    // Conexión Supabase Cloud
    document.getElementById('btn-test-supabase')?.addEventListener('click', async () => {
      if (!esAdmin()) {
        mostrarToast('Solo el Administrador puede probar o modificar Supabase Cloud', 'warning');
        abrirModal('modal-login-admin');
        return;
      }
      const url = document.getElementById('cfg-supabase-url').value.trim();
      const key = document.getElementById('cfg-supabase-key').value.trim();
      store.actualizarConfiguracion({ supabase_url: url, supabase_anon_key: key });
      configFormDirty = false;
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
      if (!esAdmin()) {
        e.target.value = '';
        mostrarToast('Solo el Administrador puede restaurar copias de seguridad', 'warning');
        abrirModal('modal-login-admin');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const snapshotPrevio = JSON.parse(JSON.stringify(store.state));
        try {
          const parsed = JSON.parse(ev.target.result);
          if (
            !parsed ||
            typeof parsed !== 'object' ||
            !Array.isArray(parsed.alumnos) ||
            !Array.isArray(parsed.recibos) ||
            (parsed.membresias !== undefined && !Array.isArray(parsed.membresias)) ||
            (parsed.planes !== undefined && !Array.isArray(parsed.planes)) ||
            (parsed.horarios !== undefined && !Array.isArray(parsed.horarios))
          ) {
            mostrarToast('El archivo JSON no tiene un esquema válido del sistema', 'error');
            return;
          }

          const copiaValidada = JSON.parse(JSON.stringify(parsed));
          if (!Array.isArray(copiaValidada.membresias)) copiaValidada.membresias = [];

          const rolLocal = store.state.configuracion?.rol_actual || 'ADMIN';
          const operadorLocal = store.getOperadorActual();
          store.asegurarHorariosYValoresPorDefecto(copiaValidada);
          copiaValidada.configuracion.rol_actual = rolLocal;
          copiaValidada.configuracion.operador_actual = operadorLocal;

          store.isFreshInitialState = false;
          store.state = copiaValidada;
          store.recalcularTodasLasMembresias();
          store.saveState(store.state);
          mostrarToast('Copia de seguridad restaurada y normalizada con éxito');
        } catch (err) {
          try {
            store.saveState(snapshotPrevio);
          } catch (rollbackErr) {
            console.error('Error revirtiendo snapshot tras falla de restauración:', rollbackErr);
          }
          mostrarToast('Error al validar o aplicar el archivo JSON. Se mantuvo el estado previo.', 'error');
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    });

    // Limpiar datos de ejemplo para producción
    document.getElementById('btn-limpiar-produccion')?.addEventListener('click', () => {
      if (!esAdmin()) {
        mostrarToast('Solo el Administrador puede limpiar los datos de ejemplo', 'warning');
        abrirModal('modal-login-admin');
        return;
      }
      if (
        !confirm(
          '¿Deseas eliminar únicamente los 4 alumnos, membresías y recibos de ejemplo (conservando cualquier registro real)? Si no quedan recibos, el correlativo volverá al #000001.'
        )
      )
        return;
      store.limpiarDatosParaProduccion();
      mostrarToast('Datos de demostración eliminados. Registros reales conservados.');
    });

    document.getElementById('btn-restaurar-demo')?.addEventListener('click', () => {
      if (!esAdmin()) {
        mostrarToast('Solo el Administrador puede restaurar datos de ejemplo', 'warning');
        abrirModal('modal-login-admin');
        return;
      }
      if (!confirm('¿Restaurar los datos de demostración?')) return;
      store.restaurarDatosDemo();
      mostrarToast('Datos de ejemplo restaurados');
    });
  }

  // Exponer funciones públicas de interfaz por compatibilidad (window.AppUI)
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
    abrirModalEditarRecibo,
    eliminarAlumnoConfirm
  };

  document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    verificarAccesoInicial();
    if (global.SupabaseSync && typeof global.SupabaseSync.iniciarSincronizacionTiempoReal === 'function') {
      global.SupabaseSync.iniciarSincronizacionTiempoReal(store);
    }
    renderTodo();
  });
})(window);
