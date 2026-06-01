import { formatDate, formatImporte } from './format.js';

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

const CUADRE_PRINT_PAGE_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 1.25rem;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 15.4px;
    color: #111;
    background: #fff;
  }
  .cuadre-print-sheet {
    max-width: 600px;
    margin: 0 auto;
  }
  .cuadre-print-sheet h2 {
    font-size: 1.265rem;
    font-weight: 700;
    text-align: center;
    margin: 0 0 1rem;
  }
  .cuadre-print-table {
    width: 100%;
    border-collapse: collapse;
  }
  .cuadre-print-table th,
  .cuadre-print-table td {
    border: none;
    padding: 0.55rem 0.7rem;
    vertical-align: top;
  }
  .cuadre-print-table th {
    width: 42%;
    text-align: left;
    font-weight: 600;
    background: transparent;
  }
  .cuadre-print-table td {
    text-align: right;
  }
  .cuadre-print-table td.cuadre-print-text-left {
    text-align: left;
  }
  @media print {
    body { padding: 0.5rem; }
  }
`;

export function buildCuadrePrintHtml(data) {
  const obs = data.observaciones ? escapeHtml(data.observaciones) : '—';
  return `
    <div class="cuadre-print-sheet">
      <h2>PROXY — Cuadre del día</h2>
      <table class="cuadre-print-table">
        <tr>
          <th>Nombre empleado</th>
          <td class="cuadre-print-text-left">${escapeHtml(data.empleadoNombre)}</td>
        </tr>
        <tr>
          <th>Fecha</th>
          <td>${escapeHtml(formatDate(data.fecha))}</td>
        </tr>
        <tr>
          <th>Hora</th>
          <td>${escapeHtml(data.hora)}</td>
        </tr>
        <tr>
          <th>Observaciones</th>
          <td class="cuadre-print-text-left">${obs}</td>
        </tr>
        <tr>
          <th>Importe a cuadrar</th>
          <td>${escapeHtml(formatImporte(data.importe))}</td>
        </tr>
        <tr>
          <th>Efectivo</th>
          <td>${escapeHtml(formatImporte(data.efectivo))}</td>
        </tr>
        <tr>
          <th>Diferencia</th>
          <td>${escapeHtml(formatImporte(data.diferencia))}</td>
        </tr>
      </table>
    </div>`;
}

export function buildCuadrePrintDocument(data, autoPrint = false) {
  const printScript = autoPrint
    ? `<script>window.addEventListener('load',function(){window.focus();window.print();});<\/script>`
    : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Cuadre del día — PROXY</title>
  <style>${CUADRE_PRINT_PAGE_STYLES}</style>
</head>
<body>
  ${buildCuadrePrintHtml(data)}
  ${printScript}
</body>
</html>`;
}

export function openCuadrePrintTab(data, autoPrint = true) {
  const html = buildCuadrePrintDocument(data, autoPrint);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 120000);
  return true;
}

export function buildPrintDataFromArchivoCuadre(c) {
  return {
    empleadoNombre: c.empleado_nombre || 'Sin asignar',
    fecha: c.fecha,
    hora: '—',
    observaciones: c.observaciones || '',
    importe: Number(c.importe ?? 0),
    efectivo: Number(c.efectivo ?? 0),
    diferencia: Number(c.diferencia ?? 0),
  };
}
