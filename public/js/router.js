import { isAuthenticated, canAccessRoute, getDefaultRoute } from './auth.js';
import { closeSidebar, hideAppShell } from './components/layout.js';
import { renderLogin } from './views/login.js';
import { renderInicioProxy } from './views/inicio_proxy.js';
import { destroyDashboardCharts } from './components/dashboard-chart.js';
import { renderCalendar, destroyCalendar } from './views/calendar.js';
import { renderEmployees } from './views/employees.js';
import { renderClients } from './views/clients.js';
import { renderTickets } from './views/tickets.js';
import { renderArchivo } from './views/archivo.js';
import { renderConfig } from './views/config.js';
import { renderCategories } from './views/categories.js';
import { renderProducts } from './views/products.js';
import { renderCuadre } from './views/cuadre.js';
import { renderObjetivos } from './views/objetivos.js';

const routes = {
  login: { render: renderLogin, auth: false },
  inicio_proxy: { render: renderInicioProxy, auth: true },
  tickets: { render: renderTickets, auth: true },
  calendario: { render: renderCalendar, auth: true },
  archivo: { render: renderArchivo, auth: true },
  empleados: { render: renderEmployees, auth: true },
  clientes: { render: renderClients, auth: true },
  categorias: { render: renderCategories, auth: true },
  productos: { render: renderProducts, auth: true },
  objetivos: { render: renderObjetivos, auth: true },
  cuadre: { render: renderCuadre, auth: true },
  config: { render: renderConfig, auth: true },
};

let currentRoute = null;

function removeFloatingActions() {
  document.getElementById('btnFabNuevoTicket')?.remove();
  document.getElementById('btnFabNuevoCategoria')?.remove();
  document.getElementById('btnFabNuevoProducto')?.remove();
  document.getElementById('btnFabFinalizarDia')?.remove();
  document.getElementById('btnFabCuadreOrdenes')?.remove();
}

function removeDetachedModals() {
  document.querySelectorAll('body .modal').forEach((el) => el.remove());
  document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
}

function attachModalsToBody(container) {
  container.querySelectorAll('.modal').forEach((modalEl) => {
    document.body.appendChild(modalEl);
  });
}

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '') || '';
  return hash.split('?')[0] || 'login';
}

export function navigate(path) {
  window.location.hash = `#/${path}`;
}

export async function handleRoute() {
  const path = parseHash();
  const route = routes[path];

  if (path === 'inicio') {
    navigate(isAuthenticated() ? (canAccessRoute('inicio_proxy') ? 'inicio_proxy' : getDefaultRoute()) : 'login');
    return;
  }

  if (!route) {
    navigate(isAuthenticated() ? getDefaultRoute() : 'login');
    return;
  }

  if (route.auth && !isAuthenticated()) {
    navigate('login');
    return;
  }

  if (!route.auth && isAuthenticated() && path === 'login') {
    navigate(getDefaultRoute());
    return;
  }

  if (route.auth && !canAccessRoute(path)) {
    navigate(getDefaultRoute());
    return;
  }

  if (currentRoute === 'calendario' && path !== 'calendario') {
    destroyCalendar();
  }

  if (currentRoute === 'inicio_proxy' && path !== 'inicio_proxy') {
    destroyDashboardCharts();
  }

  if (currentRoute !== path) {
    removeFloatingActions();
  }

  closeSidebar();

  currentRoute = path;
  const root = document.getElementById('root');
  removeDetachedModals();
  root.innerHTML = '';

  if (!route.auth) {
    hideAppShell();
  }

  const stage = document.createElement('div');
  stage.className = 'view-slide-enter';
  root.appendChild(stage);

  await route.render(stage);
  attachModalsToBody(stage);
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
