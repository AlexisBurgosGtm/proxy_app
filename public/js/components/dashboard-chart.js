import { formatDate, formatImporte } from '../format.js';

let lineChartInstance = null;
let categoriaChartInstance = null;

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildDailySeries(importePorFecha, desde, hasta) {
  const labels = [];
  const values = [];
  const totals = new Map(
    (importePorFecha || []).map((row) => [row.fecha, Number(row.importe) || 0])
  );

  const cursor = new Date(`${desde}T00:00:00`);
  const end = new Date(`${hasta}T00:00:00`);

  while (cursor <= end) {
    const key = toDateInput(cursor);
    labels.push(formatDate(key));
    values.push(totals.get(key) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  return { labels, values };
}

async function loadChartJs() {
  return (await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/auto/+esm')).default;
}

export function destroyImporteChart() {
  if (lineChartInstance) {
    lineChartInstance.destroy();
    lineChartInstance = null;
  }
}

export function destroyCategoriaChart() {
  if (categoriaChartInstance) {
    categoriaChartInstance.destroy();
    categoriaChartInstance = null;
  }
}

export function destroyDashboardCharts() {
  destroyImporteChart();
  destroyCategoriaChart();
}

export async function renderImporteLineChartFromOrdenes(canvas, importePorFecha, desde, hasta) {
  if (!canvas) return;

  destroyImporteChart();

  const { labels, values } = buildDailySeries(importePorFecha, desde, hasta);
  const Chart = await loadChartJs();

  lineChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Importe',
          data: values,
          borderColor: '#219FFC',
          backgroundColor: 'rgba(33, 159, 252, 0.12)',
          pointBackgroundColor: '#1780d4',
          pointBorderColor: '#fff',
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Importe: ${formatImporte(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) =>
              `Q ${Number(value).toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}`,
          },
        },
      },
    },
  });
}

export async function renderCategoriaBarChart(canvas, importePorCategoria) {
  if (!canvas) return;

  destroyCategoriaChart();

  const items = importePorCategoria || [];
  const labels = items.map((row) => row.descategoria || 'Sin categoría');
  const values = items.map((row) => Number(row.importe) || 0);
  const Chart = await loadChartJs();

  categoriaChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Importe',
          data: values,
          backgroundColor: 'rgba(33, 159, 252, 0.75)',
          borderColor: '#1780d4',
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Importe: ${formatImporte(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: (value) =>
              `Q ${Number(value).toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}`,
          },
        },
        y: {
          ticks: {
            autoSkip: false,
          },
        },
      },
    },
  });
}

/** @deprecated Use renderImporteLineChartFromOrdenes */
export async function renderImporteLineChart(canvas, tickets, desde, hasta) {
  const byFecha = new Map();
  for (const ticket of tickets || []) {
    const day = ticket.fecha_inicio;
    if (!day) continue;
    byFecha.set(day, (byFecha.get(day) || 0) + (ticket.totalprecio != null ? Number(ticket.totalprecio) : 0));
  }
  const importePorFecha = [...byFecha.entries()].map(([fecha, importe]) => ({ fecha, importe }));
  await renderImporteLineChartFromOrdenes(canvas, importePorFecha, desde, hasta);
}
