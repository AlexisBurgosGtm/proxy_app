import * as api from '../api.js';
import { updateAppShell, bindLogout } from '../components/layout.js';
import { getEmpleado, isSupervisor } from '../auth.js';
import { toastSuccess, toastError, toastWarning } from '../alerts.js';
import { formatImporte } from '../format.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function sanitizeDetalles(text, maxLen = 300) {
  let value = String(text ?? '').trim();
  value = value.replace(/\0/g, '');
  value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (value.length > maxLen) value = value.slice(0, maxLen);
  return value;
}

function sanitizeObservaciones(text) {
  return sanitizeDetalles(text, 500);
}

function parseAmount(value) {
  const num = Number(String(value ?? '').trim());
  return Number.isNaN(num) ? 0 : num;
}

function matchesOrdenSearch(orden, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [orden.desprod, orden.detalles, orden.hora, String(orden.importe)]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return haystack.includes(q);
}

function matchesProductoSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [item.descategoria, item.desprod, String(item.importe)]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return haystack.includes(q);
}

function mountCuadreOrdenesFab(onClick) {
  document.getElementById('btnFabCuadreOrdenes')?.remove();
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'btnFabCuadreOrdenes';
  fab.className = 'btn btn-primary fab-cuadre-ordenes';
  fab.setAttribute('aria-label', 'Ver órdenes del día');
  fab.innerHTML = '<i class="fa-solid fa-folder"></i>';
  fab.addEventListener('click', onClick);
  document.body.appendChild(fab);
  return fab;
}

function mountFinalizarDiaFab(onClick) {
  document.getElementById('btnFabFinalizarDia')?.remove();
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'btnFabFinalizarDia';
  fab.className = 'btn btn-primary fab-finalizar-dia d-none';
  fab.setAttribute('aria-label', 'Finalizar día');
  fab.innerHTML =
    '<i class="fa-solid fa-coins"></i><span>Finalizar Día</span>';
  fab.addEventListener('click', onClick);
  document.body.appendChild(fab);
  return fab;
}

