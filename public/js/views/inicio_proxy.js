import * as api from '../api.js';
import { updateAppShell, bindLogout } from '../components/layout.js';
import { toastError } from '../alerts.js';
import { formatDate, formatImporte } from '../format.js';
import {
  renderObjetivoLogroBarChart,
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

function getFilteredOrdenesByCategoria(ordenes, categoriaFiltro) {
  if (!categoriaFiltro) return ordenes;
  const cat = normalizeCategoria(categoriaFiltro);
  return ordenes.filter((o) => normalizeCategoria(o.descategoria) === cat);
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

function normalizeEmpleadoKey(codigo) {
  return codigo != null && codigo !== '' ? String(codigo) : 'sin';
}

function aggregatePorEmpleado(ordenes) {
  const empleadosMap = new Map();

  for (const o of ordenes) {
    const key = normalizeEmpleadoKey(o.codigo);
    if (!empleadosMap.has(key)) {
      empleadosMap.set(key, {
        key,
        codigo: o.codigo,
        empleado_nombre: o.empleado_nombre || 'Sin asignar',
        importe: 0,
      });
    }
    empleadosMap.get(key).importe += Number(o.importe ?? 0);
  }

  return [...empleadosMap.values()].sort((a, b) => b.importe - a.importe);
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
  const MESES_LABEL = [
    '',
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  let dashboardData = {
    ordenes: [],
    importe_por_fecha: [],
    importe_por_categoria: [],
    importe_por_empleado: [],
    objetivos_mes: [],
    mes_objetivo: null,
    anio_objetivo: null,
    total: 0,
  };
  let empleados = [];
  let selectedCategoria = null;
  let selectedEmpleadoKey = null;

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
          <div class="card border shadow-sm dashboard-categoria-report-card mt-3 dashboard-empleado-report-card">
            <div class="card-header card-header-app py-2">
              <h2 class="h6 mb-0"><i class="fa-solid fa-users me-2"></i>Reporte por empleado</h2>
            </div>
            <div class="card-body py-2">
              <div class="row g-2 align-items-end mb-2 dashboard-reporte-toolbar">
                <div class="col-sm-7">
                  <label class="form-label" for="filtroCategoriaReporte">Categoría</label>
                  <select class="form-select form-select-sm" id="filtroCategoriaReporte">
                    <option value="">Todas las categorías</option>
                  </select>
                </div>
                <div class="col-sm-5 text-sm-end">
                  <label class="form-label" for="dashboardTotalEmpleadoReporte">Total reporte</label>
                  <h3 class="mb-0 text-danger" id="dashboardTotalEmpleadoReporte">Q 0.00</h3>
                </div>
              </div>
              <div class="table-responsive eventos-list-wrap">
                <table class="table table-sm table-hover small mb-0 dashboard-empleado-table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th class="text-end">Importe</th>
                    </tr>
                  </thead>
                  <tbody id="empleadoTableBody">
                    <tr><td colspan="2" class="text-center text-muted">Cargando...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm mb-3 dashboard-chart-card">
            <div class="card-header card-header-app py-2 d-flex justify-content-between align-items-center gap-2">
              <h2 class="h6 mb-0"><i class="fa-solid fa-bullseye me-2"></i>Objetivos del mes</h2>
              <span class="small text-muted" id="objetivosMesLabel"></span>
            </div>
            <div class="card-body py-2">
              <div class="table-responsive dashboard-objetivos-table-wrap">
                <table class="table table-sm table-hover small mb-0">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th class="text-end">Objetivo</th>
                      <th class="text-end">Importe</th>
                      <th class="text-end">Logrado</th>
                      <th class="text-end">% logrado</th>
                    </tr>
                  </thead>
                  <tbody id="objetivosMesTableBody">
                    <tr><td colspan="5" class="text-center text-muted">Cargando...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="card border-0 shadow-sm mb-3 dashboard-chart-card dashboard-chart-card-sm">
            <div class="card-header card-header-app py-2">
              <h2 class="h6 mb-0"><i class="fa-solid fa-chart-bar me-2"></i>Logro de objetivo por empleado</h2>
            </div>
            <div class="card-body py-2">
              <div class="dashboard-objetivo-logro-chart-wrap">
                <canvas id="objetivoLogroChart" aria-label="Gráfica de logro de objetivo por empleado"></canvas>
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
  const empleadoTableBody = document.getElementById('empleadoTableBody');
  const objetivosMesTableBody = document.getElementById('objetivosMesTableBody');
  const objetivosMesLabel = document.getElementById('objetivosMesLabel');
  const totalFechasEl = document.getElementById('dashboardTotalFechas');
  const totalReporteEl = document.getElementById('dashboardTotalImporte');
  const totalEmpleadoReporteEl = document.getElementById('dashboardTotalEmpleadoReporte');
  const filtroEmpleado = document.getElementById('filtroEmpleado');
  const filtroCategoriaReporte = document.getElementById('filtroCategoriaReporte');
  const tableColSpan = 2;

  function formatPorcentaje(value) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const n = Number(value);
    return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
  }

  function renderObjetivosMesTable() {
    const mes = dashboardData.mes_objetivo;
    const anio = dashboardData.anio_objetivo;
    if (mes && anio) {
      objetivosMesLabel.textContent = `${MESES_LABEL[mes] || mes} ${anio}`;
    } else {
      objetivosMesLabel.textContent = '';
    }

    const rows = dashboardData.objetivos_mes || [];
    if (!rows.length) {
      objetivosMesTableBody.innerHTML =
        '<tr><td colspan="5" class="text-center text-muted">Sin empleados activos.</td></tr>';
      return;
    }

    objetivosMesTableBody.innerHTML = rows
      .map((row) => {
        const pct = row.porcentaje;
        const pctClass =
          pct == null ? '' : pct >= 100 ? 'text-success fw-semibold' : 'text-danger fw-semibold';
        return `
        <tr>
          <td>${escapeHtml(row.empleado_nombre || '—')}</td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(row.objetivo))}</td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(row.importe))}</td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(row.logrado))}</td>
          <td class="text-end text-nowrap ${pctClass}">${escapeHtml(formatPorcentaje(pct))}</td>
        </tr>`;
      })
      .join('');
  }

  function updateTotalFechas() {
    totalFechasEl.textContent = formatImporte(dashboardData.total ?? 0);
  }

  function getEmpleadoFiltro() {
    return filtroEmpleado.value;
  }

  function getCategoriaFiltroReporte() {
    const value = filtroCategoriaReporte.value;
    return value ? decodeURIComponent(value) : '';
  }

  function getOrdenesFiltradas() {
    return getFilteredOrdenes(dashboardData.ordenes, getEmpleadoFiltro());
  }

  function getOrdenesFiltradasPorCategoria() {
    return getFilteredOrdenesByCategoria(dashboardData.ordenes, getCategoriaFiltroReporte());
  }

  function getOrdenesPorCategoria(descategoria) {
    const cat = normalizeCategoria(descategoria);
    return sortOrdenesDetalle(
      getOrdenesFiltradas().filter((o) => normalizeCategoria(o.descategoria) === cat)
    );
  }

  function renderDetalleOrdenesHtml(titulo, ordenes, subtotalLabel, vacioMsg) {
    if (!ordenes.length) {
      return `
        <tr class="dashboard-cat-detail">
          <td colspan="${tableColSpan}" class="text-center text-muted py-2">
            ${escapeHtml(vacioMsg)}
          </td>
        </tr>`;
    }

    const detalleTotal = calcTotal(ordenes);
    return `
      <tr class="dashboard-cat-detail">
        <td colspan="${tableColSpan}" class="p-0">
          <div class="dashboard-cat-detail-head px-2 py-1 small text-muted">
            <i class="fa-solid fa-list-ul me-1"></i>${escapeHtml(titulo)}
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
                  <th>Categoría</th>
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
                    <td>${escapeHtml(o.descategoria || '—')}</td>
                    <td>${escapeHtml(o.detalles || '—')}</td>
                    <td class="text-end text-nowrap">${escapeHtml(formatImporte(o.importe))}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
              <tfoot>
                <tr>
                  <th colspan="6" class="text-end">${escapeHtml(subtotalLabel)}</th>
                  <th class="text-end text-nowrap">${escapeHtml(formatImporte(detalleTotal))}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </td>
      </tr>`;
  }

  function getOrdenesPorEmpleado(empleadoKey) {
    return sortOrdenesDetalle(
      getOrdenesFiltradasPorCategoria().filter(
        (o) => normalizeEmpleadoKey(o.codigo) === empleadoKey
      )
    );
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
        rows.push(
          renderDetalleOrdenesHtml(
            group.descategoria,
            getOrdenesPorCategoria(group.descategoria),
            'Subtotal categoría',
            'No hay órdenes en esta categoría con los filtros actuales.'
          )
        );
      }
    }

    categoriaTableBody.innerHTML = rows.join('');
  }

  function renderEmpleadoTable() {
    const ordenes = getOrdenesFiltradasPorCategoria();
    const groups = aggregatePorEmpleado(ordenes);
    const total = calcTotal(ordenes);
    totalEmpleadoReporteEl.textContent = formatImporte(total);

    if (selectedEmpleadoKey && !groups.some((g) => g.key === selectedEmpleadoKey)) {
      selectedEmpleadoKey = null;
    }

    if (!dashboardData.ordenes.length) {
      empleadoTableBody.innerHTML =
        `<tr><td colspan="${tableColSpan}" class="text-center text-muted">No hay órdenes en el rango seleccionado.</td></tr>`;
      return;
    }

    if (!groups.length) {
      empleadoTableBody.innerHTML =
        `<tr><td colspan="${tableColSpan}" class="text-center text-muted">No hay órdenes para la categoría seleccionada.</td></tr>`;
      return;
    }

    const rows = [];
    for (const group of groups) {
      const isActive = selectedEmpleadoKey === group.key;
      rows.push(`
        <tr class="dashboard-emp-row${isActive ? ' table-active' : ''}"
          data-empleado-key="${encodeURIComponent(group.key)}"
          role="button" tabindex="0"
          aria-expanded="${isActive ? 'true' : 'false'}">
          <td>
            <i class="fa-solid fa-chevron-${isActive ? 'down' : 'right'} me-2 text-muted dashboard-cat-chevron"></i>
            ${escapeHtml(group.empleado_nombre)}
          </td>
          <td class="text-end text-nowrap">${escapeHtml(formatImporte(group.importe))}</td>
        </tr>`);
      if (isActive) {
        rows.push(
          renderDetalleOrdenesHtml(
            group.empleado_nombre,
            getOrdenesPorEmpleado(group.key),
            'Subtotal empleado',
            'No hay órdenes para este empleado con los filtros actuales.'
          )
        );
      }
    }

    empleadoTableBody.innerHTML = rows.join('');
  }

  function toggleCategoria(descategoria) {
    selectedCategoria = selectedCategoria === descategoria ? null : descategoria;
    renderCategoriaTable();
  }

  function toggleEmpleado(empleadoKey) {
    selectedEmpleadoKey = selectedEmpleadoKey === empleadoKey ? null : empleadoKey;
    renderEmpleadoTable();
  }

  function fillCategoriaSelect() {
    const current = filtroCategoriaReporte.value;
    const cats = new Set();
    for (const o of dashboardData.ordenes) {
      cats.add(normalizeCategoria(o.descategoria));
    }
    const sorted = [...cats].sort((a, b) => a.localeCompare(b, 'es'));
    filtroCategoriaReporte.innerHTML =
      `<option value="">Todas las categorías</option>` +
      sorted
        .map(
          (c) =>
            `<option value="${encodeURIComponent(c)}">${escapeHtml(c)}</option>`
        )
        .join('');
    if (current && [...filtroCategoriaReporte.options].some((o) => o.value === current)) {
      filtroCategoriaReporte.value = current;
    }
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
    const logroCanvas = document.getElementById('objetivoLogroChart');
    const empCanvas = document.getElementById('importePorEmpleadoChart');

    if (!desde || !hasta || desde > hasta) {
      destroyDashboardCharts();
      return;
    }

    try {
      const logroItems = (dashboardData.objetivos_mes || []).filter(
        (row) => Number(row.objetivo) > 0
      );
      const logroWrap = logroCanvas?.closest('.dashboard-objetivo-logro-chart-wrap');
      if (logroWrap) {
        logroWrap.style.height = `${Math.max(140, Math.max(logroItems.length, 1) * 32)}px`;
      }
      await renderObjetivoLogroBarChart(logroCanvas, dashboardData.objetivos_mes);

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
    fillCategoriaSelect();
    renderCategoriaTable();
    renderEmpleadoTable();
    renderObjetivosMesTable();
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
    selectedEmpleadoKey = null;
    categoriaTableBody.innerHTML =
      `<tr><td colspan="${tableColSpan}" class="text-center text-muted">Cargando...</td></tr>`;
    empleadoTableBody.innerHTML =
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
        objetivos_mes: [],
        mes_objetivo: null,
        anio_objetivo: null,
        total: 0,
      };
      categoriaTableBody.innerHTML =
        `<tr><td colspan="${tableColSpan}" class="text-center text-danger">Error al cargar datos</td></tr>`;
      empleadoTableBody.innerHTML =
        `<tr><td colspan="${tableColSpan}" class="text-center text-danger">Error al cargar datos</td></tr>`;
      objetivosMesTableBody.innerHTML =
        '<tr><td colspan="5" class="text-center text-danger">Error al cargar datos</td></tr>';
      objetivosMesLabel.textContent = '';
      totalFechasEl.textContent = formatImporte(0);
      totalReporteEl.textContent = formatImporte(0);
      totalEmpleadoReporteEl.textContent = formatImporte(0);
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

  filtroCategoriaReporte.addEventListener('change', () => {
    selectedEmpleadoKey = null;
    renderEmpleadoTable();
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

  empleadoTableBody.addEventListener('click', (e) => {
    const row = e.target.closest('.dashboard-emp-row');
    if (!row) return;
    toggleEmpleado(decodeURIComponent(row.dataset.empleadoKey || ''));
  });

  empleadoTableBody.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.dashboard-emp-row');
    if (!row) return;
    e.preventDefault();
    toggleEmpleado(decodeURIComponent(row.dataset.empleadoKey || ''));
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
