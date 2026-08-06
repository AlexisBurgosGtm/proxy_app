import * as api from '../api.js';
import { updateAppShell, bindLogout, refreshObjetivoBadge } from '../components/layout.js';
import { toastSuccess, toastError } from '../alerts.js';
import { bindGuardedClick } from '../submit-guard.js';

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function tipoLabel(tipo) {
  return tipo === 'SUPERVISOR' ? 'Supervisor' : 'Técnico';
}

function parseObjetivoInput(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return 0;
  const num = Number(String(raw).trim().replace(/,/g, ''));
  if (Number.isNaN(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
}

export async function renderObjetivos(root) {
  updateAppShell('objetivos', 'Gestión de Objetivos');

  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y += 1) years.push(y);

  root.innerHTML = `
    <main class="container-fluid py-2 pb-5">
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-2 mb-3">
        <h1 class="h6 mb-0">Gestión de Objetivos</h1>
        <div class="d-flex flex-wrap align-items-end gap-2">
          <div>
            <label class="form-label mb-1" for="objetivoMes">Mes</label>
            <select class="form-select form-select-sm" id="objetivoMes">
              ${MESES.map(
                (m) =>
                  `<option value="${m.value}" ${m.value === now.getMonth() + 1 ? 'selected' : ''}>${m.label}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="form-label mb-1" for="objetivoAnio">Año</label>
            <select class="form-select form-select-sm" id="objetivoAnio">
              ${years
                .map(
                  (y) =>
                    `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
                )
                .join('')}
            </select>
          </div>
          <button type="button" class="btn btn-outline-primary btn-sm" id="btnCargarObjetivos">
            <i class="fa-solid fa-rotate me-1"></i>Cargar
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btnGuardarObjetivos">
            <i class="fa-solid fa-floppy-disk me-1"></i>Guardar
          </button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-sm table-striped table-hover small mb-0">
          <thead class="table-app">
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th class="text-end" style="width:7.5rem">Objetivo</th>
            </tr>
          </thead>
          <tbody id="objetivosTableBody">
            <tr><td colspan="4" class="text-center text-muted">Seleccione mes y año, luego Cargar.</td></tr>
          </tbody>
        </table>
      </div>
    </main>
  `;

  await bindLogout();

  const mesSelect = document.getElementById('objetivoMes');
  const anioSelect = document.getElementById('objetivoAnio');
  const tableBody = document.getElementById('objetivosTableBody');
  let list = [];

  function renderRows(empleados) {
    list = empleados;
    if (!list.length) {
      tableBody.innerHTML =
        '<tr><td colspan="4" class="text-center text-muted">Sin empleados activos</td></tr>';
      return;
    }
    tableBody.innerHTML = list
      .map(
        (e) => `
      <tr>
        <td>${e.codigo}</td>
        <td>${escapeHtml(e.nombre)}</td>
        <td>${tipoLabel(e.tipo)}</td>
        <td class="text-end">
          <div class="input-group input-group-sm objetivo-monto-group">
            <span class="input-group-text">Q</span>
            <input type="text" inputmode="decimal"
              class="form-control form-control-sm objetivo-monto"
              data-codigo="${e.codigo}"
              value="${e.objetivo ? String(e.objetivo) : ''}"
              placeholder="0.00"
              autocomplete="off">
          </div>
        </td>
      </tr>`
      )
      .join('');
  }

  async function load() {
    const mes = Number(mesSelect.value);
    const anio = Number(anioSelect.value);
    tableBody.innerHTML =
      '<tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>';
    try {
      const empleados = await api.listObjetivos(mes, anio);
      renderRows(empleados);
    } catch (err) {
      tableBody.innerHTML =
        '<tr><td colspan="4" class="text-danger text-center">Error al cargar</td></tr>';
      toastError(err.message);
    }
  }

  async function save() {
    const mes = Number(mesSelect.value);
    const anio = Number(anioSelect.value);
    const inputs = [...document.querySelectorAll('.objetivo-monto')];
    const items = [];
    for (const input of inputs) {
      const codigo = Number(input.dataset.codigo);
      const objetivo = parseObjetivoInput(input.value);
      if (objetivo === null) {
        toastError(`Objetivo inválido para el empleado ${codigo}.`);
        input.focus();
        return;
      }
      items.push({ codigo, objetivo });
    }
    try {
      await api.saveObjetivos({ mes, anio, items });
      toastSuccess('Objetivos guardados');
      await load();
      refreshObjetivoBadge();
    } catch (err) {
      toastError(err.message);
    }
  }

  document.getElementById('btnCargarObjetivos').addEventListener('click', () => {
    load();
  });
  bindGuardedClick(document.getElementById('btnGuardarObjetivos'), save);
  mesSelect.addEventListener('change', () => load());
  anioSelect.addEventListener('change', () => load());

  await load();
}
