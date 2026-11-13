export type MetodoPago = 'EFECTIVO' | 'YAPE_PLIN' | 'TRANSFERENCIA' | 'TARJETA';

export type EstadoPagoMembresia = 'PAGADO' | 'PARCIAL' | 'PENDIENTE' | 'ANULADO';

export type EstadoVigencia = 'ACTIVO' | 'SOLO_INSCRITO' | 'POR_VENCER' | 'VENCIDO' | 'SIN_MEMBRESIA';

export type TipoOperacionMembresia = 'INSCRIPCION_Y_MENSUALIDAD' | 'SOLO_INSCRIPCION' | 'MENSUALIDAD';

export interface ConfiguracionGym {
  id: string;
  nombre_academia: string;
  subtitulo: string;
  telefono: string;
  direccion: string;
  moneda: string;
  precio_inscripcion: number;
  serie_recibo: string;
  proximo_nro_recibo: number;
  dias_alerta_vencimiento: number;
  logo_url?: string;
  pin_recepcion?: string;
  pin_admin?: string;
  rol_actual?: 'ADMIN' | 'RECEPCION';
  supabase_url?: string;
  supabase_anon_key?: string;
}

export interface PlanDisciplina {
  id: string;
  nombre: string;
  disciplina: string;
  duracion_dias: number;
  precio_sugerido: number;
  activo: boolean;
}

export interface HorarioClase {
  id: string;
  nombre: string;
  dias: string;       // Ej: 'Lun - Mié - Vie', 'Mar - Jue - Sáb', 'Lunes a Viernes'
  hora: string;       // Ej: '7:00 PM - 8:30 PM'
  disciplina: string; // Ej: 'Muay Thai / Boxeo'
  activo: boolean;
}

export interface Alumno {
  id: string;
  nombres: string;
  apellidos: string;
  telefono_whatsapp: string;
  contacto_emergencia: string;
  telefono_emergencia: string;
  grado_cinturon: string;
  disciplina_principal: string;
  horario_id?: string | null;
  horario_texto?: string;
  inscripcion_pagada: boolean;
  fecha_inscripcion?: string | null;
  notas: string;
  activo: boolean;
  fecha_registro: string;
}

export interface Membresia {
  id: string;
  alumno_id: string;
  plan_id?: string | null;
  horario_id?: string | null;
  horario_texto?: string;
  tipo_operacion: TipoOperacionMembresia;
  incluye_inscripcion: boolean;
  monto_inscripcion: number;
  monto_mensualidad: number;
  concepto: string;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string;    // YYYY-MM-DD
  total_a_pagar: number;
  monto_pagado_acumulado: number;
  saldo_pendiente: number;
  estado_pago: EstadoPagoMembresia;
  notas?: string;
  created_at: string;
}

export interface ReciboPago {
  id: string;
  membresia_id: string;
  alumno_id: string;
  numero_recibo: string;
  monto_abonado: number;
  metodo_pago: MetodoPago;
  fecha_pago: string; // ISO string
  observacion: string;
  cobrado_por?: string;
  anulado: boolean;
  created_at: string;
}

export interface ActividadLog {
  id: string;
  fecha: string;
  actor: string;
  accion: string;
  detalle: string;
}

export interface AlumnoConEstado extends Alumno {
  ultima_membresia?: Membresia;
  estado_vigencia: EstadoVigencia;
  dias_restantes: number | null;
  saldo_total_pendiente: number;
  total_membresias: number;
}
