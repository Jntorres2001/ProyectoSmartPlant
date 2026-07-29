/**
 * Genera un gráfico de línea de humedad como SVG puro (sin dependencias
 * nativas tipo `canvas`/Cairo). Esto evita problemas de compilación en
 * cualquier sistema operativo: el archivo resultante es texto plano.
 *
 * Devuelve un string SVG listo para:
 *  - adjuntarse al correo como archivo "grafico_humedad.svg"
 *  - o convertirse a Buffer con Buffer.from(svg, 'utf-8')
 */
const ANCHO = 800;
const ALTO = 400;
const PADDING = { top: 50, right: 30, bottom: 60, left: 50 };

function generarGraficoHumedadSvg(lecturas = []) {
  const anchoUtil = ANCHO - PADDING.left - PADDING.right;
  const altoUtil = ALTO - PADDING.top - PADDING.bottom;

  const valores = lecturas.map((l) => Number(l.humedad));
  const puntos = valores.map((valor, i) => {
    const x = PADDING.left + (lecturas.length > 1 ? (i / (lecturas.length - 1)) * anchoUtil : anchoUtil / 2);
    const y = PADDING.top + altoUtil - (Math.min(Math.max(valor, 0), 100) / 100) * altoUtil;
    return { x, y, valor };
  });

  const lineaPath = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = puntos.length
    ? `${lineaPath} L ${puntos[puntos.length - 1].x.toFixed(1)} ${(PADDING.top + altoUtil).toFixed(1)} L ${puntos[0].x.toFixed(1)} ${(PADDING.top + altoUtil).toFixed(1)} Z`
    : '';

  // Líneas de referencia horizontales cada 25%
  const lineasGuia = [0, 25, 50, 75, 100]
    .map((pct) => {
      const y = PADDING.top + altoUtil - (pct / 100) * altoUtil;
      return `
        <line x1="${PADDING.left}" y1="${y}" x2="${ANCHO - PADDING.right}" y2="${y}" stroke="#eef2ef" stroke-width="1" />
        <text x="${PADDING.left - 10}" y="${y + 4}" font-size="11" fill="#9aa79f" text-anchor="end">${pct}%</text>`;
    })
    .join('');

  // Etiquetas del eje X (máximo 6 para no saturar)
  const paso = Math.max(1, Math.ceil(lecturas.length / 6));
  const etiquetasX = lecturas
    .map((l, i) => ({ i, fecha: new Date(l.creado_en) }))
    .filter((_, i) => i % paso === 0)
    .map(({ i, fecha }) => {
      const x = puntos[i]?.x ?? 0;
      const texto = fecha.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `<text x="${x.toFixed(1)}" y="${ALTO - PADDING.bottom + 20}" font-size="10" fill="#6b7d72" text-anchor="middle">${texto}</text>`;
    })
    .join('');

  const puntosCirculo = puntos
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#3aa05a" />`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <rect x="0" y="0" width="${ANCHO}" height="${ALTO}" fill="#ffffff" />
  <text x="${ANCHO / 2}" y="28" font-size="18" font-weight="700" fill="#1f2d24" text-anchor="middle">
    Histórico de Humedad - SmartPlant
  </text>
  ${lineasGuia}
  <path d="${areaPath}" fill="rgba(58,160,90,0.15)" stroke="none" />
  <path d="${lineaPath}" fill="none" stroke="#3aa05a" stroke-width="2.5" />
  ${puntosCirculo}
  ${etiquetasX}
  <line x1="${PADDING.left}" y1="${PADDING.top}" x2="${PADDING.left}" y2="${ALTO - PADDING.bottom}" stroke="#d7ded9" stroke-width="1" />
  <line x1="${PADDING.left}" y1="${ALTO - PADDING.bottom}" x2="${ANCHO - PADDING.right}" y2="${ALTO - PADDING.bottom}" stroke="#d7ded9" stroke-width="1" />
</svg>`;
}

module.exports = { generarGraficoHumedadSvg };
