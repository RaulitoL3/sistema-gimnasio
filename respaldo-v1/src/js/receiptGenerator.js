/**
 * GENERADOR DE COMPROBANTES DIGITALES (PNG HD + PORTAPAPELES + IMPRESIÓN + WHATSAPP)
 */
(function (global) {
  const { formatDatePE, formatDateTimePE } = global.GymStore;

  const METODO_LABELS = {
    EFECTIVO: 'EFECTIVO',
    YAPE_PLIN: 'YAPE / PLIN',
    TRANSFERENCIA: 'TRANSFERENCIA',
    TARJETA: 'TARJETA POS'
  };

  const BRAND_PALETTES = {
    ROJO: { gradEnd: '#991b1b', accent: '#dc2626', subtext: '#fca5a5' },
    AZUL: { gradEnd: '#1e40af', accent: '#2563eb', subtext: '#93c5fd' },
    DORADO: { gradEnd: '#92400e', accent: '#d97706', subtext: '#fde68a' },
    ESMERALDA: { gradEnd: '#065f46', accent: '#059669', subtext: '#6ee7b7' }
  };

  let cachedLogoUrl = '';
  let cachedLogoImg = null;

  /**
   * Dibuja el comprobante digital en un elemento <canvas> en alta resolución
   */
  function dibujarReciboEnCanvas(canvas, detalleRecibo, config) {
    if (!canvas || !detalleRecibo) return;
    const ctx = canvas.getContext('2d');
    const W = 800;
    const H = 1020;
    canvas.width = W;
    canvas.height = H;

    const palette = BRAND_PALETTES[config.color_tema] || BRAND_PALETTES.ROJO;
    const moneda = config.moneda || 'S/';
    const { alumno, membresia } = detalleRecibo;
    const nombreCompleto = `${alumno.nombres || ''} ${alumno.apellidos || ''}`.trim();
    const saldoPendiente = Number(membresia.saldo_pendiente || 0);
    const totalPagar = Number(membresia.total_a_pagar || 0);
    const montoAbonado = Number(detalleRecibo.monto_abonado || 0);
    const horarioTexto = membresia.horario_texto || alumno.horario_texto || '';

    // 1. Fondo principal
    ctx.fillStyle = '#0f172a'; // Slate 900
    ctx.fillRect(0, 0, W, H);

    // Tarjeta blanca interna
    const cardX = 36;
    const cardY = 36;
    const cardW = W - 72;
    const cardH = H - 72;

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fill();

    // Cabecera oscura deportiva con el color personalizado de la academia
    const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 190);
    headerGrad.addColorStop(0, '#0f172a');
    headerGrad.addColorStop(0.6, '#1e293b');
    headerGrad.addColorStop(1, palette.gradEnd);
    ctx.fillStyle = headerGrad;
    roundRectTop(ctx, cardX, cardY, cardW, 195, 24);
    ctx.fill();

    // Franja decorativa inferior del header
    ctx.fillStyle = palette.accent;
    ctx.fillRect(cardX, cardY + 190, cardW, 6);

    // Icono/Emblema circular en cabecera
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(cardX + 68, cardY + 80, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🥋', cardX + 68, cardY + 90);

    // Si hay logo_url cargado, usar caché sincrónica o cargarlo y redibujar
    if (config.logo_url) {
      if (cachedLogoUrl === config.logo_url && cachedLogoImg && cachedLogoImg.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cardX + 68, cardY + 80, 34, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cardX + 34, cardY + 46, 68, 68);
        ctx.drawImage(cachedLogoImg, cardX + 34, cardY + 46, 68, 68);
        ctx.restore();
      } else {
        const img = new Image();
        img.onload = () => {
          cachedLogoUrl = config.logo_url;
          cachedLogoImg = img;
          dibujarReciboEnCanvas(canvas, detalleRecibo, config);
        };
        img.src = config.logo_url;
      }
    }

    // Nombre de la Academia
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px "Inter", system-ui, sans-serif';
    ctx.fillText((config.nombre_academia || 'GIMNASIO ARTES MARCIALES').toUpperCase(), cardX + 118, cardY + 68);

    ctx.fillStyle = palette.subtext;
    ctx.font = '600 15px "Inter", system-ui, sans-serif';
    ctx.fillText(config.subtitulo || 'Centro de Entrenamiento & Artes Marciales', cardX + 118, cardY + 95);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '400 13px "Inter", system-ui, sans-serif';
    const infoContacto = [config.direccion, config.telefono ? `Tel/WhatsApp: ${config.telefono}` : '']
      .filter(Boolean)
      .join('  •  ');
    ctx.fillText(infoContacto || 'Comprobante Oficial de Pago e Inscripción', cardX + 118, cardY + 120);

    // Badge RECIBO N°
    const badgeW = 240;
    const badgeH = 44;
    const badgeX = cardX + cardW - badgeW - 32;
    const badgeY = cardY + 132;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px "Inter", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`RECIBO N° ${detalleRecibo.numero_recibo}`, badgeX + badgeW / 2, badgeY + 28);

    // Estado del recibo (Pagado / Adelanto / Anulado)
    ctx.textAlign = 'left';
    let estadoTexto = 'PAGO COMPLETO';
    let estadoBg = '#dcfce7';
    let estadoColor = '#15803d';

    if (detalleRecibo.anulado) {
      estadoTexto = 'RECIBO ANULADO';
      estadoBg = '#fee2e2';
      estadoColor = '#b91c1c';
    } else if (saldoPendiente > 0) {
      estadoTexto = 'ADELANTO / SALDO PENDIENTE';
      estadoBg = '#fef3c7';
      estadoColor = '#b45309';
    }

    ctx.fillStyle = estadoBg;
    roundRect(ctx, cardX + 36, cardY + 220, 260, 34, 17);
    ctx.fill();
    ctx.fillStyle = estadoColor;
    ctx.font = '700 13px "Inter", system-ui, sans-serif';
    ctx.fillText(`●  ${estadoTexto}`, cardX + 52, cardY + 242);

    // Fecha de emisión
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = '500 14px "Inter", system-ui, sans-serif';
    ctx.fillText(`Emitido: ${formatDateTimePE(detalleRecibo.fecha_pago)}`, cardX + cardW - 36, cardY + 242);

    // Sección 1: Datos del Alumno
    let y = cardY + 280;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, cardX + 36, y, cardW - 72, 130, 14);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '700 12px "Inter", system-ui, sans-serif';
    ctx.fillText('ALUMNO / DEPORTISTA (NOMBRES Y APELLIDOS)', cardX + 58, y + 30);

    ctx.fillStyle = '#0f172a';
    ctx.font = '800 24px "Inter", system-ui, sans-serif';
    ctx.fillText(nombreCompleto || 'Alumno', cardX + 58, y + 64);

    ctx.fillStyle = '#475569';
    ctx.font = '500 14px "Inter", system-ui, sans-serif';
    const extraAlumno = [
      alumno.grado_cinturon ? `Grado: ${alumno.grado_cinturon}` : '',
      horarioTexto ? `Horario: ${horarioTexto}` : '',
      alumno.telefono_whatsapp ? `WhatsApp: ${alumno.telefono_whatsapp}` : ''
    ]
      .filter(Boolean)
      .join('   |   ');
    ctx.fillText((extraAlumno || 'Deportista inscrito').slice(0, 88), cardX + 58, y + 100);

    // Sección 2: Plan y Periodo de Vigencia (Fecha de Inicio y Fecha de Finalización)
    y += 152;
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, cardX + 36, y, cardW - 72, 165, 14);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '700 12px "Inter", system-ui, sans-serif';
    ctx.fillText('PLAN / CONCEPTO DE MEMBRESÍA', cardX + 58, y + 30);

    ctx.fillStyle = '#0f172a';
    ctx.font = '800 20px "Inter", system-ui, sans-serif';
    const textoConcepto =
      membresia.incluye_inscripcion && Number(membresia.monto_inscripcion) > 0 && membresia.tipo_operacion !== 'SOLO_INSCRIPCION'
        ? `${membresia.concepto} (Insc: ${moneda}${Number(membresia.monto_inscripcion).toFixed(0)} + Plan: ${moneda}${Number(membresia.monto_mensualidad).toFixed(0)})`
        : membresia.concepto || 'Membresía Mensual';
    ctx.fillText(textoConcepto, cardX + 58, y + 60);

    // Cajas de Fecha de Inicio y Fecha de Finalización
    const boxW = (cardW - 140) / 2;
    const boxY = y + 80;

    // Fecha de Inicio
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX + 58, boxY, boxW, 64, 10);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '700 11px "Inter", system-ui, sans-serif';
    ctx.fillText(
      membresia.tipo_operacion === 'SOLO_INSCRIPCION' ? 'FECHA DE INSCRIPCIÓN' : 'FECHA DE INICIO',
      cardX + 76,
      boxY + 22
    );
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 19px "Inter", system-ui, sans-serif';
    ctx.fillText(formatDatePE(membresia.fecha_inicio), cardX + 76, boxY + 48);

    // Fecha de Finalización
    const box2X = cardX + 58 + boxW + 24;
    ctx.fillStyle = membresia.tipo_operacion === 'SOLO_INSCRIPCION' ? '#ecfdf5' : '#fff1f2';
    roundRect(ctx, box2X, boxY, boxW, 64, 10);
    ctx.fill();
    ctx.strokeStyle = membresia.tipo_operacion === 'SOLO_INSCRIPCION' ? '#a7f3d0' : '#fecdd3';
    ctx.stroke();

    ctx.fillStyle = membresia.tipo_operacion === 'SOLO_INSCRIPCION' ? '#047857' : '#be123c';
    ctx.font = '700 11px "Inter", system-ui, sans-serif';
    ctx.fillText(
      membresia.tipo_operacion === 'SOLO_INSCRIPCION' ? 'TIPO DE REGISTRO' : 'FECHA DE FINALIZACIÓN (VENCIMIENTO)',
      box2X + 18,
      boxY + 22
    );
    ctx.fillStyle = membresia.tipo_operacion === 'SOLO_INSCRIPCION' ? '#065f46' : '#881337';
    ctx.font = '800 18px "Inter", system-ui, sans-serif';
    ctx.fillText(
      membresia.tipo_operacion === 'SOLO_INSCRIPCION' ? 'PAGO ÚNICO • INSCRITO' : formatDatePE(membresia.fecha_fin),
      box2X + 18,
      boxY + 48
    );

    // Sección 3: Desglose Financiero (Total a Pagar, Monto Abonado hoy, Saldo Pendiente)
    y += 188;
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, cardX + 36, y, cardW - 72, 215, 16);
    ctx.fill();

    // Fila 1: Total a Pagar de la Membresía
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 15px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Total a Pagar (Membresía):', cardX + 64, y + 42);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 18px "Inter", system-ui, sans-serif';
    ctx.fillText(`${moneda} ${totalPagar.toFixed(2)}`, cardX + cardW - 64, y + 42);

    // Fila 2: Método de Pago
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 15px "Inter", system-ui, sans-serif';
    ctx.fillText('Método de Pago:', cardX + 64, y + 76);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 15px "Inter", system-ui, sans-serif';
    ctx.fillText(METODO_LABELS[detalleRecibo.metodo_pago] || detalleRecibo.metodo_pago, cardX + cardW - 64, y + 76);

    // Línea divisoria
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(cardX + 64, y + 98);
    ctx.lineTo(cardX + cardW - 64, y + 98);
    ctx.stroke();

    // Fila 3 Destacada: MONTO PAGADO EN ESTE RECIBO
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 18px "Inter", system-ui, sans-serif';
    ctx.fillText('MONTO ABONADO (ESTE RECIBO):', cardX + 64, y + 138);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4ade80';
    ctx.font = '800 28px "Inter", system-ui, sans-serif';
    ctx.fillText(`${moneda} ${montoAbonado.toFixed(2)}`, cardX + cardW - 64, y + 140);

    // Fila 4: Saldo Pendiente
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 15px "Inter", system-ui, sans-serif';
    ctx.fillText('Saldo Pendiente por Pagar:', cardX + 64, y + 184);
    ctx.textAlign = 'right';
    ctx.fillStyle = saldoPendiente > 0 ? '#fbbf24' : '#94a3b8';
    ctx.font = '800 18px "Inter", system-ui, sans-serif';
    ctx.fillText(`${moneda} ${saldoPendiente.toFixed(2)}`, cardX + cardW - 64, y + 184);

    // Observación y Pie de Comprobante
    y += 245;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#475569';
    ctx.font = '500 14px "Inter", system-ui, sans-serif';
    const obsText = detalleRecibo.observacion
      ? `Nota: ${detalleRecibo.observacion}`
      : '¡Gracias por entrenar con nosotros! Disciplina, honor y constancia.';
    ctx.fillText(obsText.slice(0, 85), W / 2, y);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 12px "Inter", system-ui, sans-serif';
    ctx.fillText(
      `Comprobante Digital • ${config.nombre_academia || 'Gimnasio'} • Recibo N° ${detalleRecibo.numero_recibo}`,
      W / 2,
      y + 30
    );
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function roundRectTop(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function descargarCanvasComoPNG(canvas, numeroRecibo, nombreAlumno) {
    if (!canvas) return;
    const link = document.createElement('a');
    const slug = (nombreAlumno || 'alumno')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.download = `Recibo-${numeroRecibo}-${slug}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function copiarCanvasAlPortapapeles(canvas) {
    if (!canvas || !navigator.clipboard || !window.ClipboardItem) {
      throw new Error('Tu navegador no soporta copiado directo de imagen.');
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('No se pudo generar la imagen.'));
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          resolve(true);
        } catch (err) {
          reject(err);
        }
      }, 'image/png');
    });
  }

  function limpiarTelefonoPE(tel) {
    if (!tel) return '';
    const digits = String(tel).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 9 && digits.startsWith('9')) {
      return `51${digits}`;
    }
    return digits;
  }

  function generarLinkWhatsAppRecibo(detalleRecibo, config) {
    const { alumno, membresia } = detalleRecibo;
    const tel = limpiarTelefonoPE(alumno.telefono_whatsapp || alumno.telefono_emergencia);
    const moneda = config.moneda || 'S/';
    const nombreCompleto = `${alumno.nombres} ${alumno.apellidos}`.trim();
    const saldo = Number(membresia.saldo_pendiente || 0);

    const horarioTexto = membresia.horario_texto || alumno.horario_texto || '';

    const desgloseInscripcion =
      membresia.incluye_inscripcion && Number(membresia.monto_inscripcion) > 0 && membresia.tipo_operacion !== 'SOLO_INSCRIPCION'
        ? `🎓 *Desglose:* Inscripción ${moneda} ${Number(membresia.monto_inscripcion).toFixed(2)} + Mensualidad ${moneda} ${Number(membresia.monto_mensualidad).toFixed(2)}`
        : null;

    const lineas = [
      `🥋 *${(config.nombre_academia || 'GIMNASIO ARTES MARCIALES').toUpperCase()}*`,
      `📄 *COMPROBANTE DE PAGO - RECIBO N° ${detalleRecibo.numero_recibo}*`,
      `--------------------------------`,
      `👤 *Alumno:* ${nombreCompleto}`,
      `🥊 *Concepto:* ${membresia.concepto}`,
      horarioTexto ? `🕒 *Horario / Turno:* ${horarioTexto}` : null,
      desgloseInscripcion,
      membresia.tipo_operacion === 'SOLO_INSCRIPCION'
        ? `📅 *Fecha de Inscripción:* ${formatDatePE(membresia.fecha_inicio)} (Pago Único)`
        : `📅 *Fecha de Inicio:* ${formatDatePE(membresia.fecha_inicio)}`,
      membresia.tipo_operacion === 'SOLO_INSCRIPCION'
        ? null
        : `🏁 *Fecha de Finalización:* ${formatDatePE(membresia.fecha_fin)}`,
      `--------------------------------`,
      `💰 *Total a Pagar:* ${moneda} ${Number(membresia.total_a_pagar).toFixed(2)}`,
      `✅ *Monto Abonado (Recibo #${detalleRecibo.numero_recibo}):* ${moneda} ${Number(detalleRecibo.monto_abonado).toFixed(2)} (${METODO_LABELS[detalleRecibo.metodo_pago] || detalleRecibo.metodo_pago})`,
      saldo > 0
        ? `⚠️ *Saldo Pendiente:* ${moneda} ${saldo.toFixed(2)}`
        : `🎉 *Estado:* PAGADO COMPLETO (Saldo ${moneda} 0.00)`,
      `--------------------------------`,
      `¡Gracias por entrenar con nosotros! 💪`
    ].filter(Boolean);

    const texto = encodeURIComponent(lineas.join('\n'));
    return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
  }

  function generarLinkWhatsAppRecordatorio(alumnoConEstado, config, tipo = 'VENCIMIENTO') {
    const tel = limpiarTelefonoPE(alumnoConEstado.telefono_whatsapp || alumnoConEstado.telefono_emergencia);
    const moneda = config.moneda || 'S/';
    const mem = alumnoConEstado.ultima_membresia;
    const academia = config.nombre_academia || 'la Academia';

    let mensaje = '';
    if (tipo === 'SALDO' && mem) {
      mensaje =
        `Hola *${alumnoConEstado.nombres}* 🥋, te saludamos de *${academia}*.\n\n` +
        `Te recordamos amablemente que tu membresía (*${mem.concepto}*) registra un saldo pendiente de *${moneda} ${Number(mem.saldo_pendiente).toFixed(2)}* (Total pactado: ${moneda} ${Number(mem.total_a_pagar).toFixed(2)}).\n\n` +
        `Puedes regularizarlo en recepción o vía Yape/Plin. ¡Muchas gracias! 💪`;
    } else if (mem) {
      const dias = alumnoConEstado.dias_restantes;
      const estadoStr =
        dias < 0
          ? `venció el *${formatDatePE(mem.fecha_fin)}*`
          : dias === 0
          ? `vence *HOY (${formatDatePE(mem.fecha_fin)})*`
          : `vence este *${formatDatePE(mem.fecha_fin)}* (en ${dias} días)`;

      mensaje =
        `Hola *${alumnoConEstado.nombres}* 🥋, te saludamos de *${academia}*.\n\n` +
        `Te informamos que tu membresía *${mem.concepto}* (del ${formatDatePE(mem.fecha_inicio)} al ${formatDatePE(mem.fecha_fin)}) ${estadoStr}.\n\n` +
        `¡Te esperamos para renovar tu matrícula y seguir entrenando fuerte! 🥊`;
    }

    const texto = encodeURIComponent(mensaje);
    return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
  }

  global.ReceiptGenerator = {
    dibujarReciboEnCanvas,
    descargarCanvasComoPNG,
    copiarCanvasAlPortapapeles,
    generarLinkWhatsAppRecibo,
    generarLinkWhatsAppRecordatorio,
    METODO_LABELS
  };
})(window);
