import * as api from '../api.js';
import { updateAppShell, bindLogout } from '../components/layout.js';
import { toastError, toastSuccess } from '../alerts.js';
import { formatDate, formatImporte } from '../format.js';
import { statusBadge, renderTicketDetailHtml, bindPhotoZoom } from '../components/ticket-detail.js';
import { exportRowsToExcel } from '../export-excel.js';

const TIPO_TICKETS = 'TICKETS';
const TIPO_ORDENES = 'ORDENES';
const TIPO_CUADRES = 'CUADRES';

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateInput(start), end: toDateInput(end) };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function statusLabel(status) {
  return status === 'FINALIZADO' ? 'Finalizado' : 'Pendiente';
}

function matchesTicketSearch(ticket, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    ticket.fecha_inicio,
    ticket.fecha_fin,
    ticket.empleado_nombre,
    ticket.cliente_empresa,
    ticket.cliente_nombre,
    ticket.reporte_cliente,
    ticket.status,
    ticket.totalprecio,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return haystack.includes(q);
}

function matchesOrdenSearch(orden, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    orden.fecha,
    orden.hora,
    orden.empleado_nombre,
    orden.desprod,
    orden.descategoria,
    orden.importe,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return haystack.includes(q);
}

function matchesCuadreSearch(cuadre, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    cuadre.fecha,
    cuadre.empleado_nombre,
    cuadre.importe,
    cuadre.efectivo,
    cuadre.documentos,
    cuadre.diferencia,
    cuadre.observaciones,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return haystack.includes(q);
}

const TICKET_HEADERS = [
  { key: 'inicio', label: 'Inicio' },
  { key: 'fin', label: 'Fin' },
  { key: 'empleado', label: 'Empleado' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'reporte', label: 'Reporte cliente' },
  { key: 'importe', label: 'Importe', align: 'end' },
  { key: 'status', label: 'Status' },
  { key: 'acciones', label: 'Acciones', align: 'end' },
];

const ORDEN_HEADERS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'hora', label: 'Hora' },
  { key: 'empleado', label: 'Empleado' },
  { key: 'producto', label: 'Producto' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'importe', label: 'Importe', align: 'end' },
];

const CUADRE_HEADERS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'empleado', label: 'Empleado' },
  { key: 'importe', label: 'Importe', align: 'end' },
  { key: 'efectivo', label: 'Efectivo', align: 'end' },
  { key: 'documentos', label: 'Documentos', align: 'end' },
  { key: 'diferencia', label: 'Diferencia', align: 'end' },
  { key: 'observaciones', label: 'Observaciones' },
];

