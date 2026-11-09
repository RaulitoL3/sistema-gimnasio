/**
 * EXPORTADOR A EXCEL (.XLS / .CSV) Y RESPALDO DE DATOS (.JSON)
 */
(function (global) {
  const { formatDatePE, formatDateTimePE, getLocalDateISO } = global.GymStore;
  const { METODO_LABELS } = global.ReceiptGenerator;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Exporta la tabla de Recibos y Cuadre de Caja a un archivo .xls nativo para Microsoft Excel
   */
  function exportarRecibosExcel(recibosDetallados, config) {
    const moneda = config.moneda || 'S/';
    const hoy = getLocalDateISO();
    const validos = recibosDetallados.filter((r) => !r.anulado);
    const totalIngresos = validos.reduce((acc, r) => acc + Number(r.monto_abonado || 0), 0);

    const filasHtml = recibosDetallados
      .map((r) => {
        const bgEstado = r.anulado ? '#fee2e2' : '#ffffff';
        return `
        <tr style="background-color:${bgEstado};">
          <td style="mso-number-format:'\\@'; font-weight:bold; text-align:center;">${escapeHtml(r.numero_recibo)}</td>
          <td>${escapeHtml(formatDateTimePE(r.fecha_pago))}</td>
          <td><b>${escapeHtml(r.alumno?.nombres)} ${escapeHtml(r.alumno?.apellidos)}</b></td>
          <td>${escapeHtml(r.membresia?.concepto)}</td>
          <td style="text-align:center;">${escapeHtml(formatDatePE(r.membresia?.fecha_inicio))}</td>
          <td style="text-align:center;">${
            r.membresia?.tipo_operacion === 'SOLO_INSCRIPCION'
              ? 'PAGO ÚNICO (ALTA)'
              : escapeHtml(formatDatePE(r.membresia?.fecha_fin))
          }</td>
          <td style="text-align:right;">${Number(r.membresia?.total_a_pagar || 0).toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:#15803d;">${Number(r.monto_abonado || 0).toFixed(2)}</td>
          <td style="text-align:right; color:${Number(r.membresia?.saldo_pendiente) > 0 ? '#b45309' : '#64748b'};">${Number(r.membresia?.saldo_pendiente || 0).toFixed(2)}</td>
          <td style="text-align:center;">${escapeHtml(METODO_LABELS[r.metodo_pago] || r.metodo_pago)}</td>
          <td style="text-align:center;">${r.anulado ? 'ANULADO' : 'VÁLIDO'}</td>
          <td>${escapeHtml(r.observacion || '')}</td>
        </tr>`;
      })
      .join('');

    const htmlExcel = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
      </head>
      <body>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:Calibri, Arial, sans-serif; font-size:11pt;">
          <thead>
            <tr style="background-color:#111827; color:#ffffff; font-size:13pt; font-weight:bold;">
              <th colspan="12" style="padding:10px; text-align:left;">
                ${escapeHtml(config.nombre_academia || 'GIMNASIO ARTES MARCIALES')} - REPORTE DE RECIBOS Y CAJA (${hoy})
              </th>
            </tr>
            <tr style="background-color:#dc2626; color:#ffffff; font-weight:bold;">
              <th>N° Recibo</th>
              <th>Fecha y Hora Pago</th>
              <th>Nombres y Apellidos</th>
              <th>Plan / Concepto</th>
              <th>Fecha de Inicio</th>
              <th>Fecha de Finalización</th>
              <th>Total a Pagar (${escapeHtml(moneda)})</th>
              <th>Monto Abonado (${escapeHtml(moneda)})</th>
              <th>Saldo Pendiente (${escapeHtml(moneda)})</th>
              <th>Método de Pago</th>
              <th>Estado Recibo</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
          <tfoot>
            <tr style="background-color:#f1f5f9; font-weight:bold; font-size:12pt;">
              <td colspan="7" style="text-align:right;">TOTAL RECAUDADO (RECIBOS VÁLIDOS):</td>
              <td style="text-align:right; color:#15803d;">${escapeHtml(moneda)} ${totalIngresos.toFixed(2)}</td>
              <td colspan="4"></td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    descargarBlob(htmlExcel, `Reporte_Recibos_Caja_${hoy}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  }

  /**
   * Exporta el Padrón de Alumnos con sus Fechas de Inicio/Fin y Saldos Pendientes a Excel
   */
  function exportarAlumnosExcel(alumnosConEstado, config) {
    const moneda = config.moneda || 'S/';
    const hoy = getLocalDateISO();

    const filasHtml = alumnosConEstado
      .map((a) => {
        const mem = a.ultima_membresia;
        return `
        <tr>
          <td><b>${escapeHtml(a.nombres)}</b></td>
          <td><b>${escapeHtml(a.apellidos)}</b></td>
          <td style="mso-number-format:'\\@';">${escapeHtml(a.telefono_whatsapp || '')}</td>
          <td>${escapeHtml(a.grado_cinturon || '')}</td>
          <td style="text-align:center; font-weight:bold; color:${a.inscripcion_pagada !== false ? '#15803d' : '#b45309'};">${
            a.inscripcion_pagada !== false ? 'PAGADA' : 'PENDIENTE'
          }</td>
          <td>${escapeHtml(a.contacto_emergencia || '')} ${a.telefono_emergencia ? `(${escapeHtml(a.telefono_emergencia)})` : ''}</td>
          <td>${escapeHtml(mem?.concepto || (a.estado_vigencia === 'SOLO_INSCRITO' ? 'Solo Inscripción' : 'Sin membresía'))}</td>
          <td style="text-align:center;">${escapeHtml(mem ? formatDatePE(mem.fecha_inicio) : '—')}</td>
          <td style="text-align:center;">${escapeHtml(mem ? formatDatePE(mem.fecha_fin) : '—')}</td>
          <td style="text-align:center; font-weight:bold;">${escapeHtml(a.estado_vigencia)}</td>
          <td style="text-align:right;">${mem ? Number(mem.total_a_pagar || 0).toFixed(2) : '0.00'}</td>
          <td style="text-align:right; color:${a.saldo_total_pendiente > 0 ? '#b91c1c' : '#15803d'}; font-weight:bold;">
            ${Number(a.saldo_total_pendiente || 0).toFixed(2)}
          </td>
        </tr>`;
      })
      .join('');

    const htmlExcel = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:Calibri, Arial, sans-serif; font-size:11pt;">
          <thead>
            <tr style="background-color:#111827; color:#ffffff; font-size:13pt; font-weight:bold;">
              <th colspan="12" style="padding:10px; text-align:left;">
                ${escapeHtml(config.nombre_academia || 'GIMNASIO ARTES MARCIALES')} - PADRÓN DE ALUMNOS Y VIGENCIAS (${hoy})
              </th>
            </tr>
            <tr style="background-color:#1e293b; color:#ffffff; font-weight:bold;">
              <th>Nombres</th>
              <th>Apellidos</th>
              <th>WhatsApp</th>
              <th>Grado / Cinturón</th>
              <th>Inscripción</th>
              <th>Contacto Emergencia / Apoderado</th>
              <th>Plan Actual</th>
              <th>Fecha de Inicio</th>
              <th>Fecha de Finalización</th>
              <th>Estado Vigencia</th>
              <th>Total a Pagar (${escapeHtml(moneda)})</th>
              <th>Saldo Pendiente (${escapeHtml(moneda)})</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    descargarBlob(htmlExcel, `Padron_Alumnos_${hoy}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  }

  function exportarBackupJSON(state) {
    const hoy = getLocalDateISO();
    const json = JSON.stringify(state, null, 2);
    descargarBlob(json, `Respaldo_Gimnasio_${hoy}.json`, 'application/json;charset=utf-8');
  }

  function descargarBlob(contenido, nombreArchivo, mimeType) {
    const bom = '\uFEFF';
    const blob = new Blob([bom + contenido], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  global.ExcelExporter = {
    exportarRecibosExcel,
    exportarAlumnosExcel,
    exportarBackupJSON
  };
})(window);
