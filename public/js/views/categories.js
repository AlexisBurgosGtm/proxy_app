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

function mountCategoriasFab() {
  document.getElementById('btnFabNuevoCategoria')?.remove();
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'btnFabNuevoCategoria';
  fab.className = 'btn btn-primary fab-add-floating';
  fab.setAttribute('aria-label', 'Nueva categoría');
  fab.innerHTML = '<i class="fa-solid fa-plus"></i>';
  document.body.appendChild(fab);
  return fab;
}

export async function renderCategories(root) {
  updateAppShell('categorias', 'Categorías');
  root.innerHTML = `
    <main class="container-fluid py-2 pb-5">
      <h1 class="h6 mb-2">Gestión de categorías</h1>
      <div class="table-responsive">
        <table class="table table-sm table-striped table-hover small mb-0">
          <thead class="table-app">
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th class="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody id="categoriasTableBody">
            <tr><td colspan="3" class="text-center text-muted">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </main>
    <div class="modal fade" id="categoriaModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content small">
          <div class="modal-header modal-header-app py-2">
            <h5 class="modal-title" id="categoriaModalLabel">Categoría</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="categoriaForm" class="modal-body py-2">
            <input type="hidden" id="categoriaCodigo">
            <div class="mb-2" id="categoriaCodigoDisplayGroup" style="display:none">
              <label class="form-label" for="categoriaCodigoDisplay">Código</label>
              <input type="text" class="form-control form-control-sm" id="categoriaCodigoDisplay" readonly>
            </div>
            <div class="mb-2">
              <label class="form-label" for="categoriaDescategoria">Descripción</label>
              <input type="text" class="form-control form-control-sm" id="categoriaDescategoria" maxlength="255" required>
            </div>
          </form>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" form="categoriaForm" class="btn btn-primary btn-sm">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  await bindLogout();

  const fab = mountCategoriasFab();
  const modal = new bootstrap.Modal(document.getElementById('categoriaModal'));
  const tableBody = document.getElementById('categoriasTableBody');
  let list = [];

  function openModal(categoria = null) {
    document.getElementById('categoriaForm').reset();
    document.getElementById('categoriaCodigoDisplayGroup').style.display = categoria ? 'block' : 'none';
    if (categoria) {
      document.getElementById('categoriaModalLabel').textContent = 'Editar categoría';
      document.getElementById('categoriaCodigo').value = categoria.codcategoria;
      document.getElementById('categoriaCodigoDisplay').value = categoria.codcategoria;
      document.getElementById('categoriaDescategoria').value = categoria.descategoria;
    } else {
      document.getElementById('categoriaModalLabel').textContent = 'Nueva categoría';
      document.getElementById('categoriaCodigo').value = '';
    }
    modal.show();
  }

  async function load() {
    try {
      list = await api.listCategorias();
      if (!list.length) {
        tableBody.innerHTML =
          '<tr><td colspan="3" class="text-center text-muted">Sin registros</td></tr>';
        return;
      }
      tableBody.innerHTML = list
        .map(
          (c) => `
        <tr>
          <td>${c.codcategoria}</td>
          <td>${escapeHtml(c.descategoria)}</td>
          <td class="text-end">
            <div class="d-grid gap-1 d-md-block">
              <button class="btn btn-outline-primary btn-sm btn-edit" data-codcategoria="${c.codcategoria}">Editar</button>
              <button class="btn btn-outline-danger btn-sm btn-delete" data-codcategoria="${c.codcategoria}">Eliminar</button>
            </div>
          </td>
        </tr>`
        )
        .join('');

      document.querySelectorAll('.btn-edit').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = list.find((x) => x.codcategoria === Number(btn.dataset.codcategoria));
          if (item) openModal(item);
        });
      });
      document.querySelectorAll('.btn-delete').forEach((btn) => {
        bindGuardedClick(btn, async () => {
          const codcategoria = Number(btn.dataset.codcategoria);
          const ok = await confirmAction('Eliminar categoría', '¿Confirma la eliminación?');
          if (!ok) return;
          try {
            await api.deleteCategoria(codcategoria);
            toastSuccess('Categoría eliminada');
            await load();
          } catch (err) {
            toastError(err.message);
          }
        });
      });
    } catch (err) {
      tableBody.innerHTML =
        '<tr><td colspan="3" class="text-danger text-center">Error al cargar</td></tr>';
      toastError(err.message);
    }
  }

  fab.addEventListener('click', () => openModal());

  bindGuardedSubmit(document.getElementById('categoriaForm'), async () => {
    const codcategoria = document.getElementById('categoriaCodigo').value;
    const body = {
      descategoria: document.getElementById('categoriaDescategoria').value.trim(),
    };
    try {
      if (codcategoria) {
        await api.updateCategoria({ codcategoria: Number(codcategoria), ...body });
        toastSuccess('Categoría actualizada');
      } else {
        await api.createCategoria(body);
        toastSuccess('Categoría creada');
      }
      modal.hide();
      await load();
    } catch (err) {
      toastError(err.message);
    }
  });

  await load();
}