export async function renderArchivo(root) {
  updateAppShell('archivo', 'Archivo');
  const { start, end } = monthRange();
  let tipoTransaccion = TIPO_TICKETS;
  let tickets = [];
  let ordenes = [];
  let cuadres = [];
  let searchQuery = '';
  let detailModal = null;

  root.innerHTML = `
    <main class="container-fluid py-2 cotizaciones-page">
      <div class="card border-0 shadow-sm">
        <div class="card-header card-header-app py-2">
          <h2 class="h6 mb-0"><i class="fa-solid fa-box-archive me-2"></i>Archivo</h2>
        </div>
        <div class="card-body py-2">
          <div id="filtroArchivo" class="mb-2">
            <div class="row g-2 align-items-end">
              <div class="col-md-3">
                <label class="form-label" for="archivoTipoTransaccion">Tipo de transacción</label>
                <select class="form-select form-select-sm" id="archivoTipoTransaccion">
                  <option value="${TIPO_TICKETS}">TICKETS</option>
                  <option value="${TIPO_ORDENES}">ORDENES</option>
                  <option value="${TIPO_CUADRES}">CUADRES</option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="archivoDesde">Desde</label>
                <input type="date" class="form-control form-control-sm" id="archivoDesde" value="${start}" required>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="archivoHasta">Hasta</label>
                <input type="date" class="form-control form-control-sm" id="archivoHasta" value="${end}" required>
              </div>
              <div class="col-md-3">
                <h3 class="mb-1 text-danger text-end" id="archivoTotalImporte">Q 0.00</h3>
                <button type="button" class="btn btn-success btn-sm w-100" id="btnArchivoExportar">
                  <i class="fa-solid fa-file-excel me-1"></i>Exportar Excel
                </button>
              </div>
            </div>
            <div class="row g-2 mt-2">
              <div class="col-12">
                <label class="form-label visually-hidden" for="archivoSearch">Buscar en la tabla</label>
                <input type="search" class="form-control form-control-sm" id="archivoSearch"
                  placeholder="Buscar en la tabla…" autocomplete="off">
              </div>
            </div>
          </div>
          <div class="table-responsive cotizaciones-list-wrap">
            <table class="table table-sm table-hover small mb-0">
              <thead id="archivoTableHead"></thead>
              <tbody id="archivoTableBody">
                <tr><td colspan="8" class="text-center text-muted">Cargando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
    <div class="modal fade" id="archivoTicketModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-scrollable modal-lg">
        <div class="modal-content small">
          <div class="modal-header modal-header-app py-2">
            <h5 class="modal-title" id="archivoTicketModalLabel">Detalle del ticket</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body py-2" id="archivoTicketModalBody"></div>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  await bindLogout();

  detailModal = new bootstrap.Modal(document.getElementById('archivoTicketModal'));
  const tableHead = document.getElementById('archivoTableHead');
  const tableBody = document.getElementById('archivoTableBody');

  function isTickets() {
    return tipoTransaccion === TIPO_TICKETS;
  }

  function isOrdenes() {
    return tipoTransaccion === TIPO_ORDENES;
  }

  function isCuadres() {
    return tipoTransaccion === TIPO_CUADRES;
  }

  function getHeaders() {
    if (isTickets()) return TICKET_HEADERS;
    if (isOrdenes()) return ORDEN_HEADERS;
    return CUADRE_HEADERS;
  }

  function getEmptyLabel() {
    if (isTickets()) return 'tickets';
    if (isOrdenes()) return 'órdenes';
    return 'cuadres';
  }

  function tableColSpan() {
    return getHeaders().length;
  }

  function renderTableHead() {
    const headers = getHeaders();
    tableHead.innerHTML = `
      <tr>
        ${headers
          .map(
            (h) =>
              `<th${h.align === 'end' ? ' class="text-end"' : ''}>${escapeHtml(h.label)}</th>`
          )
          .join('')}
      </tr>`;
  }

  function openDetailModal(ticket) {
    document.getElementById('archivoTicketModalLabel').textContent = `Ticket #${ticket.id}`;
    const body = document.getElementById('archivoTicketModalBody');
    body.innerHTML = renderTicketDetailHtml(ticket);
    bindPhotoZoom(body);
    detailModal.show();
  }

  function getVisibleTickets() {
    return tickets.filter((t) => matchesTicketSearch(t, searchQuery));
  }

  function getVisibleOrdenes() {
    return ordenes.filter((o) => matchesOrdenSearch(o, searchQuery));
  }

  function getVisibleCuadres() {
    return cuadres.filter((c) => matchesCuadreSearch(c, searchQuery));
  }

  function getVisibleRows() {
    if (isTickets()) return getVisibleTickets();
    if (isOrdenes()) return getVisibleOrdenes();
    return getVisibleCuadres();
  }

  function getSourceRows() {
    if (isTickets()) return tickets;
    if (isOrdenes()) return ordenes;
    return cuadres;
  }

  function rowImporte(row) {
    if (isTickets()) {
      return row.totalprecio != null ? Number(row.totalprecio) : 0;
    }
    return Number(row.importe ?? 0);
  }

  function updateTotalImporte(visibleRows) {
    const total = visibleRows.reduce((sum, row) => sum + rowImporte(row), 0);
    document.getElementById('archivoTotalImporte').textContent = formatImporte(total);
  }

  function bindRowActions() {
    document.querySelectorAll('.btn-archivo-ver').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        try {
          const ticket = await api.getTicket(id);
          openDetailModal(ticket);
        } catch (err) {
          toastError(err.message);
        }
      });
    });
  }

  function renderTicketsTable(visible) {
    tableBody.innerHTML = visible
      .map((t) => {
        const clienteLabel = t.cliente_empresa || t.cliente_nombre || '—';
        return `
        <tr>
          <td class="text-nowrap">${escapeHtml(formatDate(t.fecha_inicio))}</td>
          <td class="text-nowrap">${escapeHtml(formatDate(t.fecha_fin))}</td>
          <td>${escapeHtml(t.empleado_nombre || 'Sin asignar')}</td>
          <td>${escapeHtml(clienteLabel)}</td>
          <td>${escapeHtml(t.reporte_cliente || '—')}</td>
          <td class="text-end text-nowrap">${
            t.totalprecio != null ? escapeHtml(formatImporte(t.totalprecio)) : '—'
          }</td>
          <td>${statusBadge(t.status)}</td>
          <td class="text-end">
            <button type="button" class="btn btn-outline-primary btn-sm btn-archivo-ver" data-id="${t.id}" title="Ver detalle">
              <i class="fa-solid fa-eye"></i>
            </button>
          </td>
        </tr>`;
      })
      .join('');
    bindRowActions();
  }

  function renderOrdenesTable(visible) {
    tableBody.innerHTML = visible
      .map(
        (o) => `
        <tr>
          <td class="text-nowrap">${escapeHtml(formatDate(o.fecha))}</td>
          <td class="text-nowrap">${escapeHtml(o.hora || '—')}</td>
          <td>${escapeHtml(o.empleado_nombre || 'Sin asignar')}</td>
          <td>${escapeHtml(o.desprod || '—')}</td>
          <td>${escapeHtml(o.descategoria || '—')}</td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(o.importe))}</td>
        </tr>`
      )
      .join('');
  }

  function renderCuadresTable(visible) {
    tableBody.innerHTML = visible
      .map(
        (c) => `
        <tr>
          <td class="text-nowrap">${escapeHtml(formatDate(c.fecha))}</td>
          <td>${escapeHtml(c.empleado_nombre || 'Sin asignar')}</td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(c.importe))}</td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(c.efectivo))}</td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(c.documentos))}</td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(c.diferencia))}</td>
          <td>${escapeHtml(c.observaciones || '—')}</td>
        </tr>`
      )
      .join('');
  }

  function renderTable() {
    const colSpan = tableColSpan();
    const emptyLabel = getEmptyLabel();
    const visible = getVisibleRows();
    const source = getSourceRows();

    updateTotalImporte(visible);

    if (!source.length) {
      tableBody.innerHTML =
        `<tr><td colspan="${colSpan}" class="text-center text-muted">No hay ${emptyLabel} en el rango seleccionado.</td></tr>`;
      return;
    }

    if (!visible.length) {
      tableBody.innerHTML =
        `<tr><td colspan="${colSpan}" class="text-center text-muted">No hay ${emptyLabel} con ese criterio de búsqueda.</td></tr>`;
      return;
    }

    if (isTickets()) {
      renderTicketsTable(visible);
    } else if (isOrdenes()) {
      renderOrdenesTable(visible);
    } else {
      renderCuadresTable(visible);
    }
  }

  async function exportToExcel() {
    const desde = document.getElementById('archivoDesde').value;
    const hasta = document.getElementById('archivoHasta').value;

    if (isTickets()) {
      const visible = getVisibleTickets();
      if (!visible.length) {
        toastError('No hay datos para exportar con el filtro actual.');
        return;
      }

      const rows = [
        ['Inicio', 'Fin', 'Empleado', 'Cliente', 'Reporte cliente', 'Importe', 'Status'],
        ...visible.map((t) => [
          formatDate(t.fecha_inicio),
          formatDate(t.fecha_fin),
          t.empleado_nombre || 'Sin asignar',
          t.cliente_empresa || t.cliente_nombre || '',
          t.reporte_cliente || '',
          t.totalprecio != null ? Number(t.totalprecio) : '',
          statusLabel(t.status),
        ]),
      ];

      try {
        await exportRowsToExcel(rows, 'Tickets', `archivo-tickets_${desde}_${hasta}.xlsx`);
        toastSuccess('Archivo Excel generado');
      } catch (err) {
        toastError(err.message || 'No se pudo exportar a Excel.');
      }
      return;
    }

    if (isOrdenes()) {
      const visible = getVisibleOrdenes();
      if (!visible.length) {
        toastError('No hay datos para exportar con el filtro actual.');
        return;
      }

      const rows = [
        ['Fecha', 'Hora', 'Empleado', 'Producto', 'Categoría', 'Importe'],
        ...visible.map((o) => [
          formatDate(o.fecha),
          o.hora || '',
          o.empleado_nombre || 'Sin asignar',
          o.desprod || '',
          o.descategoria || '',
          Number(o.importe ?? 0),
        ]),
      ];

      try {
        await exportRowsToExcel(rows, 'Ordenes', `archivo-ordenes_${desde}_${hasta}.xlsx`);
        toastSuccess('Archivo Excel generado');
      } catch (err) {
        toastError(err.message || 'No se pudo exportar a Excel.');
      }
      return;
    }

    const visible = getVisibleCuadres();
    if (!visible.length) {
      toastError('No hay datos para exportar con el filtro actual.');
      return;
    }

    const rows = [
      ['Fecha', 'Empleado', 'Importe', 'Efectivo', 'Documentos', 'Diferencia', 'Observaciones'],
      ...visible.map((c) => [
        formatDate(c.fecha),
        c.empleado_nombre || 'Sin asignar',
        Number(c.importe ?? 0),
        Number(c.efectivo ?? 0),
        Number(c.documentos ?? 0),
        Number(c.diferencia ?? 0),
        c.observaciones || '',
      ]),
    ];

    try {
      await exportRowsToExcel(rows, 'Cuadres', `archivo-cuadres_${desde}_${hasta}.xlsx`);
      toastSuccess('Archivo Excel generado');
    } catch (err) {
      toastError(err.message || 'No se pudo exportar a Excel.');
    }
  }

  async function loadList() {
    const desde = document.getElementById('archivoDesde').value;
    const hasta = document.getElementById('archivoHasta').value;
    if (!desde || !hasta) return;
    if (desde > hasta) {
      toastError('La fecha inicial no puede ser mayor que la final.');
      return;
    }

    const colSpan = tableColSpan();
    tableBody.innerHTML =
      `<tr><td colspan="${colSpan}" class="text-center text-muted">Cargando...</td></tr>`;

    try {
      searchQuery = document.getElementById('archivoSearch').value.trim();
      tickets = [];
      ordenes = [];
      cuadres = [];
      if (isTickets()) {
        tickets = await api.listTicketsArchivo(desde, hasta);
      } else if (isOrdenes()) {
        ordenes = await api.listOrdenesArchivo(desde, hasta);
      } else {
        cuadres = await api.listCuadresArchivo(desde, hasta);
      }
      renderTable();
    } catch (err) {
      tableBody.innerHTML =
        `<tr><td colspan="${colSpan}" class="text-center text-danger">Error al cargar</td></tr>`;
      document.getElementById('archivoTotalImporte').textContent = formatImporte(0);
      toastError(err.message);
    }
  }

  function onTipoChange() {
    tipoTransaccion = document.getElementById('archivoTipoTransaccion').value;
    renderTableHead();
    tickets = [];
    ordenes = [];
    cuadres = [];
    loadList();
  }

  function onDateFilterChange() {
    loadList();
  }

  renderTableHead();

  document.getElementById('archivoTipoTransaccion').addEventListener('change', onTipoChange);
  document.getElementById('archivoDesde').addEventListener('change', onDateFilterChange);
  document.getElementById('archivoHasta').addEventListener('change', onDateFilterChange);
  document.getElementById('archivoSearch').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderTable();
  });
  document.getElementById('btnArchivoExportar').addEventListener('click', exportToExcel);

  await loadList();
}
