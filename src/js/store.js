/**
 * CAPA DE DATOS Y LÓGICA DE NEGOCIO - SISTEMA DE GIMNASIO DE ARTES MARCIALES
 * Soporta persistencia instantánea en LocalStorage + Sincronización con Supabase Cloud.
 */

(function (global) {
const STORAGE_KEY = 'dojo_gym_system_v1';

// Utilidades de Fechas en Zona Horaria Local (Evita el desfase UTC de -5h en Perú)
function getLocalDateISO(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDatePE(isoDateStr) {
  if (!isoDateStr) return '—';
  const clean = isoDateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return isoDateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDateTimePE(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return formatDatePE(isoString);
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calcula la fecha de finalización inteligente para gimnasios:
 * - Si duracion_dias es múltiplo de 30 (30, 60, 90, 180) o 365, avanza por meses calendario
 *   (ej: inicia 08/11 -> vence 08/12) como se acostumbra en las academias.
 * - Para otras duraciones (ej: 1 día, 7 días, 15 días), suma los días exactos.
 */
function calcularFechaFin(fechaInicioISO, duracionDias = 30) {
  if (!fechaInicioISO) return getLocalDateISO();
  const [y, m, d] = fechaInicioISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dias = Number(duracionDias) || 30;

  if (dias === 365) {
    dt.setFullYear(dt.getFullYear() + 1);
  } else if (dias % 30 === 0 && dias <= 360) {
    const meses = dias / 30;
    const targetMonth = dt.getMonth() + meses;
    dt.setMonth(targetMonth);
    // Ajuste si el mes destino tiene menos días (ej. 31 Enero + 1 mes -> 28 Febrero)
    if (dt.getDate() !== d) {
      dt.setDate(0);
    }
  } else {
    dt.setDate(dt.getDate() + dias);
  }
  return getLocalDateISO(dt);
}

function addDaysISO(fechaISO, days) {
  if (!fechaISO) return getLocalDateISO();
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(days));
  return getLocalDateISO(dt);
}

function calcularDiasRestantes(fechaFinISO) {
  if (!fechaFinISO) return null;
  const hoyStr = getLocalDateISO(new Date());
  const [hy, hm, hd] = hoyStr.split('-').map(Number);
  const [fy, fm, fd] = fechaFinISO.slice(0, 10).split('-').map(Number);
  const hoy = new Date(hy, hm - 1, hd);
  const fin = new Date(fy, fm - 1, fd);
  const diff = fin.getTime() - hoy.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function generarUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatearNumeroRecibo(num, digits = 6) {
  const limpio = String(num).trim();
  if (/^\d+$/.test(limpio)) {
    return limpio.padStart(digits, '0');
  }
  return limpio;
}

function crearHorariosPorDefecto() {
  return [
    {
      id: 'hor-manana-lmv',
      nombre: 'Turno Mañana (8:00 AM - 9:30 AM)',
      dias: 'Lun - Mié - Vie',
      hora: '8:00 AM - 9:30 AM',
      disciplina: 'Muay Thai / Boxeo',
      activo: true
    },
    {
      id: 'hor-kids-tarde',
      nombre: 'Turno Kids / Infantil (4:30 PM - 5:30 PM)',
      dias: 'Lun - Mié - Vie',
      hora: '4:30 PM - 5:30 PM',
      disciplina: 'Infantil / Kids',
      activo: true
    },
    {
      id: 'hor-tarde-6pm',
      nombre: 'Turno Tarde (6:00 PM - 7:30 PM)',
      dias: 'Lunes a Viernes',
      hora: '6:00 PM - 7:30 PM',
      disciplina: 'Boxeo / Muay Thai',
      activo: true
    },
    {
      id: 'hor-noche-730pm',
      nombre: 'Turno Noche (7:30 PM - 9:00 PM)',
      dias: 'Lun - Mié - Vie',
      hora: '7:30 PM - 9:00 PM',
      disciplina: 'Jiu-Jitsu (BJJ) / MMA',
      activo: true
    },
    {
      id: 'hor-noche-mjs',
      nombre: 'Turno Noche (8:00 PM - 9:30 PM)',
      dias: 'Mar - Jue - Sáb',
      hora: '8:00 PM - 9:30 PM',
      disciplina: 'Muay Thai / MMA',
      activo: true
    },
    {
      id: 'hor-libre',
      nombre: 'Horario Libre / Full Acceso',
      dias: 'Lunes a Sábado',
      hora: 'Turno Libre',
      disciplina: 'Todas las disciplinas',
      activo: true
    }
  ];
}

// Datos semilla de demostración para que el sistema se vea vivo desde el primer segundo
function crearDatosIniciales() {
  const hoy = getLocalDateISO();
  const hace25Dias = addDaysISO(hoy, -25);
  const venceEn3Dias = addDaysISO(hoy, 3);
  const hace40Dias = addDaysISO(hoy, -40);
  const vencioHace5Dias = addDaysISO(hoy, -5);
  const hace5Dias = addDaysISO(hoy, -5);
  const venceEn25Dias = calcularFechaFin(hace5Dias, 30);
  const venceEn1Mes = calcularFechaFin(hoy, 30);

  const horarios = crearHorariosPorDefecto();

  const planes = [
    { id: 'plan-muaythai', nombre: 'Mensual Muay Thai', disciplina: 'Muay Thai', duracion_dias: 30, precio_sugerido: 130.00, activo: true },
    { id: 'plan-boxeo', nombre: 'Mensual Boxeo', disciplina: 'Boxeo', duracion_dias: 30, precio_sugerido: 120.00, activo: true },
    { id: 'plan-bjj', nombre: 'Mensual Jiu-Jitsu (BJJ)', disciplina: 'Jiu-Jitsu', duracion_dias: 30, precio_sugerido: 150.00, activo: true },
    { id: 'plan-mma', nombre: 'Mensual MMA / Full Acceso', disciplina: 'MMA Libre', duracion_dias: 30, precio_sugerido: 170.00, activo: true },
    { id: 'plan-kids', nombre: 'Mensual Kids (Artes Marciales)', disciplina: 'Infantil', duracion_dias: 30, precio_sugerido: 110.00, activo: true },
    { id: 'plan-trimestral', nombre: 'Trimestral Full Combate (3 Meses)', disciplina: 'MMA Libre', duracion_dias: 90, precio_sugerido: 420.00, activo: true }
  ];

  const alumnos = [
    {
      id: 'alu-1',
      nombres: 'Carlos Andrés',
      apellidos: 'Mendoza Vargas',
      telefono_whatsapp: '987654321',
      contacto_emergencia: 'María Vargas (Madre)',
      telefono_emergencia: '987111222',
      grado_cinturon: 'Intermedio / Cinturón Azul',
      disciplina_principal: 'Jiu-Jitsu',
      horario_id: 'hor-noche-730pm',
      horario_texto: '7:30 PM - 9:00 PM (Lun - Mié - Vie)',
      inscripcion_pagada: true,
      notas: 'Entrena turno noche.',
      activo: true,
      fecha_registro: hace25Dias
    },
    {
      id: 'alu-2',
      nombres: 'Sebastián',
      apellidos: 'Rojas Paredes',
      telefono_whatsapp: '999888777',
      contacto_emergencia: 'Jorge Rojas (Padre / Apoderado)',
      telefono_emergencia: '999444555',
      grado_cinturon: 'Principiante / Blanco',
      disciplina_principal: 'Muay Thai',
      horario_id: 'hor-tarde-6pm',
      horario_texto: '6:00 PM - 7:30 PM (Lunes a Viernes)',
      inscripcion_pagada: true,
      notas: 'Dejó adelanto, cancela saldo a fin de semana.',
      activo: true,
      fecha_registro: hace5Dias
    },
    {
      id: 'alu-3',
      nombres: 'Valeria Sofía',
      apellidos: 'Castro Quispe',
      telefono_whatsapp: '965432189',
      contacto_emergencia: 'Elena Quispe',
      telefono_emergencia: '965000111',
      grado_cinturon: 'Competidor',
      disciplina_principal: 'Boxeo',
      horario_id: 'hor-manana-lmv',
      horario_texto: '8:00 AM - 9:30 AM (Lun - Mié - Vie)',
      inscripcion_pagada: true,
      notas: 'Membresía próxima a vencer.',
      activo: true,
      fecha_registro: hace25Dias
    },
    {
      id: 'alu-4',
      nombres: 'Diego Alejandro',
      apellidos: 'Salazar Huamán',
      telefono_whatsapp: '954123987',
      contacto_emergencia: 'Roberto Salazar',
      telefono_emergencia: '954000999',
      grado_cinturon: 'Principiante / Blanco',
      disciplina_principal: 'MMA Libre',
      horario_id: 'hor-noche-mjs',
      horario_texto: '8:00 PM - 9:30 PM (Mar - Jue - Sáb)',
      inscripcion_pagada: true,
      notas: 'Vencido hace unos días, pendiente renovar.',
      activo: true,
      fecha_registro: hace40Dias
    }
  ];

  const membresias = [
    {
      id: 'mem-1',
      alumno_id: 'alu-1',
      plan_id: 'plan-bjj',
      horario_id: 'hor-noche-730pm',
      horario_texto: '7:30 PM - 9:00 PM (Lun - Mié - Vie)',
      concepto: 'Mensual Jiu-Jitsu (BJJ)',
      fecha_inicio: hoy,
      fecha_fin: venceEn1Mes,
      total_a_pagar: 150.00,
      monto_pagado_acumulado: 150.00,
      saldo_pendiente: 0.00,
      estado_pago: 'PAGADO',
      notas: 'Pago puntual completo',
      created_at: new Date().toISOString()
    },
    {
      id: 'mem-2',
      alumno_id: 'alu-2',
      plan_id: 'plan-muaythai',
      horario_id: 'hor-tarde-6pm',
      horario_texto: '6:00 PM - 7:30 PM (Lunes a Viernes)',
      concepto: 'Mensual Muay Thai',
      fecha_inicio: hace5Dias,
      fecha_fin: venceEn25Dias,
      total_a_pagar: 130.00,
      monto_pagado_acumulado: 80.00,
      saldo_pendiente: 50.00,
      estado_pago: 'PARCIAL',
      notas: 'Adelanto de S/ 80, resta S/ 50',
      created_at: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
      id: 'mem-3',
      alumno_id: 'alu-3',
      plan_id: 'plan-boxeo',
      horario_id: 'hor-manana-lmv',
      horario_texto: '8:00 AM - 9:30 AM (Lun - Mié - Vie)',
      concepto: 'Mensual Boxeo',
      fecha_inicio: hace25Dias,
      fecha_fin: venceEn3Dias,
      total_a_pagar: 120.00,
      monto_pagado_acumulado: 120.00,
      saldo_pendiente: 0.00,
      estado_pago: 'PAGADO',
      notas: '',
      created_at: new Date(Date.now() - 25 * 86400000).toISOString()
    },
    {
      id: 'mem-4',
      alumno_id: 'alu-4',
      plan_id: 'plan-mma',
      horario_id: 'hor-noche-mjs',
      horario_texto: '8:00 PM - 9:30 PM (Mar - Jue - Sáb)',
      concepto: 'Mensual MMA / Full Acceso',
      fecha_inicio: hace40Dias,
      fecha_fin: vencioHace5Dias,
      total_a_pagar: 170.00,
      monto_pagado_acumulado: 170.00,
      saldo_pendiente: 0.00,
      estado_pago: 'PAGADO',
      notas: '',
      created_at: new Date(Date.now() - 40 * 86400000).toISOString()
    }
  ];

  const recibos = [
    {
      id: 'rec-1',
      membresia_id: 'mem-4',
      alumno_id: 'alu-4',
      numero_recibo: '000101',
      monto_abonado: 170.00,
      metodo_pago: 'EFECTIVO',
      fecha_pago: new Date(Date.now() - 40 * 86400000).toISOString(),
      observacion: 'Pago completo Mensual MMA',
      anulado: false,
      created_at: new Date(Date.now() - 40 * 86400000).toISOString()
    },
    {
      id: 'rec-2',
      membresia_id: 'mem-3',
      alumno_id: 'alu-3',
      numero_recibo: '000102',
      monto_abonado: 120.00,
      metodo_pago: 'YAPE_PLIN',
      fecha_pago: new Date(Date.now() - 25 * 86400000).toISOString(),
      observacion: 'Pago completo Mensual Boxeo',
      anulado: false,
      created_at: new Date(Date.now() - 25 * 86400000).toISOString()
    },
    {
      id: 'rec-3',
      membresia_id: 'mem-2',
      alumno_id: 'alu-2',
      numero_recibo: '000103',
      monto_abonado: 80.00,
      metodo_pago: 'YAPE_PLIN',
      fecha_pago: new Date(Date.now() - 5 * 86400000).toISOString(),
      observacion: 'Adelanto de membresía (Resta S/ 50.00)',
      anulado: false,
      created_at: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
      id: 'rec-4',
      membresia_id: 'mem-1',
      alumno_id: 'alu-1',
      numero_recibo: '000104',
      monto_abonado: 150.00,
      metodo_pago: 'EFECTIVO',
      fecha_pago: new Date().toISOString(),
      observacion: 'Inscripción Mensual Jiu-Jitsu (BJJ)',
      anulado: false,
      created_at: new Date().toISOString()
    }
  ];

  const configuracion = {
    id: 'cfg-1',
    nombre_academia: 'ACADEMIA ARTES MARCIALES',
    subtitulo: 'Muay Thai • Boxeo • Jiu-Jitsu • MMA',
    telefono: '987 654 321',
    direccion: 'Av. Principal 123 - Lima, Perú',
    moneda: 'S/',
    precio_inscripcion: 30.00,
    color_tema: 'ROJO', // ROJO | AZUL | DORADO | ESMERALDA
    tema_visual: 'CLARO', // CLARO | OSCURO
    logo_url: '',
    serie_recibo: '001',
    proximo_nro_recibo: 105,
    dias_alerta_vencimiento: 5,
    rol_actual: 'RECEPCION', // ADMIN | RECEPCION
    pin_recepcion: '2026',
    pin_admin: '1234',
    supabase_url: '',
    supabase_anon_key: ''
  };

  return {
    configuracion,
    horarios,
    planes,
    alumnos,
    membresias,
    recibos,
    actividades: []
  };
}

class GymStore {
  constructor() {
    this.state = this.loadState();
    this.listeners = [];
    this.recalcularTodasLasMembresias();
  }

  getRolDispositivoActual() {
    try {
      const savedRole = localStorage.getItem('dojo_gym_device_role');
      if (savedRole === 'ADMIN' || savedRole === 'RECEPCION') return savedRole;
    } catch (e) {}
    return this.state?.configuracion?.rol_actual || 'RECEPCION';
  }

  setRolDispositivoActual(rol) {
    try {
      localStorage.setItem('dojo_gym_device_role', rol);
    } catch (e) {}
    if (this.state?.configuracion) {
      this.state.configuracion.rol_actual = rol;
    }
  }

  registrarActividad(accion, detalle = '', actor = null) {
    if (!this.state) return;
    if (!Array.isArray(this.state.actividades)) {
      this.state.actividades = [];
    }
    const rolActual = this.getRolDispositivoActual();
    const actorFinal = actor || (rolActual === 'ADMIN' ? 'Administrador' : 'Recepción');
    this.state.actividades.unshift({
      id: generarUUID(),
      fecha: new Date().toISOString(),
      actor: actorFinal,
      accion,
      detalle
    });
    if (this.state.actividades.length > 150) {
      this.state.actividades = this.state.actividades.slice(0, 150);
    }
  }

  asegurarHorariosYValoresPorDefecto(objState) {
    if (!objState) return;
    if (objState.configuracion) {
      if (objState.configuracion.precio_inscripcion === undefined) {
        objState.configuracion.precio_inscripcion = 30.00;
      }
      if (!objState.configuracion.color_tema) {
        objState.configuracion.color_tema = 'ROJO';
      }
      if (!objState.configuracion.tema_visual) {
        objState.configuracion.tema_visual = 'CLARO';
      }
      if (!objState.configuracion.pin_recepcion) {
        objState.configuracion.pin_recepcion = '2026';
      }
      if (!objState.configuracion.pin_admin) {
        objState.configuracion.pin_admin = '1234';
      }
    }
    if (!Array.isArray(objState.actividades)) {
      objState.actividades = [];
    }
    if (!Array.isArray(objState.horarios) || objState.horarios.length === 0) {
      objState.horarios = crearHorariosPorDefecto();
    }
    // Asignar horarios por defecto a los 4 alumnos de demostración si aún no tenían
    const mapaDemoHorarios = {
      'alu-1': { id: 'hor-noche-730pm', texto: '7:30 PM - 9:00 PM (Lun - Mié - Vie)' },
      'alu-2': { id: 'hor-tarde-6pm', texto: '6:00 PM - 7:30 PM (Lunes a Viernes)' },
      'alu-3': { id: 'hor-manana-lmv', texto: '8:00 AM - 9:30 AM (Lun - Mié - Vie)' },
      'alu-4': { id: 'hor-noche-mjs', texto: '8:00 PM - 9:30 PM (Mar - Jue - Sáb)' }
    };
    if (Array.isArray(objState.alumnos)) {
      objState.alumnos.forEach((a) => {
        if (!a.horario_id && mapaDemoHorarios[a.id]) {
          a.horario_id = mapaDemoHorarios[a.id].id;
          a.horario_texto = mapaDemoHorarios[a.id].texto;
        }
      });
    }
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.configuracion && Array.isArray(parsed.alumnos)) {
          this.asegurarHorariosYValoresPorDefecto(parsed);
          const savedRole = localStorage.getItem('dojo_gym_device_role');
          if (savedRole) parsed.configuracion.rol_actual = savedRole;
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error cargando estado local:', e);
    }
    const initial = crearDatosIniciales();
    this.saveState(initial, false);
    return initial;
  }

  saveState(newState = this.state, syncCloud = true) {
    this.state = newState;
    if (this.state?.configuracion?.rol_actual) {
      try {
        localStorage.setItem('dojo_gym_device_role', this.state.configuracion.rol_actual);
      } catch (e) {}
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Error guardando estado en LocalStorage:', e);
    }
    this.notify();
    if (syncCloud && global.SupabaseSync && typeof global.SupabaseSync.programarSubidaAutomatica === 'function') {
      global.SupabaseSync.programarSubidaAutomatica(this);
    }
  }

  aplicarEstadoRemotoSinRebote(remoteState) {
    this.asegurarHorariosYValoresPorDefecto(remoteState);
    this.state = remoteState;
    this.recalcularTodasLasMembresias();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {}
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  // Recalcula automáticamente monto_pagado_acumulado, saldo_pendiente y estado_pago
  recalcularMembresia(membresiaId) {
    const mem = this.state.membresias.find((m) => m.id === membresiaId);
    if (!mem) return;

    const recibosValidos = this.state.recibos.filter(
      (r) => r.membresia_id === membresiaId && !r.anulado
    );

    const pagado = recibosValidos.reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);
    const totalPactado = Number(mem.total_a_pagar || 0);
    const saldo = Math.max(0, Number((totalPactado - pagado).toFixed(2)));

    mem.monto_pagado_acumulado = Number(pagado.toFixed(2));
    mem.saldo_pendiente = saldo;

    if (recibosValidos.length === 0 && pagado <= 0) {
      mem.estado_pago = 'PENDIENTE';
    } else if (saldo <= 0.009) {
      mem.estado_pago = 'PAGADO';
      mem.saldo_pendiente = 0;
    } else {
      mem.estado_pago = 'PARCIAL';
    }
  }

  recalcularTodasLasMembresias() {
    this.state.membresias.forEach((m) => this.recalcularMembresia(m.id));
  }

  getProximoNumeroReciboFormateado() {
    return formatearNumeroRecibo(this.state.configuracion.proximo_nro_recibo || 1);
  }

  // Verificar si un número de recibo ya existe (activo)
  existeNumeroRecibo(numeroRecibo, excludeId = null) {
    const norm = formatearNumeroRecibo(numeroRecibo);
    return this.state.recibos.some(
      (r) => !r.anulado && r.id !== excludeId && formatearNumeroRecibo(r.numero_recibo) === norm
    );
  }

  /**
   * FLUJO PRINCIPAL 1: Registrar Nuevo Pago / Inscripción / Renovación
   * Crea (o actualiza) el alumno, registra la nueva membresía con fecha_inicio, fecha_fin y total_a_pagar,
   * y emite el primer recibo con su numero_recibo y monto_abonado.
   */
  registrarInscripcionOPago(payload) {
    const {
      alumnoId, // Si viene vacío, se crea un nuevo alumno
      nombres,
      apellidos,
      telefono_whatsapp = '',
      contacto_emergencia = '',
      telefono_emergencia = '',
      grado_cinturon = 'Principiante / Blanco',
      disciplina_principal = 'General',
      horario_id = null,
      horario_texto = '',
      notas_alumno = '',
      // Datos de Membresía e Inscripción
      tipo_operacion = 'MENSUALIDAD', // 'INSCRIPCION_Y_MENSUALIDAD' | 'SOLO_INSCRIPCION' | 'MENSUALIDAD'
      incluye_inscripcion = false,
      monto_inscripcion = 0,
      monto_mensualidad = 0,
      plan_id = null,
      concepto,
      fecha_inicio,
      fecha_fin,
      total_a_pagar,
      // Datos del Recibo
      numero_recibo,
      monto_abonado,
      metodo_pago = 'EFECTIVO',
      fecha_pago = new Date().toISOString(),
      observacion = '',
      cobrado_por = 'Recepción'
    } = payload;

    const cobraInscripcion =
      Boolean(incluye_inscripcion) ||
      tipo_operacion === 'SOLO_INSCRIPCION' ||
      tipo_operacion === 'INSCRIPCION_Y_MENSUALIDAD';

    const horarioObj = (this.state.horarios || []).find((h) => h.id === horario_id) || null;
    const textoHorarioFinal =
      (horario_texto || '').trim() ||
      (horarioObj ? `${horarioObj.hora} (${horarioObj.dias})` : '');

    let targetAlumnoId = alumnoId;
    let alumnoObj = null;

    if (targetAlumnoId) {
      alumnoObj = this.state.alumnos.find((a) => a.id === targetAlumnoId);
      if (alumnoObj) {
        if (nombres) alumnoObj.nombres = nombres.trim();
        if (apellidos) alumnoObj.apellidos = apellidos.trim();
        if (telefono_whatsapp !== undefined) alumnoObj.telefono_whatsapp = telefono_whatsapp.trim();
        if (contacto_emergencia !== undefined) alumnoObj.contacto_emergencia = contacto_emergencia.trim();
        if (telefono_emergencia !== undefined) alumnoObj.telefono_emergencia = telefono_emergencia.trim();
        if (grado_cinturon) alumnoObj.grado_cinturon = grado_cinturon;
        if (disciplina_principal) alumnoObj.disciplina_principal = disciplina_principal;
        if (horario_id) alumnoObj.horario_id = horario_id;
        if (textoHorarioFinal) alumnoObj.horario_texto = textoHorarioFinal;
        if (cobraInscripcion) {
          alumnoObj.inscripcion_pagada = true;
          alumnoObj.fecha_inscripcion = fecha_inicio || getLocalDateISO();
        }
      }
    }

    if (!alumnoObj) {
      targetAlumnoId = generarUUID();
      alumnoObj = {
        id: targetAlumnoId,
        nombres: (nombres || '').trim(),
        apellidos: (apellidos || '').trim(),
        telefono_whatsapp: (telefono_whatsapp || '').trim(),
        contacto_emergencia: (contacto_emergencia || '').trim(),
        telefono_emergencia: (telefono_emergencia || '').trim(),
        grado_cinturon: grado_cinturon || 'Principiante / Blanco',
        disciplina_principal: disciplina_principal || concepto || 'Artes Marciales',
        horario_id: horario_id || null,
        horario_texto: textoHorarioFinal,
        inscripcion_pagada: cobraInscripcion,
        fecha_inscripcion: cobraInscripcion ? (fecha_inicio || getLocalDateISO()) : null,
        notas: (notas_alumno || '').trim(),
        activo: true,
        fecha_registro: getLocalDateISO()
      };
      this.state.alumnos.unshift(alumnoObj);
    }

    const totalPagarNum = Number(Number(total_a_pagar).toFixed(2));
    const abonadoNum = Number(Number(monto_abonado).toFixed(2));
    const saldoNum = Math.max(0, Number((totalPagarNum - abonadoNum).toFixed(2)));
    const estadoPago = saldoNum <= 0.009 ? 'PAGADO' : 'PARCIAL';

    const membresiaId = generarUUID();
    const nuevaMembresia = {
      id: membresiaId,
      alumno_id: targetAlumnoId,
      plan_id: tipo_operacion === 'SOLO_INSCRIPCION' ? null : (plan_id || null),
      horario_id: horario_id || alumnoObj.horario_id || null,
      horario_texto: textoHorarioFinal || alumnoObj.horario_texto || '',
      tipo_operacion,
      incluye_inscripcion: cobraInscripcion,
      monto_inscripcion: cobraInscripcion ? Number(Number(monto_inscripcion || 0).toFixed(2)) : 0,
      monto_mensualidad:
        tipo_operacion === 'SOLO_INSCRIPCION'
          ? 0
          : Number(Number(monto_mensualidad || (totalPagarNum - (cobraInscripcion ? Number(monto_inscripcion || 0) : 0))).toFixed(2)),
      concepto: (concepto || 'Membresía Artes Marciales').trim(),
      fecha_inicio: fecha_inicio || getLocalDateISO(),
      fecha_fin: tipo_operacion === 'SOLO_INSCRIPCION' ? (fecha_inicio || getLocalDateISO()) : fecha_fin,
      total_a_pagar: totalPagarNum,
      monto_pagado_acumulado: abonadoNum,
      saldo_pendiente: saldoNum,
      estado_pago: estadoPago,
      notas: observacion || '',
      created_at: new Date().toISOString()
    };

    const nroReciboFormateado = formatearNumeroRecibo(
      numero_recibo || this.state.configuracion.proximo_nro_recibo
    );

    const reciboId = generarUUID();
    const nuevoRecibo = {
      id: reciboId,
      membresia_id: membresiaId,
      alumno_id: targetAlumnoId,
      numero_recibo: nroReciboFormateado,
      monto_abonado: abonadoNum,
      metodo_pago,
      fecha_pago: fecha_pago || new Date().toISOString(),
      observacion:
        observacion.trim() ||
        (saldoNum > 0
          ? `Adelanto ${nuevaMembresia.concepto} (Resta ${this.state.configuracion.moneda} ${saldoNum.toFixed(2)})`
          : `Pago completo ${nuevaMembresia.concepto}`),
      cobrado_por: (cobrado_por || 'Recepción').trim() || 'Recepción',
      anulado: false,
      created_at: new Date().toISOString()
    };

    this.state.membresias.unshift(nuevaMembresia);
    this.state.recibos.unshift(nuevoRecibo);

    // Actualizar correlativo automático si el número ingresado es numérico >= proximo_nro_recibo
    const numEntero = parseInt(nroReciboFormateado, 10);
    if (!isNaN(numEntero) && numEntero >= this.state.configuracion.proximo_nro_recibo) {
      this.state.configuracion.proximo_nro_recibo = numEntero + 1;
    }

    this.recalcularMembresia(membresiaId);
    const moneda = this.state.configuracion.moneda || 'S/';
    const nombreCompletoLog = `${alumnoObj.nombres} ${alumnoObj.apellidos}`.trim();
    this.registrarActividad(
      'Cobro registrado',
      `Recibo N° ${nroReciboFormateado} - ${nombreCompletoLog} (${moneda} ${abonadoNum.toFixed(2)} - ${metodo_pago})`,
      nuevoRecibo.cobrado_por
    );
    this.saveState();

    return {
      alumno: alumnoObj,
      membresia: nuevaMembresia,
      recibo: nuevoRecibo
    };
  }

  /**
   * FLUJO PRINCIPAL 2: Cobrar Saldo Pendiente de una Membresía Existente
   * Genera un NUEVO recibo en la fecha actual vinculado a la misma membresía
   * para que el ingreso caiga en la caja del día en que pagó el saldo.
   */
  cobrarSaldoMembresia({ membresia_id, numero_recibo, monto_abonado, metodo_pago, observacion = '', cobrado_por = 'Recepción' }) {
    const mem = this.state.membresias.find((m) => m.id === membresia_id);
    if (!mem) throw new Error('Membresía no encontrada');

    const alumno = this.state.alumnos.find((a) => a.id === mem.alumno_id);
    const abonadoNum = Number(Number(monto_abonado).toFixed(2));
    const nroReciboFormateado = formatearNumeroRecibo(
      numero_recibo || this.state.configuracion.proximo_nro_recibo
    );

    const nuevoSaldoEstimado = Math.max(0, Number((mem.saldo_pendiente - abonadoNum).toFixed(2)));

    const nuevoRecibo = {
      id: generarUUID(),
      membresia_id: mem.id,
      alumno_id: mem.alumno_id,
      numero_recibo: nroReciboFormateado,
      monto_abonado: abonadoNum,
      metodo_pago: metodo_pago || 'EFECTIVO',
      fecha_pago: new Date().toISOString(),
      observacion:
        observacion.trim() ||
        (nuevoSaldoEstimado === 0
          ? `Cancelación de saldo - ${mem.concepto}`
          : `Abono parcial a cuenta - ${mem.concepto} (Resta ${this.state.configuracion.moneda} ${nuevoSaldoEstimado.toFixed(2)})`),
      cobrado_por: (cobrado_por || 'Recepción').trim() || 'Recepción',
      anulado: false,
      created_at: new Date().toISOString()
    };

    this.state.recibos.unshift(nuevoRecibo);

    const numEntero = parseInt(nroReciboFormateado, 10);
    if (!isNaN(numEntero) && numEntero >= this.state.configuracion.proximo_nro_recibo) {
      this.state.configuracion.proximo_nro_recibo = numEntero + 1;
    }

    this.recalcularMembresia(mem.id);
    const moneda = this.state.configuracion.moneda || 'S/';
    const nombreAlumno = alumno ? `${alumno.nombres} ${alumno.apellidos}`.trim() : 'Alumno';
    this.registrarActividad(
      'Cobro de saldo',
      `Recibo N° ${nroReciboFormateado} - ${nombreAlumno} (${moneda} ${abonadoNum.toFixed(2)})`,
      nuevoRecibo.cobrado_por
    );
    this.saveState();

    return {
      alumno,
      membresia: mem,
      recibo: nuevoRecibo
    };
  }

  // Anular o Reactivar un recibo y recalcular automáticamente el saldo de la membresía
  toggleAnularRecibo(reciboId) {
    const rec = this.state.recibos.find((r) => r.id === reciboId);
    if (!rec) return null;
    rec.anulado = !rec.anulado;
    this.recalcularMembresia(rec.membresia_id);
    this.registrarActividad(
      rec.anulado ? 'Recibo anulado' : 'Recibo reactivado',
      `Recibo N° ${rec.numero_recibo} (S/ ${Number(rec.monto_abonado || 0).toFixed(2)})`
    );
    this.saveState();
    return rec;
  }

  // Editar un recibo/membresía existente (por si hubo error de digitación en N° de recibo o fechas)
  actualizarReciboYMembresia(reciboId, cambios) {
    const rec = this.state.recibos.find((r) => r.id === reciboId);
    if (!rec) return null;
    const mem = this.state.membresias.find((m) => m.id === rec.membresia_id);
    const alu = this.state.alumnos.find((a) => a.id === rec.alumno_id);

    if (cambios.numero_recibo !== undefined) {
      rec.numero_recibo = formatearNumeroRecibo(cambios.numero_recibo);
    }
    if (cambios.monto_abonado !== undefined) {
      rec.monto_abonado = Number(Number(cambios.monto_abonado).toFixed(2));
    }
    if (cambios.metodo_pago !== undefined) {
      rec.metodo_pago = cambios.metodo_pago;
    }
    if (cambios.observacion !== undefined) {
      rec.observacion = cambios.observacion;
    }
    if (cambios.cobrado_por !== undefined) {
      rec.cobrado_por = cambios.cobrado_por;
    }

    if (mem) {
      if (cambios.fecha_inicio) mem.fecha_inicio = cambios.fecha_inicio;
      if (cambios.fecha_fin) mem.fecha_fin = cambios.fecha_fin;
      if (cambios.total_a_pagar !== undefined) {
        mem.total_a_pagar = Number(Number(cambios.total_a_pagar).toFixed(2));
      }
      if (cambios.concepto) mem.concepto = cambios.concepto;
      this.recalcularMembresia(mem.id);
    }

    if (alu) {
      if (cambios.nombres) alu.nombres = cambios.nombres.trim();
      if (cambios.apellidos) alu.apellidos = cambios.apellidos.trim();
      if (cambios.telefono_whatsapp !== undefined) alu.telefono_whatsapp = cambios.telefono_whatsapp.trim();
    }

    this.registrarActividad('Recibo/membresía editados', `Recibo N° ${rec.numero_recibo}`);
    this.saveState();
    return { recibo: rec, membresia: mem, alumno: alu };
  }

  // Gestión de Alumnos
  guardarAlumno(datos) {
    let horarioTextoResuelto = datos.horario_texto;
    if (datos.horario_id !== undefined) {
      const hObj = (this.state.horarios || []).find((h) => h.id === datos.horario_id);
      if (hObj) {
        horarioTextoResuelto = `${hObj.hora} (${hObj.dias})`;
      } else if (!datos.horario_id) {
        horarioTextoResuelto = '';
      }
    }

    if (datos.id) {
      const idx = this.state.alumnos.findIndex((a) => a.id === datos.id);
      if (idx !== -1) {
        this.state.alumnos[idx] = {
          ...this.state.alumnos[idx],
          ...datos,
          nombres: (datos.nombres ?? this.state.alumnos[idx].nombres).trim(),
          apellidos: (datos.apellidos ?? this.state.alumnos[idx].apellidos).trim(),
          telefono_whatsapp: (datos.telefono_whatsapp ?? this.state.alumnos[idx].telefono_whatsapp ?? '').trim(),
          contacto_emergencia: (datos.contacto_emergencia ?? this.state.alumnos[idx].contacto_emergencia ?? '').trim(),
          telefono_emergencia: (datos.telefono_emergencia ?? this.state.alumnos[idx].telefono_emergencia ?? '').trim(),
          horario_texto: horarioTextoResuelto !== undefined ? horarioTextoResuelto : (this.state.alumnos[idx].horario_texto || '')
        };
        this.registrarActividad('Alumno actualizado', `${this.state.alumnos[idx].nombres} ${this.state.alumnos[idx].apellidos}`.trim());
        this.saveState();
        return this.state.alumnos[idx];
      }
    }
    const nuevo = {
      id: generarUUID(),
      nombres: (datos.nombres || '').trim(),
      apellidos: (datos.apellidos || '').trim(),
      telefono_whatsapp: (datos.telefono_whatsapp || '').trim(),
      contacto_emergencia: (datos.contacto_emergencia || '').trim(),
      telefono_emergencia: (datos.telefono_emergencia || '').trim(),
      grado_cinturon: datos.grado_cinturon || 'Principiante / Blanco',
      disciplina_principal: datos.disciplina_principal || 'Artes Marciales',
      horario_id: datos.horario_id || null,
      horario_texto: horarioTextoResuelto || '',
      inscripcion_pagada: datos.inscripcion_pagada !== undefined ? Boolean(datos.inscripcion_pagada) : false,
      notas: (datos.notas || '').trim(),
      activo: true,
      fecha_registro: getLocalDateISO()
    };
    this.state.alumnos.unshift(nuevo);
    this.registrarActividad('Alumno registrado', `${nuevo.nombres} ${nuevo.apellidos}`.trim());
    this.saveState();
    return nuevo;
  }

  eliminarAlumno(alumnoId) {
    const alu = this.state.alumnos.find((a) => a.id === alumnoId);
    const nombre = alu ? `${alu.nombres} ${alu.apellidos}`.trim() : alumnoId;
    this.state.alumnos = this.state.alumnos.filter((a) => a.id !== alumnoId);
    this.state.membresias = this.state.membresias.filter((m) => m.alumno_id !== alumnoId);
    this.state.recibos = this.state.recibos.filter((r) => r.alumno_id !== alumnoId);
    this.registrarActividad('Alumno eliminado', nombre);
    this.saveState();
  }

  // Gestión de Horarios / Turnos de Entrenamiento
  guardarHorario(horario) {
    if (!Array.isArray(this.state.horarios)) {
      this.state.horarios = crearHorariosPorDefecto();
    }
    const nombreLimpio = (horario.nombre || '').trim();
    const diasLimpio = (horario.dias || '').trim();
    const horaLimpia = (horario.hora || '').trim();
    const disciplinaLimpia = (horario.disciplina || 'General').trim();
    const etiquetaCompleta = `${horaLimpia} (${diasLimpio})`;

    if (horario.id) {
      const idx = this.state.horarios.findIndex((h) => h.id === horario.id);
      if (idx !== -1) {
        this.state.horarios[idx] = {
          ...this.state.horarios[idx],
          nombre: nombreLimpio,
          dias: diasLimpio,
          hora: horaLimpia,
          disciplina: disciplinaLimpia,
          activo: horario.activo !== undefined ? horario.activo : true
        };
        // Actualizar también el texto de horario en los alumnos que tienen este horario_id
        this.state.alumnos.forEach((alu) => {
          if (alu.horario_id === horario.id) {
            alu.horario_texto = etiquetaCompleta;
          }
        });
        this.registrarActividad('Horario actualizado', `${nombreLimpio} (${etiquetaCompleta})`);
        this.saveState();
        return this.state.horarios[idx];
      }
    }

    const nuevoHorario = {
      id: generarUUID(),
      nombre: nombreLimpio,
      dias: diasLimpio,
      hora: horaLimpia,
      disciplina: disciplinaLimpia,
      activo: true
    };
    this.state.horarios.push(nuevoHorario);
    this.registrarActividad('Horario creado', `${nombreLimpio} (${etiquetaCompleta})`);
    this.saveState();
    return nuevoHorario;
  }

  eliminarHorario(horarioId) {
    if (!Array.isArray(this.state.horarios)) return;
    const h = this.state.horarios.find((item) => item.id === horarioId);
    this.state.horarios = this.state.horarios.filter((item) => item.id !== horarioId);
    this.registrarActividad('Horario eliminado', h ? h.nombre : horarioId);
    this.saveState();
  }

  // Gestión de Planes / Disciplinas
  guardarPlan(plan) {
    if (plan.id) {
      const idx = this.state.planes.findIndex((p) => p.id === plan.id);
      if (idx !== -1) {
        this.state.planes[idx] = {
          ...this.state.planes[idx],
          nombre: plan.nombre.trim(),
          disciplina: plan.disciplina.trim(),
          duracion_dias: Number(plan.duracion_dias) || 30,
          precio_sugerido: Number(plan.precio_sugerido) || 0,
          activo: plan.activo !== undefined ? plan.activo : true
        };
        this.registrarActividad('Plan actualizado', plan.nombre.trim());
        this.saveState();
        return this.state.planes[idx];
      }
    }
    const nuevo = {
      id: generarUUID(),
      nombre: plan.nombre.trim(),
      disciplina: plan.disciplina.trim(),
      duracion_dias: Number(plan.duracion_dias) || 30,
      precio_sugerido: Number(plan.precio_sugerido) || 0,
      activo: true
    };
    this.state.planes.push(nuevo);
    this.registrarActividad('Plan creado', nuevo.nombre);
    this.saveState();
    return nuevo;
  }

  eliminarPlan(planId) {
    const p = this.state.planes.find((item) => item.id === planId);
    this.state.planes = this.state.planes.filter((item) => item.id !== planId);
    this.registrarActividad('Plan eliminado', p ? p.nombre : planId);
    this.saveState();
  }

  // Configuración
  actualizarConfiguracion(nuevosDatos) {
    this.state.configuracion = {
      ...this.state.configuracion,
      ...nuevosDatos,
      precio_inscripcion: Number(nuevosDatos.precio_inscripcion ?? this.state.configuracion.precio_inscripcion ?? 30),
      proximo_nro_recibo: Number(nuevosDatos.proximo_nro_recibo ?? this.state.configuracion.proximo_nro_recibo),
      dias_alerta_vencimiento: Number(nuevosDatos.dias_alerta_vencimiento ?? this.state.configuracion.dias_alerta_vencimiento)
    };
    this.registrarActividad('Configuración actualizada', this.state.configuracion.nombre_academia || 'Ajustes generales');
    this.saveState();
    return this.state.configuracion;
  }

  // Obtener lista enriquecida de alumnos con su estado de vigencia, inscripción, horario y deuda actual
  getAlumnosConEstado() {
    const diasAlerta = Number(this.state.configuracion.dias_alerta_vencimiento) || 5;
    const listaHorarios = this.state.horarios || [];

    return this.state.alumnos.map((alumno) => {
      const memsAlumno = this.state.membresias
        .filter((m) => m.alumno_id === alumno.id && m.estado_pago !== 'ANULADO')
        .sort((a, b) => (a.fecha_fin < b.fecha_fin ? 1 : -1));

      const memsMensuales = memsAlumno.filter((m) => m.tipo_operacion !== 'SOLO_INSCRIPCION');
      const ultimaMembresia = memsMensuales[0] || null;
      const saldoTotalPendiente = memsAlumno.reduce((acc, m) => acc + Number(m.saldo_pendiente || 0), 0);

      // Resolver horario del alumno
      const horarioObj = listaHorarios.find((h) => h.id === alumno.horario_id) || null;
      const horarioTextoResuelto =
        alumno.horario_texto ||
        (horarioObj ? `${horarioObj.hora} (${horarioObj.dias})` : '') ||
        (ultimaMembresia && ultimaMembresia.horario_texto ? ultimaMembresia.horario_texto : 'Sin horario asignado');
      const horarioNombreCorto = horarioObj ? horarioObj.nombre : horarioTextoResuelto;

      // Si el alumno ya tiene membresías registradas o pagó inscripción explícitamente, figura inscrito
      const tieneInscripcionPagada =
        alumno.inscripcion_pagada === true ||
        memsAlumno.some(
          (m) =>
            m.incluye_inscripcion === true ||
            m.tipo_operacion === 'SOLO_INSCRIPCION' ||
            m.tipo_operacion === 'INSCRIPCION_Y_MENSUALIDAD'
        ) ||
        (alumno.inscripcion_pagada === undefined && memsMensuales.length > 0);

      let estadoVigencia = 'SIN_MEMBRESIA';
      let diasRestantes = null;

      if (ultimaMembresia) {
        diasRestantes = calcularDiasRestantes(ultimaMembresia.fecha_fin);
        if (diasRestantes < 0) {
          estadoVigencia = 'VENCIDO';
        } else if (diasRestantes <= diasAlerta) {
          estadoVigencia = 'POR_VENCER';
        } else {
          estadoVigencia = 'ACTIVO';
        }
      } else if (tieneInscripcionPagada) {
        estadoVigencia = 'SOLO_INSCRITO';
      }

      return {
        ...alumno,
        horario_id: alumno.horario_id || (horarioObj ? horarioObj.id : ''),
        horario_texto: horarioTextoResuelto,
        horario_nombre: horarioNombreCorto,
        inscripcion_pagada: tieneInscripcionPagada,
        nombre_completo: `${alumno.nombres} ${alumno.apellidos}`.trim(),
        ultima_membresia: ultimaMembresia,
        membresias_historial: memsAlumno,
        estado_vigencia: estadoVigencia,
        dias_restantes: diasRestantes,
        saldo_total_pendiente: Number(saldoTotalPendiente.toFixed(2)),
        total_membresias: memsAlumno.length
      };
    });
  }

  // Obtener todos los recibos enriquecidos con datos de alumno y membresía
  getRecibosDetallados() {
    return this.state.recibos.map((rec) => {
      const alumno = this.state.alumnos.find((a) => a.id === rec.alumno_id) || {
        nombres: 'Alumno',
        apellidos: 'Eliminado',
        telefono_whatsapp: ''
      };
      const membresia = this.state.membresias.find((m) => m.id === rec.membresia_id) || {
        concepto: 'Membresía',
        fecha_inicio: '',
        fecha_fin: '',
        total_a_pagar: rec.monto_abonado,
        monto_pagado_acumulado: rec.monto_abonado,
        saldo_pendiente: 0,
        estado_pago: 'PAGADO'
      };
      return {
        ...rec,
        alumno,
        nombre_completo: `${alumno.nombres} ${alumno.apellidos}`.trim(),
        membresia
      };
    });
  }

  // Limpiar datos de demostración para empezar desde cero con el gimnasio real
  limpiarDatosParaProduccion() {
    this.state.alumnos = [];
    this.state.membresias = [];
    this.state.recibos = [];
    this.state.configuracion.proximo_nro_recibo = 1;
    this.saveState();
  }

  restaurarDatosDemo() {
    const demo = crearDatosIniciales();
    this.saveState(demo);
  }
}

const storeInstance = new GymStore();

global.GymStore = {
  store: storeInstance,
  getLocalDateISO,
  formatDatePE,
  formatDateTimePE,
  calcularFechaFin,
  addDaysISO,
  calcularDiasRestantes,
  generarUUID,
  formatearNumeroRecibo
};
})(window);
