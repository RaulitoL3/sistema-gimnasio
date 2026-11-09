-- ============================================================================
-- SISTEMA DE GESTIÓN PARA GIMNASIO DE ARTES MARCIALES
-- Esquema Relacional PostgreSQL / Supabase
-- ============================================================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: CONFIGURACIÓN DEL GIMNASIO
CREATE TABLE IF NOT EXISTS public.configuracion_gym (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_academia VARCHAR(150) NOT NULL DEFAULT 'Academia de Artes Marciales',
    subtitulo VARCHAR(150) DEFAULT 'Centro de Entrenamiento & Combate',
    telefono VARCHAR(30) DEFAULT '',
    direccion VARCHAR(200) DEFAULT '',
    moneda VARCHAR(10) NOT NULL DEFAULT 'S/',
    precio_inscripcion NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
    serie_recibo VARCHAR(10) NOT NULL DEFAULT '001',
    proximo_nro_recibo INTEGER NOT NULL DEFAULT 1,
    dias_alerta_vencimiento INTEGER NOT NULL DEFAULT 5,
    logo_url TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABLA: CATÁLOGO DE PLANES Y DISCIPLINAS
CREATE TABLE IF NOT EXISTS public.planes_disciplinas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(120) NOT NULL,           -- Ej: "Mensual Muay Thai", "Trimestral MMA Libre"
    disciplina VARCHAR(80) NOT NULL,        -- Ej: "Muay Thai", "Boxeo", "BJJ", "MMA", "Karate", "Taekwondo"
    duracion_dias INTEGER NOT NULL DEFAULT 30,
    precio_sugerido NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA: ALUMNOS
CREATE TABLE IF NOT EXISTS public.alumnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombres VARCHAR(120) NOT NULL,
    apellidos VARCHAR(120) NOT NULL,
    telefono_whatsapp VARCHAR(30) DEFAULT '',
    contacto_emergencia VARCHAR(150) DEFAULT '',  -- Nombre del padre/madre/apoderado o contacto
    telefono_emergencia VARCHAR(30) DEFAULT '',
    grado_cinturon VARCHAR(60) DEFAULT 'Principiante / Blanco',
    disciplina_principal VARCHAR(80) DEFAULT 'General',
    inscripcion_pagada BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_inscripcion DATE,
    notas TEXT DEFAULT '',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLA: MEMBRESÍAS (Períodos contratados por alumno)
CREATE TABLE IF NOT EXISTS public.membresias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.planes_disciplinas(id) ON DELETE SET NULL,
    tipo_operacion VARCHAR(30) NOT NULL DEFAULT 'MENSUALIDAD', -- 'INSCRIPCION_Y_MENSUALIDAD' | 'SOLO_INSCRIPCION' | 'MENSUALIDAD'
    incluye_inscripcion BOOLEAN NOT NULL DEFAULT FALSE,
    monto_inscripcion NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    monto_mensualidad NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    concepto VARCHAR(160) NOT NULL,         -- Ej: "Inscripción + Mensual Muay Thai"
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    total_a_pagar NUMERIC(10, 2) NOT NULL CHECK (total_a_pagar >= 0),
    monto_pagado_acumulado NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    saldo_pendiente NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    estado_pago VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_pago IN ('PAGADO', 'PARCIAL', 'PENDIENTE', 'ANULADO')),
    notas TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABLA: RECIBOS / PAGOS (Cada abono o pago completo con su N° de recibo)
CREATE TABLE IF NOT EXISTS public.recibos_pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membresia_id UUID NOT NULL REFERENCES public.membresias(id) ON DELETE CASCADE,
    alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
    numero_recibo VARCHAR(40) NOT NULL,     -- Ej: "000145" (Secuencial automático o manual de talonario)
    monto_abonado NUMERIC(10, 2) NOT NULL CHECK (monto_abonado > 0),
    metodo_pago VARCHAR(30) NOT NULL DEFAULT 'EFECTIVO' CHECK (metodo_pago IN ('EFECTIVO', 'YAPE_PLIN', 'TRANSFERENCIA', 'TARJETA')),
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    observacion VARCHAR(250) DEFAULT '',
    anulado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES PARA BÚSQUEDAS RÁPIDAS Y REPORTES DE CAJA
CREATE INDEX IF NOT EXISTS idx_alumnos_nombres_apellidos ON public.alumnos (apellidos, nombres);
CREATE INDEX IF NOT EXISTS idx_membresias_alumno_id ON public.membresias (alumno_id);
CREATE INDEX IF NOT EXISTS idx_membresias_fecha_fin ON public.membresias (fecha_fin);
CREATE INDEX IF NOT EXISTS idx_membresias_estado_pago ON public.membresias (estado_pago);
CREATE INDEX IF NOT EXISTS idx_recibos_numero ON public.recibos_pagos (numero_recibo);
CREATE INDEX IF NOT EXISTS idx_recibos_fecha_pago ON public.recibos_pagos (fecha_pago);

