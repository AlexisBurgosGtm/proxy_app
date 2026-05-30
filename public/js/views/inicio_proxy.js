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

  root.innerHTML = `
    <main class="container-fluid py-2">
      <div class="row g-3 dashboard-split">
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header card-header-app py-2">
              <h2 class="h6 mb-0"><i class="fa-solid fa-list me-2"></i>Órdenes</h2>
            </div>
            <div class="card-body py-2">
              <form id="filtroOrdenesForm" class="mb-2">
                <div class="row g-2 align-items-end">
                  <div class="col-6 col-md-6">
                    <label class="form-label" for="filtroDesde">Desde</label>
                    <input type="date" class="form-control form-control-sm" id="filtroDesde" value="${today}" required>
                  </div>
                  <div class="col-6 col-md-6">
                    <label class="form-label" for="filtroHasta">Hasta</label>
                    <input type="date" class="form-control form-control-sm" id="filtroHasta" value="${today}" required>
                  </div>
                </div>
                <div class="row mt-2">
                  <div class="col-12 text-end">
                    <h3 class="mb-0 text-danger" id="ordenesTotalImporte">Q 0.00</h3>
                  </div>
                </div>
              </form>
              <div class="table-responsive eventos-list-wrap">
                <table class="table table-sm table-hover small mb-0">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Hora</th>
                      <th>Empleado</th>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th>Detalles</th>
                      <th class="text-end">Importe</th>
                    </tr>
                  </thead>
                  <tbody id="ordenesListBody">
                    <tr><td colspan="7" class="text-center text-muted">Cargando...</td></tr>
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

  const ordenesListBody = document.getElementById('ordenesListBody');
  const totalEl = document.getElementById('ordenesTotalImporte');

  function renderOrdenesTable(ordenes) {
    totalEl.textContent = formatImporte(dashboardData.total);

    if (!ordenes.length) {
      ordenesListBody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">No hay órdenes en el rango seleccionado.</td></tr>';
      return;
    }

    ordenesListBody.innerHTML = ordenes
      .map(
        (o) => `
        <tr>
          <td class="text-nowrap">${escapeHtml(formatDate(o.fecha))}</td>
          <td class="text-nowrap">${escapeHtml(o.hora || '—')}</td>
          <td>${escapeHtml(o.empleado_nombre || '—')}</td>
          <td>${escapeHtml(o.desprod || '—')}</td>
          <td>${escapeHtml(o.descategoria || '—')}</td>
          <td>${escapeHtml(o.detalles || '—')}</td>
          <td class="text-end text-nowrap">${formatImporte(o.importe)}</td>
        </tr>`
      )
      .join('');
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

    ordenesListBody.innerHTML =
      '<tr><td colspan="7" class="text-center text-muted">Cargando...</td></tr>';

    try {
      dashboardData = await api.getDashboardOrdenesResumen(desde, hasta);
      renderOrdenesTable(dashboardData.ordenes);
      await updateCharts();
    } catch (err) {
      dashboardData = {
        ordenes: [],
        importe_por_fecha: [],
        importe_por_categoria: [],
        importe_por_empleado: [],
        total: 0,
      };
      ordenesListBody.innerHTML =
        '<tr><td colspan="7" class="text-center text-danger">Error al cargar órdenes</td></tr>';
      totalEl.textContent = formatImporte(0);
      destroyDashboardCharts();
      toastError(err.message);
    }
  }

  document.getElementById('filtroOrdenesForm').addEventListener('submit', (e) => {
    e.preventDefault();
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

  await loadDashboard();
}
