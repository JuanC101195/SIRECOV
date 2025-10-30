// frontend/app.js - SIRECOV v2.0 Frontend Avanzado

// Estado global de la aplicación
const AppState = {
  currentTab: 'registro',
  autocompleteTimeout: null,
  charts: {},
  lastSearch: {}
};

// Utilidades
const Utils = {
  // Mostrar notificación
  showNotification(message, type = 'info', duration = 4000) {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    
    const colors = {
      success: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white',
      warning: 'bg-yellow-500 text-black',
      info: 'bg-blue-500 text-white'
    };
    
    notification.className = `${colors[type]} px-4 py-3 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 max-w-sm`;
    notification.innerHTML = `
      <div class="flex items-center justify-between">
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-3 font-bold">&times;</button>
      </div>
    `;
    
    container.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 100);
    
    // Auto remover
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  },

  // Formatear duración
  formatDuration(ms) {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  },

  // Formatear fecha
  formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('es-ES');
    } catch {
      return dateStr;
    }
  },

  // Formatear número
  formatNumber(num) {
    return new Intl.NumberFormat('es-ES').format(num);
  },

  // Crear tabla de resultados
  createTable(data, columns) {
    if (!data || data.length === 0) {
      return '<div class="text-gray-500 text-center py-4">No hay datos para mostrar</div>';
    }

    let html = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              ${columns.map(col => `<th class="px-3 py-2 text-left font-medium text-gray-700">${col.title}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
    `;
    
    data.slice(0, 100).forEach(item => { // Limitar a 100 para performance
      html += `<tr class="hover:bg-gray-50">`;
      columns.forEach(col => {
        let value = item[col.key];
        if (col.formatter) value = col.formatter(value);
        html += `<td class="px-3 py-2">${value || '-'}</td>`;
      });
      html += `</tr>`;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    if (data.length > 100) {
      html += `<div class="text-center text-gray-500 text-sm mt-2">Mostrando primeros 100 de ${Utils.formatNumber(data.length)} registros</div>`;
    }
    
    return html;
  }
};

// ---------- Agregar registro ----------
$("#form-add")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const country = $("#country").value.trim();
  const date = $("#date").value.trim();
  const type = $("#type").value.trim();
  const cases = Number($("#cases").value);

  try {
    const res = await fetch("/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, date, type, cases }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || "Error", false);
    toast("Registro guardado ✅");
    e.target.reset();
  } catch {
    toast("Error de conexión", false);
  }
});

// ---------- Consulta por clave ----------
$("#form-get")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const country = $("#g-country").value.trim();
  const date = $("#g-date").value.trim();
  const type = $("#g-type").value.trim();

  try {
    const qs = new URLSearchParams({ country, date, type }).toString();
    const res = await fetch(`/records?${qs}`);
    const data = await res.json();
    if (!res.ok) return toast(data.error || "No encontrado", false);
    const r = data.record;
    $("#r-country").textContent = r.country;
    $("#r-date").textContent = r.date;
    $("#r-type").textContent = r.type;
    $("#r-cases").textContent = r.cases;
    $("#get-result").classList.remove("hidden");
    toast("Resultado encontrado ✅");
  } catch {
    toast("Error de conexión", false);
  }
});

// ---------- Funciones auxiliares ----------
function renderTable(records) {
  const headers = ["country", "date", "type", "cases"];
  const thead =
    "<thead><tr>" +
    headers.map((h) => `<th class='p-2 text-left'>${h}</th>`).join("") +
    "</tr></thead>";
  const rows = records
    .map(
      (r) =>
        `<tr><td class='p-2'>${r.country}</td><td class='p-2'>${r.date}</td><td class='p-2'>${r.type}</td><td class='p-2'>${r.cases}</td></tr>`
    )
    .join("");
  return `<table class='min-w-full text-sm border'>${thead}<tbody>${rows}</tbody></table>`;
}

function renderComparison(hashData, scanData) {
  return `
  <div class="grid md:grid-cols-2 gap-4 mt-3">
    <div class="border rounded-lg p-3">
      <h4>Hash (O(1))</h4>
      <p class="text-xs text-slate-600">iteraciones: <b>${hashData.iterations}</b> · tiempo: <b>${hashData.durationMs}ms</b></p>
      ${renderTable(hashData.records)}
    </div>
    <div class="border rounded-lg p-3">
      <h4>Scan (O(n))</h4>
      <p class="text-xs text-slate-600">iteraciones: <b>${scanData.iterations}</b> · tiempo: <b>${scanData.durationMs}ms</b></p>
      ${renderTable(scanData.records)}
    </div>
  </div>`;
}

// ---------- Buscar por fecha ----------
$("#form-by-date")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = $("#bydate-date").value.trim();

  try {
    const [resH, resS] = await Promise.all([
      fetch(`/records/by-date/${encodeURIComponent(date)}`),
      fetch(`/bench/scan-by-date/${encodeURIComponent(date)}`),
    ]);
    const [hash, scan] = await Promise.all([resH.json(), resS.json()]);
    if (!resH.ok || !resS.ok) return toast("No encontrado", false);
    $("#bydate-result").innerHTML = renderComparison(hash, scan);
  } catch {
    toast("Error de conexión", false);
  }
});

// ---------- Buscar por país ----------
$("#form-by-country")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const country = $("#bycountry-country").value.trim();

  try {
    const [resH, resS] = await Promise.all([
      fetch(`/records/by-country/${encodeURIComponent(country)}`),
      fetch(`/bench/scan-by-country/${encodeURIComponent(country)}`),
    ]);
    const [hash, scan] = await Promise.all([resH.json(), resS.json()]);
    if (!resH.ok || !resS.ok) return toast("No encontrado", false);
    $("#bycountry-result").innerHTML = renderComparison(hash, scan);
  } catch {
    toast("Error de conexión", false);
  }
});