-- ============================================================================
-- TRIGGER AUTOMÁTICO: Recalcular saldo_pendiente y estado_pago en MEMBRESIAS
-- cada vez que se inserta, actualiza o anula un RECIBO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_recalcular_saldo_membresia()
RETURNS TRIGGER AS $$
DECLARE
    v_membresia_id UUID;
    v_total_pagado NUMERIC(10, 2);
    v_total_pactado NUMERIC(10, 2);
    v_saldo NUMERIC(10, 2);
    v_estado VARCHAR(20);
BEGIN
    v_membresia_id := COALESCE(NEW.membresia_id, OLD.membresia_id);

    SELECT COALESCE(SUM(monto_abonado), 0.00)
    INTO v_total_pagado
    FROM public.recibos_pagos
    WHERE membresia_id = v_membresia_id AND anulado = FALSE;

    SELECT total_a_pagar
    INTO v_total_pactado
    FROM public.membresias
    WHERE id = v_membresia_id;

    v_saldo := GREATEST(v_total_pactado - v_total_pagado, 0.00);

    IF v_total_pagado <= 0 THEN
        v_estado := 'PENDIENTE';
    ELSIF v_saldo = 0 THEN
        v_estado := 'PAGADO';
    ELSE
        v_estado := 'PARCIAL';
    END IF;

    UPDATE public.membresias
    SET monto_pagado_acumulado = v_total_pagado,
        saldo_pendiente = v_saldo,
        estado_pago = v_estado
    WHERE id = v_membresia_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalcular_saldo_membresia ON public.recibos_pagos;
CREATE TRIGGER trg_recalcular_saldo_membresia
AFTER INSERT OR UPDATE OR DELETE ON public.recibos_pagos
FOR EACH ROW EXECUTE FUNCTION public.fn_recalcular_saldo_membresia();

-- ============================================================================
-- DATOS SEMILLA INICIALES (Configuración + Planes de Artes Marciales)
-- ============================================================================
INSERT INTO public.configuracion_gym (nombre_academia, subtitulo, moneda, serie_recibo, proximo_nro_recibo, dias_alerta_vencimiento)
SELECT 'DOJO & GYM ARTES MARCIALES', 'Muay Thai • Boxeo • Jiu-Jitsu • MMA', 'S/', '001', 101, 5
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion_gym);

INSERT INTO public.planes_disciplinas (nombre, disciplina, duracion_dias, precio_sugerido)
SELECT * FROM (VALUES
    ('Mensual Muay Thai', 'Muay Thai', 30, 120.00),
    ('Mensual Boxeo', 'Boxeo', 30, 110.00),
    ('Mensual Jiu-Jitsu (BJJ)', 'Jiu-Jitsu', 30, 140.00),
    ('Mensual MMA / Full Acceso', 'MMA Libre', 30, 160.00),
    ('Mensual Kids (Karate / TKD)', 'Infantil', 30, 100.00),
    ('Trimestral Full Artes Marciales', 'MMA Libre', 90, 380.00)
) AS seed(nombre, disciplina, duracion_dias, precio_sugerido)
WHERE NOT EXISTS (SELECT 1 FROM public.planes_disciplinas);

-- ============================================================================
-- 6. TABLA DE SINCRONIZACIÓN INSTANTÁNEA MULTIDISPOSITIVO (PC + CELULARES)
-- Permite que Papá y Recepcionistas vean exactamente los mismos recibos,
-- alumnos, saldos y planes en tiempo real desde cualquier dispositivo.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gym_cloud_state (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'main_gym',
    state_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar políticas de acceso para la aplicación web (Rol Anon / Authenticated)
ALTER TABLE public.configuracion_gym ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membresias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_cloud_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total app gym config" ON public.configuracion_gym;
CREATE POLICY "Acceso total app gym config" ON public.configuracion_gym FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app gym planes" ON public.planes_disciplinas;
CREATE POLICY "Acceso total app gym planes" ON public.planes_disciplinas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app gym alumnos" ON public.alumnos;
CREATE POLICY "Acceso total app gym alumnos" ON public.alumnos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app gym membresias" ON public.membresias;
CREATE POLICY "Acceso total app gym membresias" ON public.membresias FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app gym recibos" ON public.recibos_pagos;
CREATE POLICY "Acceso total app gym recibos" ON public.recibos_pagos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app gym state" ON public.gym_cloud_state;
CREATE POLICY "Acceso total app gym state" ON public.gym_cloud_state FOR ALL USING (true) WITH CHECK (true);

