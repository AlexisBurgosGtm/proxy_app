import * as api from '../api.js';
import { updateAppShell, bindLogout } from '../components/layout.js';
import { toastSuccess, toastError, confirmAction } from '../alerts.js';
import { bindGuardedSubmit, bindGuardedClick } from '../submit-guard.js';

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function mountProductosFab() {
  document.getElementById('btnFabNuevoProducto')?.remove();
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'btnFabNuevoProducto';
  fab.className = 'btn btn-primary fab-add-floating';
  fab.setAttribute('aria-label', 'Nuevo producto');
  fab.innerHTML = '<i class="fa-solid fa-plus"></i>';
  document.body.appendChild(fab);
  return fab;
}

function habilitadoBadge(habilitado) {
  if (String(habilitado).toUpperCase() === 'NO') {
    return '<span class="badge badge-estado-inactivo">NO</span>';
  }
  return '<span class="badge badge-estado-activo">SI</span>';
}

function buildCategoriaOptions(categorias, selected = '') {
  const options = ['<option value="">Sin categoría</option>'];
  for (const c of categorias) {
    const sel = String(selected) === String(c.codcategoria) ? ' selected' : '';
    options.push(
      `<option value="${c.codcategoria}"${sel}>${escapeHtml(c.descategoria)}</option>`
    );
  }
  return options.join('');
}

export async function renderProducts(root) {
  updateAppShell('productos', 'Productos');
  root.innerHTML = `
    <main class="container-fluid py-2 pb-5">
      <h1 class="h6 mb-2">Gestión de productos</h1>
      <div class="table-responsive">
        <table class="table table-sm table-striped table-hover small mb-0">
          <thead class="table-app">
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Habilitado</th>
              <th class="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody id="productosTableBody">
            <tr><td colspan="5" class="text-center text-muted">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </main>
    <div class="modal fade" id="productoModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content small">
          <div class="modal-header modal-header-app py-2">
            <h5 class="modal-title" id="productoModalLabel">Producto</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="productoForm" class="modal-body py-2">
            <input type="hidden" id="productoCodigo">
            <div class="mb-2" id="productoCodigoDisplayGroup" style="display:none">
              <label class="form-label" for="productoCodigoDisplay">Código</label>
              <input type="text" class="form-control form-control-sm" id="productoCodigoDisplay" readonly>
            </div>
            <div class="mb-2">
              <label class="form-label" for="productoDesprod">Descripción</label>
              <textarea class="form-control form-control-sm" id="productoDesprod" rows="3" required></textarea>
            </div>
            <div class="mb-2">
              <label class="form-label" for="productoCodcategoria">Categoría</label>
              <select class="form-select form-select-sm" id="productoCodcategoria">
                <option value="">Sin categoría</option>
              </select>
            </div>
            <div class="mb-2">
              <label class="form-label" for="productoHabilitado">Habilitado</label>
              <select class="form-select form-select-sm" id="productoHabilitado" required>
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </div>
          </form>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" form="productoForm" class="btn btn-primary btn-sm">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  await bindLogout();

  const fab = mountProductosFab();
  const modal = new bootstrap.Modal(document.getElementById('productoModal'));
  const tableBody = document.getElementById('productosTableBody');
  const categoriaSelect = document.getElementById('productoCodcategoria');
  let list = [];
  let categorias = [];

  async function loadCategorias() {
    categorias = await api.listCategorias();
  }

  function refreshCategoriaSelect(selected = '') {
    categoriaSelect.innerHTML = buildCategoriaOptions(categorias, selected);
  }

  function openModal(producto = null) {
    document.getElementById('productoForm').reset();
    refreshCategoriaSelect(producto?.codcategoria ?? '');
    document.getElementById('productoCodigoDisplayGroup').style.display = producto ? 'block' : 'none';
    if (producto) {
      document.getElementById('productoModalLabel').textContent = 'Editar producto';
      document.getElementById('productoCodigo').value = producto.codprod;
      document.getElementById('productoCodigoDisplay').value = producto.codprod;
      document.getElementById('productoDesprod').value = producto.desprod;
      categoriaSelect.value = producto.codcategoria ? String(producto.codcategoria) : '';
      document.getElementById('productoHabilitado').value =
        String(producto.habilitado || 'SI').toUpperCase() === 'NO' ? 'NO' : 'SI';
    } else {
      document.getElementById('productoModalLabel').textContent = 'Nuevo producto';
      document.getElementById('productoCodigo').value = '';
      document.getElementById('productoHabilitado').value = 'SI';
    }
    modal.show();
  }

  async function load() {
    try {
      list = await api.listProductos();
      if (!list.length) {
        tableBody.innerHTML =
          '<tr><td colspan="5" class="text-center text-muted">Sin registros</td></tr>';
        return;
      }
      tableBody.innerHTML = list
        .map(
          (p) => `
        <tr>
          <td>${p.codprod}</td>
          <td>${escapeHtml(p.desprod)}</td>
          <td>${escapeHtml(p.descategoria || '—')}</td>
          <td>${habilitadoBadge(p.habilitado)}</td>
          <td class="text-end">
            <div class="d-grid gap-1 d-md-block">
              <button class="btn btn-outline-primary btn-sm btn-edit" data-codprod="${p.codprod}">Editar</button>
              <button class="btn btn-outline-danger btn-sm btn-delete" data-codprod="${p.codprod}">Eliminar</button>
            </div>
          </td>
        </tr>`
        )
        .join('');

      document.querySelectorAll('.btn-edit').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = list.find((x) => x.codprod === Number(btn.dataset.codprod));
          if (item) openModal(item);
        });
      });
      document.querySelectorAll('.btn-delete').forEach((btn) => {
        bindGuardedClick(btn, async () => {
          const codprod = Number(btn.dataset.codprod);
          const ok = await confirmAction('Eliminar producto', '¿Confirma la eliminación?');
          if (!ok) return;
          try {
            await api.deleteProducto(codprod);
            toastSuccess('Producto eliminado');
            await load();
          } catch (err) {
            toastError(err.message);
          }
        });
      });
    } catch (err) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-danger text-center">Error al cargar</td></tr>';
      toastError(err.message);
    }
  }

  fab.addEventListener('click', () => openModal());

  bindGuardedSubmit(document.getElementById('productoForm'), async () => {
    const codprod = document.getElementById('productoCodigo').value;
    const codcategoriaVal = document.getElementById('productoCodcategoria').value;
    const body = {
      desprod: document.getElementById('productoDesprod').value.trim(),
      codcategoria: codcategoriaVal ? Number(codcategoriaVal) : null,
      habilitado: document.getElementById('productoHabilitado').value,
    };
    try {
      if (codprod) {
        await api.updateProducto({ codprod: Number(codprod), ...body });
        toastSuccess('Producto actualizado');
      } else {
        await api.createProducto(body);
        toastSuccess('Producto creado');
      }
      modal.hide();
      await load();
    } catch (err) {
      toastError(err.message);
    }
  });

  try {
    await loadCategorias();
    refreshCategoriaSelect();
    await load();
  } catch (err) {
    tableBody.innerHTML =
      '<tr><td colspan="4" class="text-danger text-center">Error al cargar</td></tr>';
    toastError(err.message);
  }
}