export async function renderCuadre(root) {
  updateAppShell('cuadre', 'Cuadre');
  const today = toDateInput(new Date());
  const sessionEmpleado = getEmpleado();
  const supervisor = isSupervisor();

  root.innerHTML = `
    <main class="container-fluid py-2 pb-5">
      <div class="card shadow-sm mb-3">
        <div class="card-body py-3">
          <div class="row g-2 align-items-end">
            <div class="col-12 col-md-4">
              <label class="form-label mb-1" for="cuadreEmpleado">Empleado</label>
              <select class="form-select form-select-sm" id="cuadreEmpleado" required>
                <option value="">Seleccione empleado...</option>
              </select>
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label mb-1" for="cuadreFecha">Fecha</label>
              <input type="date" class="form-control form-control-sm" id="cuadreFecha" value="${today}" max="${today}" required>
            </div>
            <div class="col-12 col-md-4 text-md-end">
              <div class="cuadre-total-label mb-0">TOTAL</div>
              <div class="cuadre-total-value mb-0" id="cuadreTotalValor">${formatImporte(0)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body py-2">
          <div class="mb-2">
            <input type="search" class="form-control form-control-sm" id="cuadreProductosBuscar" placeholder="Escriba para buscar...">
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-striped table-hover small mb-0 cuadre-table">
              <thead class="table-app">
                <tr>
                  <th>Categoría</th>
                  <th>Producto</th>
                  <th class="text-end">Importe</th>
                </tr>
              </thead>
              <tbody id="cuadreTableBody">
                <tr><td colspan="3" class="text-center text-muted">Seleccione empleado y fecha</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
    <div class="modal fade" id="cuadreOrdenModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content small">
          <div class="modal-header modal-header-app py-2">
            <h5 class="modal-title" id="cuadreOrdenModalLabel">Nueva orden</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="cuadreOrdenForm" class="modal-body py-2">
            <p class="mb-2 text-muted" id="cuadreOrdenProductoNombre"></p>
            <div class="mb-2">
              <label class="form-label" for="cuadreOrdenDetalles">Detalles del servicio</label>
              <input type="text" class="form-control form-control-sm" id="cuadreOrdenDetalles" maxlength="300">
            </div>
            <div class="mb-2">
              <label class="form-label" for="cuadreOrdenImporte">Importe</label>
              <input type="text" class="form-control form-control-sm cuadre-modal-importe" id="cuadreOrdenImporte" inputmode="decimal" required>
            </div>
          </form>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" form="cuadreOrdenForm" class="btn btn-primary btn-sm">Aceptar</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal fade" id="cuadreOrdenesListModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content small">
          <div class="modal-header modal-header-app py-2">
            <h5 class="modal-title">Órdenes del día</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body py-2">
            <div class="mb-2">
              <label class="form-label" for="cuadreOrdenesBuscar">Buscar</label>
              <input type="search" class="form-control form-control-sm" id="cuadreOrdenesBuscar" placeholder="Producto, detalles, hora, importe...">
            </div>
            <div class="table-responsive cuadre-ordenes-list-wrap">
              <table class="table table-sm table-striped table-hover small mb-0">
                <thead class="table-app">
                  <tr>
                    <th>Producto</th>
                    <th>Detalles</th>
                    <th>Hora</th>
                    <th class="text-end">Importe</th>
                  </tr>
                </thead>
                <tbody id="cuadreOrdenesListBody">
                  <tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal fade" id="cuadreFinalizarModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content small">
          <div class="modal-header modal-header-app py-2">
            <h5 class="modal-title">Finalizar día</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="cuadreFinalizarForm" class="modal-body py-2">
            <div class="mb-3">
              <label class="form-label" for="cuadreFinalizarObservaciones">Observaciones</label>
              <input type="text" class="form-control form-control-sm" id="cuadreFinalizarObservaciones" maxlength="500">
            </div>
            <div class="mb-3">
              <label class="form-label">Monto a cuadrar</label>
              <div class="cuadre-monto-cuadrar" id="cuadreFinalizarMontoCuadrar">${formatImporte(0)}</div>
            </div>
            <div class="mb-2">
              <label class="form-label" for="cuadreFinalizarEfectivo">Efectivo</label>
              <input type="number" class="form-control form-control-sm" id="cuadreFinalizarEfectivo" min="0" step="0.01" value="0" required>
            </div>
            <div class="mb-2">
              <label class="form-label" for="cuadreFinalizarDocumentos">Documentos</label>
              <input type="number" class="form-control form-control-sm" id="cuadreFinalizarDocumentos" min="0" step="0.01" value="0" required>
            </div>
            <div class="mb-2">
              <span class="form-label d-block mb-1">Suma (Efectivo + Documentos)</span>
              <strong id="cuadreFinalizarSuma">${formatImporte(0)}</strong>
            </div>
            <div class="mb-2">
              <span class="form-label d-block mb-1">Diferencia</span>
              <strong id="cuadreFinalizarDiferencia">${formatImporte(0)}</strong>
            </div>
          </form>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" form="cuadreFinalizarForm" class="btn btn-primary btn-sm">Finalizar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  await bindLogout();

  const empleadoSelect = document.getElementById('cuadreEmpleado');
  const fechaInput = document.getElementById('cuadreFecha');
  const tableBody = document.getElementById('cuadreTableBody');
  const totalEl = document.getElementById('cuadreTotalValor');
  const ordenModal = new bootstrap.Modal(document.getElementById('cuadreOrdenModal'));
  const finalizarModal = new bootstrap.Modal(document.getElementById('cuadreFinalizarModal'));
  const ordenForm = document.getElementById('cuadreOrdenForm');
  const finalizarForm = document.getElementById('cuadreFinalizarForm');
  const ordenDetalles = document.getElementById('cuadreOrdenDetalles');
  const ordenImporte = document.getElementById('cuadreOrdenImporte');
  const ordenProductoNombre = document.getElementById('cuadreOrdenProductoNombre');
  const finalizarMontoCuadrar = document.getElementById('cuadreFinalizarMontoCuadrar');
  const finalizarEfectivo = document.getElementById('cuadreFinalizarEfectivo');
  const finalizarDocumentos = document.getElementById('cuadreFinalizarDocumentos');
  const finalizarSuma = document.getElementById('cuadreFinalizarSuma');
  const finalizarDiferencia = document.getElementById('cuadreFinalizarDiferencia');
  const ordenesListModal = new bootstrap.Modal(document.getElementById('cuadreOrdenesListModal'));
  const ordenesListBody = document.getElementById('cuadreOrdenesListBody');
  const ordenesBuscar = document.getElementById('cuadreOrdenesBuscar');
  const productosBuscar = document.getElementById('cuadreProductosBuscar');

  let items = [];
  let selectedProduct = null;
  let totalDia = 0;
  let diaCerrado = false;
  let fabFinalizarDia = null;
  let ordenesDia = [];
  let ordenesSearchQuery = '';
  let productosSearchQuery = '';

  function updateFinalizarCalculos() {
    const efectivo = parseAmount(finalizarEfectivo.value);
    const documentos = parseAmount(finalizarDocumentos.value);
    const suma = Math.round((efectivo + documentos) * 100) / 100;
    const diferencia = Math.round((totalDia - suma) * 100) / 100;
    finalizarSuma.textContent = formatImporte(suma);
    finalizarDiferencia.textContent = formatImporte(diferencia);
  }

  function openFinalizarModal() {
    const codigo = Number(empleadoSelect.value);
    const fecha = fechaInput.value;
    if (!codigo || !fecha) {
      toastError('Seleccione empleado y fecha.');
      return;
    }
    finalizarForm.reset();
    finalizarEfectivo.value = '0';
    finalizarDocumentos.value = '0';
    finalizarMontoCuadrar.textContent = formatImporte(totalDia);
    updateFinalizarCalculos();
    finalizarModal.show();
  }

  function updateFabVisibility() {
    if (!fabFinalizarDia) return;
    fabFinalizarDia.classList.toggle('d-none', diaCerrado);
  }

  fabFinalizarDia = mountFinalizarDiaFab(openFinalizarModal);
  mountCuadreOrdenesFab(openOrdenesListModal);

  function renderOrdenesListTable() {
    const filtered = ordenesDia.filter((o) => matchesOrdenSearch(o, ordenesSearchQuery));
    if (!ordenesDia.length) {
      ordenesListBody.innerHTML =
        '<tr><td colspan="4" class="text-center text-muted">Sin órdenes</td></tr>';
      return;
    }
    if (!filtered.length) {
      ordenesListBody.innerHTML =
        '<tr><td colspan="4" class="text-center text-muted">Sin coincidencias</td></tr>';
      return;
    }
    ordenesListBody.innerHTML = filtered
      .map(
        (o) => `
      <tr>
        <td>${escapeHtml(o.desprod || '—')}</td>
        <td>${escapeHtml(o.detalles || '—')}</td>
        <td>${escapeHtml(o.hora || '—')}</td>
        <td class="text-end">${formatImporte(o.importe)}</td>
      </tr>`
      )
      .join('');
  }

  async function openOrdenesListModal() {
    const codigo = Number(empleadoSelect.value);
    const fecha = fechaInput.value;
    if (!codigo || !fecha) {
      toastError('Seleccione empleado y fecha.');
      return;
    }
    ordenesBuscar.value = '';
    ordenesSearchQuery = '';
    ordenesListBody.innerHTML =
      '<tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>';
    ordenesListModal.show();

    try {
      ordenesDia = await api.listCuadreOrdenes(codigo, fecha);
      renderOrdenesListTable();
    } catch (err) {
      ordenesDia = [];
      ordenesListBody.innerHTML =
        '<tr><td colspan="4" class="text-danger text-center">Error al cargar</td></tr>';
      toastError(err.message);
    }
  }

  function openOrdenModal(producto) {
    selectedProduct = producto;
    ordenForm.reset();
    ordenProductoNombre.textContent = producto.desprod;
    ordenModal.show();
    ordenDetalles.focus();
  }

  function renderProductosTable() {
    if (!items.length) {
      tableBody.innerHTML =
        '<tr><td colspan="3" class="text-center text-muted">Sin productos habilitados</td></tr>';
      return;
    }

    const filtered = items.filter((row) => matchesProductoSearch(row, productosSearchQuery));
    if (!filtered.length) {
      tableBody.innerHTML =
        '<tr><td colspan="3" class="text-center text-muted">Sin coincidencias</td></tr>';
      return;
    }

    const rowClass = diaCerrado ? '' : 'cuadre-row-clickable';
    const rowRole = diaCerrado ? '' : ' role="button" tabindex="0"';

    tableBody.innerHTML = filtered
      .map(
        (row) => `
        <tr class="${rowClass}" data-codprod="${row.codprod}"${rowRole}>
          <td>${escapeHtml(row.descategoria || '—')}</td>
          <td>${escapeHtml(row.desprod)}</td>
          <td class="text-end">${formatImporte(row.importe)}</td>
        </tr>`
      )
      .join('');

    bindRowClicks();
  }

  function bindRowClicks() {
    document.querySelectorAll('.cuadre-row-clickable').forEach((row) => {
      row.addEventListener('click', () => {
        if (diaCerrado) {
          toastWarning('Este dia ya esta cerrado');
          return;
        }
        const codprod = Number(row.dataset.codprod);
        const producto = items.find((x) => x.codprod === codprod);
        if (producto) openOrdenModal(producto);
      });
    });
  }

  async function loadEmpleados() {
    try {
      if (!supervisor) {
        empleadoSelect.disabled = true;
        if (sessionEmpleado?.codigo) {
          empleadoSelect.innerHTML = `<option value="${sessionEmpleado.codigo}">${escapeHtml(sessionEmpleado.nombre)}</option>`;
          empleadoSelect.value = String(sessionEmpleado.codigo);
          await loadCuadre();
        }
        return;
      }

      const empleados = await api.listEmpleados(true);
      empleadoSelect.innerHTML =
        '<option value="">Seleccione empleado...</option>' +
        empleados
          .map((e) => `<option value="${e.codigo}">${escapeHtml(e.nombre)}</option>`)
          .join('');

      if (sessionEmpleado?.codigo) {
        empleadoSelect.value = String(sessionEmpleado.codigo);
        await loadCuadre();
      }
    } catch (err) {
      toastError(err.message);
    }
  }

  function clampFechaToToday() {
    if (fechaInput.value && fechaInput.value > today) {
      fechaInput.value = today;
      toastWarning('La fecha no puede ser mayor a la fecha actual.');
    }
  }

  async function loadCuadre() {
    const codigo = Number(empleadoSelect.value);
    const fecha = fechaInput.value;
    if (!codigo || !fecha) {
      items = [];
      totalDia = 0;
      diaCerrado = false;
      updateFabVisibility();
      productosSearchQuery = '';
      productosBuscar.value = '';
      tableBody.innerHTML =
        '<tr><td colspan="3" class="text-center text-muted">Seleccione empleado y fecha</td></tr>';
      totalEl.textContent = formatImporte(0);
      return;
    }

    tableBody.innerHTML =
      '<tr><td colspan="3" class="text-center text-muted">Cargando...</td></tr>';

    try {
      const data = await api.getCuadreProductosHabilitados(codigo, fecha);
      items = data.items;
      totalDia = Number(data.total) || 0;
      diaCerrado = Boolean(data.dia_cerrado);
      totalEl.textContent = formatImporte(totalDia);
      updateFabVisibility();
      renderProductosTable();
    } catch (err) {
      items = [];
      totalDia = 0;
      diaCerrado = false;
      updateFabVisibility();
      tableBody.innerHTML =
        '<tr><td colspan="3" class="text-danger text-center">Error al cargar</td></tr>';
      totalEl.textContent = formatImporte(0);
      toastError(err.message);
    }
  }

  ordenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = Number(empleadoSelect.value);
    const fecha = fechaInput.value;
    if (!selectedProduct || !codigo || !fecha) {
      toastError('Seleccione empleado y fecha.');
      return;
    }
    if (diaCerrado) {
      toastWarning('Este dia ya esta cerrado');
      return;
    }

    const detalles = sanitizeDetalles(ordenDetalles.value);
    const importeRaw = ordenImporte.value.trim();
    const importe = Number(importeRaw.replace(/,/g, ''));
    if (!importeRaw || Number.isNaN(importe) || importe < 0) {
      toastError('Ingrese un importe válido.');
      return;
    }

    try {
      await api.createOrden({
        codigo,
        fecha,
        codprod: selectedProduct.codprod,
        detalles: detalles || null,
        importe,
      });
      toastSuccess('Orden registrada');
      ordenModal.hide();
      await loadCuadre();
    } catch (err) {
      toastError(err.message);
    }
  });

  finalizarForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = Number(empleadoSelect.value);
    const fecha = fechaInput.value;
    if (!codigo || !fecha) {
      toastError('Seleccione empleado y fecha.');
      return;
    }

    if (diaCerrado) {
      toastWarning('Este dia ya esta cerrado');
      return;
    }

    const obs = sanitizeObservaciones(
      document.getElementById('cuadreFinalizarObservaciones').value
    );

    try {
      await api.finalizarDiaCuadre({
        codigo,
        fecha,
        importe: totalDia,
        observaciones: obs || null,
      });
      toastSuccess('Día finalizado');
      finalizarModal.hide();
      await loadCuadre();
    } catch (err) {
      toastError(err.message);
    }
  });

  finalizarEfectivo.addEventListener('input', updateFinalizarCalculos);
  finalizarDocumentos.addEventListener('input', updateFinalizarCalculos);

  ordenesBuscar.addEventListener('input', () => {
    ordenesSearchQuery = ordenesBuscar.value.trim().toLowerCase();
    renderOrdenesListTable();
  });

  productosBuscar.addEventListener('input', () => {
    productosSearchQuery = productosBuscar.value.trim().toLowerCase();
    renderProductosTable();
  });

  empleadoSelect.addEventListener('change', loadCuadre);
  fechaInput.addEventListener('change', () => {
    clampFechaToToday();
    loadCuadre();
  });

  await loadEmpleados();
}
