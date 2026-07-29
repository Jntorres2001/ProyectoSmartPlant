const PDFDocument = require('pdfkit');

/**
 * Genera el PDF del reporte de humedad y devuelve un Buffer.
 *
 * datos: {
 *   dispositivo: string,
 *   rango: string,                // ej. "01/07/2026 - 21/07/2026"
 *   lecturas: array de filas de `lecturas`
 * }
 * El gráfico de humedad se dibuja como vectores directamente en el PDF
 * (sin depender de una imagen rasterizada ni de librerías nativas).
 */
function dibujarGraficoVectorial(doc, lecturas) {
  const inicioX = doc.x;
  const inicioY = doc.y;
  const ancho = 500;
  const alto = 200;

  const valores = lecturas.map((l) => Number(l.humedad));

  // Líneas guía horizontales (0/25/50/75/100%)
  [0, 25, 50, 75, 100].forEach((pct) => {
    const y = inicioY + alto - (pct / 100) * alto;
    doc.moveTo(inicioX, y).lineTo(inicioX + ancho, y).strokeColor('#eef2ef').lineWidth(1).stroke();
    doc.fontSize(8).fillColor('#9aa79f').text(`${pct}%`, inicioX - 26, y - 4, { width: 22, align: 'right' });
  });

  // Línea de humedad
  const puntos = valores.map((valor, i) => {
    const x = inicioX + (valores.length > 1 ? (i / (valores.length - 1)) * ancho : ancho / 2);
    const y = inicioY + alto - (Math.min(Math.max(valor, 0), 100) / 100) * alto;
    return { x, y };
  });

  if (puntos.length > 1) {
    doc.moveTo(puntos[0].x, puntos[0].y);
    puntos.slice(1).forEach((p) => doc.lineTo(p.x, p.y));
    doc.strokeColor('#3aa05a').lineWidth(2).stroke();
  }
  puntos.forEach((p) => doc.circle(p.x, p.y, 1.8).fillColor('#3aa05a').fill());

  doc.y = inicioY + alto + 24;
  doc.x = inicioX;
}

function generarReportePdf({ dispositivo, rango, lecturas = [] }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ---- Encabezado ----
    doc
      .fillColor('#2f8a4c')
      .fontSize(22)
      .text('🌱 SmartPlant', { continued: false })
      .fillColor('#1f2d24')
      .fontSize(16)
      .text('Reporte de Humedad', { continued: false })
      .moveDown(0.3)
      .fillColor('#6b7d72')
      .fontSize(10)
      .text(`Dispositivo: ${dispositivo || 'N/D'}`)
      .text(`Período: ${rango || 'N/D'}`)
      .text(`Generado el: ${new Date().toLocaleString('es-ES')}`)
      .moveDown(1);

    // ---- Resumen estadístico ----
    const valores = lecturas.map((l) => Number(l.humedad)).filter((v) => !Number.isNaN(v));
    const promedio = valores.length ? (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1) : 'N/D';
    const minimo = valores.length ? Math.min(...valores).toFixed(1) : 'N/D';
    const maximo = valores.length ? Math.max(...valores).toFixed(1) : 'N/D';

    doc
      .fillColor('#1f2d24')
      .fontSize(13)
      .text('Resumen del período', { underline: true })
      .moveDown(0.5)
      .fontSize(11)
      .fillColor('#333')
      .text(`Lecturas registradas: ${lecturas.length}`)
      .text(`Humedad promedio: ${promedio}%`)
      .text(`Humedad mínima: ${minimo}%`)
      .text(`Humedad máxima: ${maximo}%`)
      .moveDown(1);

    // ---- Gráfico ----
    if (lecturas.length > 0) {
      doc.fontSize(13).fillColor('#1f2d24').text('Gráfico de humedad', { underline: true }).moveDown(0.5);
      dibujarGraficoVectorial(doc, lecturas);
    }

    // ---- Tabla de lecturas (últimas 40 para no alargar demasiado el PDF) ----
    doc.addPage();
    doc.fontSize(13).fillColor('#1f2d24').text('Detalle de lecturas', { underline: true }).moveDown(0.5);

    const filas = lecturas.slice(0, 40);
    doc.fontSize(9).fillColor('#555');
    filas.forEach((l) => {
      const fecha = new Date(l.creado_en).toLocaleString('es-ES');
      doc.text(`${fecha}   •   Humedad: ${l.humedad}%   •   Estado: ${l.estado_planta || 'N/D'}`);
    });

    if (lecturas.length > filas.length) {
      doc.moveDown(0.5).fillColor('#9aa79f').text(`… y ${lecturas.length - filas.length} lecturas más.`);
    }

    doc.end();
  });
}

module.exports = { generarReportePdf };
