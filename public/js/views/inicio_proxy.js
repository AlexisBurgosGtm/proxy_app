import * as api from '../api.js';
import { updateAppShell, bindLogout } from '../components/layout.js';
import { toastError } from '../alerts.js';
import { formatDate, formatImporte } from '../format.js';
import {
  renderImporteLineChartFromOrdenes,
  renderCategoriaBarChart,
  renderEmpleadoBarChart,
  destroyDashboardCharts,
} from '../components/dashboard-chart.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayDate() {
  return toDateInput(new Date());
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function getFilteredOrdenes(ordenes, empleadoCodigo) {
  if (!empleadoCodigo) return ordenes;
  const cod = Number(empleadoCodigo);
  return ordenes.filter((o) => Number(o.codigo) === cod);
}

function aggregatePorCategoria(ordenes) {
  const categories = new Map();

  for (const o of ordenes) {
    const cat = o.descategoria || 'Sin categoría';
    categories.set(cat, (categories.get(cat) || 0) + Number(o.importe ?? 0));
  }

  return [...categories.entries()]
    .map(([descategoria, importe]) => ({ descategoria, importe }))
    .sort((a, b) => b.importe - a.importe);
}

function calcTotal(ordenes) {
  return ordenes.reduce((sum, o) => sum + Number(o.importe ?? 0), 0);
}

function normalizeCategoria(descategoria) {
  return descategoria || 'Sin categoría';
}

function sortOrdenesDetalle(ordenes) {
  return [...ordenes].sort((a, b) => {
    const fa = a.fecha || '';
    const fb = b.fecha || '';
    if (fa !== fb) return fa.localeCompare(fb);
    const ha = a.hora || '';
    const hb = b.hora || '';
    if (ha !== hb) return ha.localeCompare(hb);
    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });
}

export async function renderInicioProxy(root) {
  updateAppShell('inicio_proxy', 'Inicio');
  const today = todayDate();
  let dashboardData = {
    ordenes: [],
    importe_por_fecha: [],
    importe_por_categoria: [],
    importe_por_empleado: [],
    total: 0,
  };
  let empleados = [];
  let selectedCategoria = null;

  root.innerHTML = `
    <main class="container-fluid py-2">
      <div class="row g-3 dashboard-split">
        <div class="col-lg-6 dashboard-left-col">
          <form id="filtroDashboardForm" class="mb-2">
            <div class="row g-2 align-items-end">
              <div class="col-4">
                <label class="form-label" for="filtroDesde">Desde</label>
                <input type="date" class="form-control form-control-sm" id="filtroDesde" value="${today}" required>
              </div>
              <div class="col-4">
                <label class="form-label" for="filtroHasta">Hasta</label>
                <input type="date" class="form-control form-control-sm" id="filtroHasta" value="${today}" required>
              </div>
              <div class="col-4">
                <label class="form-label" for="dashboardTotalFechas">Total período</label>
                <h3 class="mb-0 text-danger" id="dashboardTotalFechas">Q 0.00</h3>
              </div>
            </div>
          </form>
          <div class="card border shadow-sm dashboard-categoria-report-card">
            <div class="card-header card-header-app py-2">
              <h2 class="h6 mb-0"><i class="fa-solid fa-tags me-2"></i>Reporte por categoría</h2>
            </div>
            <div class="card-body py-2">
              <div class="row g-2 align-items-end mb-2 dashboard-reporte-toolbar">
                <div class="col-sm-7">
                  <label class="form-label" for="filtroEmpleado">Empleado</label>
                  <select class="form-select form-select-sm" id="filtroEmpleado">
                    <option value="">Todos los empleados</option>
                  </select>
                </div>
                <div class="col-sm-5 text-sm-end">
                  <label class="form-label" for="dashboardTotalImporte">Total reporte</label>
                  <h3 class="mb-0 text-danger" id="dashboardTotalImporte">Q 0.00</h3>
                </div>
              </div>
              <div class="table-responsive eventos-list-wrap">
                <table class="table table-sm table-hover small mb-0 dashboard-categoria-table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th class="text-end">Importe</th>
                    </tr>
                  </thead>
                  <tbody id="categoriaTableBody">
                    <tr><td colspan="2" class="text-center text-muted">Cargando...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm mb-3 dashboard-chart-card">
            <div class="card-header card-header-app py-2">
              <h2 class="h6 mb-0"><i class="fa-solid fa-chart-line me-2"></i>Importe por fecha</h2>
            </div>
            <div class="card-body py-2">
              <div class="dashboard-importe-chart-wrap">
                <canvas id="importePorFechaChart" aria-label="Gráfica de importe por fecha"></canvas>
              </div>
            </div>
          </div>
          <div class="card border-0 shadow-sm mb-3 dashboard-chart-card dashboard-chart-card-sm">
            <div class="card-header card-header-app py-2">
              <h2 class="h6 mb-0"><i class="fa-solid fa-chart-bar me-2"></i>Importe por categoría</h2>
            </div>
            <div class="card-body py-2">
              <div class="dashboard-categoria-chart-wrap">
                <canvas id="importePorCategoriaChart" aria-label="Gráfica de importe por categoría"></canvas>
              </div>
            </div>
          </div>
          <div class="card border-0 shadow-sm dashboard-chart-card">
            <div class="card-header card-header-app py-2">
              <h2 class="h6 mb-0"><i class="fa-solid fa-users me-2"></i>Importe por empleado</h2>
            </div>
            <div class="card-body py-2">
              <div class="dashboard-empleado-chart-wrap">
                <canvas id="importePorEmpleadoChart" aria-label="Gráfica de importe por empleado"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  `;

  await bindLogout();

  const categoriaTableBody = document.getElementById('categoriaTableBody');
  const totalFechasEl = document.getElementById('dashboardTotalFechas');
  const totalReporteEl = document.getElementById('dashboardTotalImporte');
  const filtroEmpleado = document.getElementById('filtroEmpleado');
  const tableColSpan = 2;

  function updateTotalFechas() {
    totalFechasEl.textContent = formatImporte(dashboardData.total ?? 0);
  }

  function getEmpleadoFiltro() {
    return filtroEmpleado.value;
  }

  function getOrdenesFiltradas() {
    return getFilteredOrdenes(dashboardData.ordenes, getEmpleadoFiltro());
  }

  function getOrdenesPorCategoria(descategoria) {
    const cat = normalizeCategoria(descategoria);
    return sortOrdenesDetalle(
      getOrdenesFiltradas().filter((o) => normalizeCategoria(o.descategoria) === cat)
    );
  }

  function renderDetalleOrdenesHtml(descategoria, ordenes) {
    if (!ordenes.length) {
      return `
        <tr class="dashboard-cat-detail">
          <td colspan="${tableColSpan}" class="text-center text-muted py-2">
            No hay órdenes en esta categoría con los filtros actuales.
          </td>
        </tr>`;
    }

    const detalleTotal = calcTotal(ordenes);
    return `
      <tr class="dashboard-cat-detail">
        <td colspan="${tableColSpan}" class="p-0">
          <div class="dashboard-cat-detail-head px-2 py-1 small text-muted">
            <i class="fa-solid fa-list-ul me-1"></i>${escapeHtml(descategoria)}
            <span class="ms-1">(${ordenes.length} orden${ordenes.length === 1 ? '' : 'es'})</span>
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-hover small mb-0 dashboard-cat-detail-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Empleado</th>
                  <th>Producto</th>
                  <th>Detalles</th>
                  <th class="text-end">Importe</th>
                </tr>
              </thead>
              <tbody>
                ${ordenes
                  .map(
                    (o) => `
                  <tr>
                    <td class="text-nowrap">${escapeHtml(formatDate(o.fecha))}</td>
                    <td class="text-nowrap">${escapeHtml(o.hora || '—')}</td>
                    <td>${escapeHtml(o.empleado_nombre || '—')}</td>
                    <td>${escapeHtml(o.desprod || '—')}</td>
                    <td>${escapeHtml(o.detalles || '—')}</td>
                    <td class="text-end text-nowrap">${escapeHtml(formatImporte(o.importe))}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
              <tfoot>
                <tr>
                  <th colspan="5" class="text-end">Subtotal categoría</th>
                  <th class="text-end text-nowrap">${escapeHtml(formatImporte(detalleTotal))}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </td>
      </tr>`;
  }

  function renderCategoriaTable() {
    const ordenes = getOrdenesFiltradas();
    const groups = aggregatePorCategoria(ordenes);
    const total = calcTotal(ordenes);
    totalReporteEl.textContent = formatImporte(total);

    if (selectedCategoria && !groups.some((g) => g.descategoria === selectedCategoria)) {
      selectedCategoria = null;
    }

    if (!dashboardData.ordenes.length) {
      categoriaTableBody.innerHTML =
        `<tr><td colspan="${tableColSpan}" class="text-center text-muted">No hay órdenes en el rango seleccionado.</td></tr>`;
      return;
    }

    if (!groups.length) {
      categoriaTableBody.innerHTML =
        `<tr><td colspan="${tableColSpan}" class="text-center text-muted">No hay órdenes para el empleado seleccionado.</td></tr>`;
      return;
    }

    const rows = [];
    for (const group of groups) {
      const isActive = selectedCategoria === group.descategoria;
      rows.push(`
        <tr class="dashboard-cat-row${isActive ? ' table-active' : ''}"
          data-categoria="${encodeURIComponent(group.descategoria)}"
          role="button" tabindex="0"
          aria-expanded="${isActive ? 'true' : 'false'}">
          <td>
            <i class="fa-solid fa-chevron-${isActive ? 'down' : 'right'} me-2 text-muted dashboard-cat-chevron"></i>
            ${escapeHtml(group.descategoria)}
          </td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(group.importe))}</td>
        </tr>`);
      if (isActive) {
        rows.push(renderDetalleOrdenesHtml(group.descategoria, getOrdenesPorCategoria(group.descategoria)));
      }
    }

    categoriaTableBody.innerHTML = rows.join('');
  }

  function toggleCategoria(descategoria) {
    selectedCategoria = selectedCategoria === descategoria ? null : descategoria;
    renderCategoriaTable();
  }

  function fillEmpleadoSelect() {
    const current = filtroEmpleado.value;
    filtroEmpleado.innerHTML =
      `<option value="">Todos los empleados</option>` +
      empleados
        .map(
          (e) =>
            `<option value="${e.codigo}">${escapeHtml(e.nombre)}</option>`
        )
        .join('');
    if (current && [...filtroEmpleado.options].some((o) => o.value === current)) {
      filtroEmpleado.value = current;
    }
  }

  async function loadEmpleados() {
    try {
      empleados = await api.listEmpleados(true);
      fillEmpleadoSelect();
    } catch (err) {
      toastError(err.message);
    }
  }

  async function updateCharts() {
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    const lineCanvas = document.getElementById('importePorFechaChart');
    const catCanvas = document.getElementById('importePorCategoriaChart');
    const empCanvas = document.getElementById('importePorEmpleadoChart');

    if (!desde || !hasta || desde > hasta) {
      destroyDashboardCharts();
      return;
    }

    try {
      await renderImporteLineChartFromOrdenes(
        lineCanvas,
        dashboardData.importe_por_fecha,
        desde,
        hasta
      );

      const catCount = dashboardData.importe_por_categoria.length;
      const catWrap = catCanvas.closest('.dashboard-categoria-chart-wrap');
      if (catWrap) {
        catWrap.style.height = `${Math.max(140, catCount * 28)}px`;
      }
      await renderCategoriaBarChart(catCanvas, dashboardData.importe_por_categoria);

      const empCount = dashboardData.importe_por_empleado.length;
      const empWrap = empCanvas.closest('.dashboard-empleado-chart-wrap');
      if (empWrap) {
        empWrap.style.height = `${Math.max(160, empCount * 32)}px`;
      }
      await renderEmpleadoBarChart(empCanvas, dashboardData.importe_por_empleado);
    } catch (err) {
      destroyDashboardCharts();
      console.warn('No se pudieron renderizar las gráficas:', err);
    }
  }

  function refreshDashboardView() {
    updateTotalFechas();
    renderCategoriaTable();
    void updateCharts();
  }

  async function loadDashboard() {
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    if (!desde || !hasta) {
      toastError('Seleccione el rango de fechas.');
      return;
    }
    if (desde > hasta) {
      toastError('La fecha inicial no puede ser mayor que la final.');
      return;
    }

    selectedCategoria = null;
    categoriaTableBody.innerHTML =
      `<tr><td colspan="${tableColSpan}" class="text-center text-muted">Cargando...</td></tr>`;

    try {
      dashboardData = await api.getDashboardOrdenesResumen(desde, hasta);
      refreshDashboardView();
    } catch (err) {
      dashboardData = {
        ordenes: [],
        importe_por_fecha: [],
        importe_por_categoria: [],
        importe_por_empleado: [],
        total: 0,
      };
      categoriaTableBody.innerHTML =
        `<tr><td colspan="${tableColSpan}" class="text-center text-danger">Error al cargar datos</td></tr>`;
      totalFechasEl.textContent = formatImporte(0);
      totalReporteEl.textContent = formatImporte(0);
      destroyDashboardCharts();
      toastError(err.message);
    }
  }

  document.getElementById('filtroDashboardForm').addEventListener('submit', (e) => {
    e.preventDefault();
  });

  filtroEmpleado.addEventListener('change', () => {
    selectedCategoria = null;
    renderCategoriaTable();
  });

  categoriaTableBody.addEventListener('click', (e) => {
    const row = e.target.closest('.dashboard-cat-row');
    if (!row) return;
    toggleCategoria(decodeURIComponent(row.dataset.categoria || ''));
  });

  categoriaTableBody.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.dashboard-cat-row');
    if (!row) return;
    e.preventDefault();
    toggleCategoria(decodeURIComponent(row.dataset.categoria || ''));
  });

  function onFiltroFechaChange() {
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    if (!desde || !hasta) return;
    if (desde > hasta) return;
    loadDashboard();
  }

  document.getElementById('filtroDesde').addEventListener('change', onFiltroFechaChange);
  document.getElementById('filtroHasta').addEventListener('change', onFiltroFechaChange);

  await loadEmpleados();
  await loadDashboard();
}
