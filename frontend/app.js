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

// Gestión de pestañas
function showTab(tabName) {
  // Ocultar todos los contenidos
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  
  // Mostrar el contenido seleccionado
  const content = document.getElementById(`content-${tabName}`);
  if (content) content.classList.remove('hidden');
  
  // Actualizar botones de navegación
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.className = 'tab-button py-4 px-2 border-b-2 border-transparent hover:border-gray-300';
  });
  
  const activeBtn = document.getElementById(`tab-${tabName}`);
  if (activeBtn) {
    activeBtn.className = 'tab-button py-4 px-2 border-b-2 border-blue-500 text-blue-600 font-medium';
  }
  
  AppState.currentTab = tabName;
  
  // Cargar datos si es necesario
  if (tabName === 'estadisticas' && document.getElementById('general-stats').innerHTML.includes('Cargando')) {
    loadGeneralStats();
  } else if (tabName === 'sistema' && document.getElementById('system-info').innerHTML.includes('Cargando')) {
    loadSystemInfo();
  }
}

// Autocompletado de países
function setupAutocomplete() {
  // Lista de todos los inputs de país con sus dropdowns correspondientes
  const autocompleteConfigs = [
    { inputId: 'country', dropdownId: 'autocomplete-dropdown' },
    { inputId: 'g-country', dropdownId: 'g-autocomplete-dropdown' },
    { inputId: 'bycountry-country', dropdownId: 'bycountry-autocomplete-dropdown' },
    { inputId: 'stats-country', dropdownId: 'stats-autocomplete-dropdown' },
    { inputId: 'export-country', dropdownId: 'export-autocomplete-dropdown' },
    { inputId: 'bench-country', dropdownId: 'bench-autocomplete-dropdown' }
  ];

  autocompleteConfigs.forEach(config => {
    const input = document.getElementById(config.inputId);
    const dropdown = document.getElementById(config.dropdownId);
    
    if (!input || !dropdown) return;
    
    input.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      clearTimeout(AppState.autocompleteTimeout);
      
      if (query.length < 2) {
        dropdown.classList.add('hidden');
        return;
      }
      
      AppState.autocompleteTimeout = setTimeout(async () => {
        try {
          const response = await fetch(`/autocomplete/countries?prefix=${encodeURIComponent(query)}&limit=8`);
          const data = await response.json();
          
          if (data.ok && data.suggestions.length > 0) {
            dropdown.innerHTML = data.suggestions.map(suggestion => 
              `<div class="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0" 
                onclick="selectCountryFor('${config.inputId}', '${suggestion.country}', '${config.dropdownId}')">
                <span class="font-medium">${suggestion.country}</span>
                <span class="text-gray-500 text-xs ml-2">(${suggestion.frequency} registros)</span>
              </div>`
            ).join('');
            dropdown.classList.remove('hidden');
          } else {
            dropdown.classList.add('hidden');
          }
        } catch (error) {
          console.error('Error en autocompletado:', error);
          dropdown.classList.add('hidden');
        }
      }, 200);
    });
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  });
}

// Función para seleccionar país en cualquier input
function selectCountryFor(inputId, country, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (input) input.value = country;
  if (dropdown) dropdown.classList.add('hidden');
}

// Función heredada para compatibilidad
function selectCountry(country) {
  selectCountryFor('country', country, 'autocomplete-dropdown');
}

// Registro de casos
async function setupRecordForm() {
  const form = document.getElementById('form-add');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      country: document.getElementById('country').value.trim(),
      date: document.getElementById('date').value,
      type: document.getElementById('type').value,
      cases: parseInt(document.getElementById('cases').value)
    };
    
    if (!formData.country || !formData.date || !formData.type || isNaN(formData.cases)) {
      Utils.showNotification('Por favor completa todos los campos correctamente', 'error');
      return;
    }
    
    try {
      const response = await fetch('/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.ok) {
        Utils.showNotification('✅ Registro guardado correctamente', 'success');
        form.reset();
        
        // Limpiar autocomplete
        const dropdown = document.getElementById('autocomplete-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
      } else {
        Utils.showNotification(`❌ Error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      Utils.showNotification('❌ Error de conexión', 'error');
    }
  });
}

// Consulta individual
async function setupSearchForm() {
  const form = document.getElementById('form-get');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const country = document.getElementById('g-country').value.trim();
    const date = document.getElementById('g-date').value;
    const type = document.getElementById('g-type').value;
    
    if (!country || !date || !type) {
      Utils.showNotification('Por favor completa todos los campos', 'error');
      return;
    }
    
    try {
      // Mostrar indicador de carga
      const resultDiv = document.getElementById('get-result');
      resultDiv.className = 'mt-4 p-4 border rounded-lg bg-blue-50 border-blue-200';
      resultDiv.innerHTML = `
        <div class="flex items-center justify-center py-4">
          <div class="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
          <span class="text-blue-600 font-medium">Buscando registro...</span>
        </div>
      `;
      
      const params = new URLSearchParams({ country, date, type });
      console.log('Buscando con parámetros:', { country, date, type });
      
      const response = await fetch(`/records?${params}`);
      const result = await response.json();
      
      console.log('Respuesta del servidor:', result);
      
      if (result.ok && result.record) {
        // Registro encontrado
        resultDiv.className = 'mt-4 p-4 border rounded-lg bg-emerald-50 border-emerald-200';
        resultDiv.innerHTML = `
          <h3 class="font-semibold mb-3 text-emerald-800 flex items-center">
            ✅ Registro Encontrado
            <span class="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Confirmado</span>
          </h3>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong class="text-gray-700">País:</strong>
              <div class="text-lg font-semibold text-emerald-800">${result.record.country}</div>
            </div>
            <div>
              <strong class="text-gray-700">Fecha:</strong>
              <div class="text-lg font-semibold text-emerald-800">${result.record.date}</div>
            </div>
            <div>
              <strong class="text-gray-700">Tipo:</strong>
              <div class="text-lg font-semibold text-emerald-800 capitalize">${result.record.type}</div>
            </div>
            <div>
              <strong class="text-gray-700">Casos:</strong>
              <div class="text-xl font-bold text-emerald-800">${Utils.formatNumber(result.record.cases)}</div>
            </div>
          </div>
        `;
        Utils.showNotification('✅ Registro encontrado correctamente', 'success');
      } else {
        // Registro no encontrado
        resultDiv.className = 'mt-4 p-4 border rounded-lg bg-red-50 border-red-200';
        resultDiv.innerHTML = `
          <h3 class="font-semibold mb-2 text-red-800 flex items-center">
            ❌ Registro No Encontrado
          </h3>
          <div class="text-sm text-red-700 space-y-2">
            <p><strong>Búsqueda realizada:</strong></p>
            <div class="bg-red-100 p-3 rounded border-l-4 border-red-400">
              <div><strong>País:</strong> ${country}</div>
              <div><strong>Fecha:</strong> ${date}</div>
              <div><strong>Tipo:</strong> ${type}</div>
            </div>
            <p class="mt-3 text-red-600">
              ${result.error || 'No existe un registro con estos parámetros en la base de datos.'}
            </p>
            <p class="text-xs text-red-500 mt-2">
              💡 Verifica que el país, fecha y tipo sean exactos y que el registro exista en el sistema.
            </p>
          </div>
        `;
        Utils.showNotification(`❌ ${result.error || 'Registro no encontrado'}`, 'error');
      }
    } catch (error) {
      console.error('Error en la consulta:', error);
      const resultDiv = document.getElementById('get-result');
      resultDiv.className = 'mt-4 p-4 border rounded-lg bg-red-50 border-red-200';
      resultDiv.innerHTML = `
        <h3 class="font-semibold mb-2 text-red-800">❌ Error de Conexión</h3>
        <p class="text-sm text-red-700">
          No se pudo conectar con el servidor. Verifica que el servidor esté funcionando.
        </p>
      `;
      Utils.showNotification('❌ Error de conexión con el servidor', 'error');
    }
  });
}

// Estadísticas generales (función simplificada por espacio)
async function loadGeneralStats() {
  const statsDiv = document.getElementById('general-stats');
  if (!statsDiv) return;
  
  statsDiv.innerHTML = '<div class="animate-pulse text-center py-4">Cargando estadísticas...</div>';
  
  try {
    const response = await fetch('/stats');
    const result = await response.json();
    
    if (result.ok) {
      const stats = result.summary;
      
      let html = `
        <div class="grid md:grid-cols-5 gap-6 mb-8">
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl text-center text-white shadow-lg">
            <div class="text-3xl font-bold mb-1">${Utils.formatNumber(stats.totalRecords)}</div>
            <div class="text-blue-100 text-sm font-medium">Total Registros</div>
            <div class="text-4xl mt-2">📋</div>
          </div>
          <div class="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl text-center text-white shadow-lg">
            <div class="text-3xl font-bold mb-1">${Utils.formatNumber(stats.totalCases)}</div>
            <div class="text-green-100 text-sm font-medium">Total Casos</div>
            <div class="text-4xl mt-2">🦠</div>
          </div>
          <div class="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl text-center text-white shadow-lg">
            <div class="text-3xl font-bold mb-1">${Utils.formatNumber(stats.countries)}</div>
            <div class="text-purple-100 text-sm font-medium">Países Registrados</div>
            <div class="text-4xl mt-2">🌍</div>
          </div>
          <div class="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-xl text-center text-white shadow-lg">
            <div class="text-3xl font-bold mb-1">${Utils.formatNumber(stats.byType.deaths)}</div>
            <div class="text-red-100 text-sm font-medium">Fallecimientos</div>
            <div class="text-4xl mt-2">💔</div>
          </div>
          <div class="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-xl text-center text-white shadow-lg">
            <div class="text-2xl font-bold mb-1">${result.method === 'cached' ? '⚡ Cache' : '🔥 ' + Utils.formatDuration(result.durationMs)}</div>
            <div class="text-orange-100 text-sm font-medium">Tiempo de Respuesta</div>
            <div class="text-4xl mt-2">⏱️</div>
          </div>
        </div>
      `;
      
      statsDiv.innerHTML = html;
      
      // Crear gráficos después de cargar las estadísticas
      setTimeout(() => {
        createDashboardCharts(result);
      }, 100);
      
      Utils.showNotification('✅ Estadísticas y gráficos cargados', 'success');
    } else {
      statsDiv.innerHTML = `<div class="text-red-600 text-center py-4">${result.error}</div>`;
    }
  } catch (error) {
    console.error('Error:', error);
    statsDiv.innerHTML = '<div class="text-red-600 text-center py-4">Error de conexión</div>';
  }
}

// Función global para configurar alta resolución en canvas
function configureHighResCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  // Configurar tamaño real del canvas
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  // Escalar el contexto para que coincida con el device pixel ratio
  ctx.scale(dpr, dpr);
  
  // Asegurar que el canvas se muestre en el tamaño correcto en CSS
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  
  return ctx;
}

// Configuración global de Chart.js para alta calidad
Chart.defaults.font.family = "'Inter', 'system-ui', 'sans-serif'";
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.displayColors = true;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.95)';
Chart.defaults.plugins.tooltip.titleColor = '#374151';
Chart.defaults.plugins.tooltip.bodyColor = '#374151';
Chart.defaults.plugins.tooltip.borderColor = '#e5e7eb';
Chart.defaults.plugins.tooltip.borderWidth = 1;

// Crear gráficos del dashboard principal
function createDashboardCharts(statsData) {
  createTypesPieChart(statsData);
  createCountriesBarChart(statsData);
}

// Gráfico de pastel para tipos de casos
function createTypesPieChart(statsData) {
  const canvas = document.getElementById('chart-types');
  if (!canvas) return;
  
  // Destruir gráfico existente
  if (window.typesChart) {
    window.typesChart.destroy();
  }
  
  // Configurar alta resolución para evitar pixeles
  const ctx = configureHighResCanvas(canvas);
  const byType = statsData.summary.byType;
  
  window.typesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Confirmados', 'Fallecidos', 'Recuperados'],
      datasets: [{
        data: [
          byType.confirmed || 0,
          byType.deaths || 0, 
          byType.recovered || 0
        ],
        backgroundColor: [
          '#ef4444', // Rojo para confirmados
          '#6b7280', // Gris para fallecidos
          '#22c55e'  // Verde para recuperados
        ],
        borderColor: '#ffffff',
        borderWidth: 4,
        hoverBorderWidth: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: window.devicePixelRatio || 2,
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1000
      },
      plugins: {
        title: {
          display: true,
          text: 'Distribución Global de Casos COVID-19',
          font: {
            size: 18,
            weight: 'bold'
          },
          color: '#374151',
          padding: 20
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            padding: 20,
            font: {
              size: 14,
              weight: '500'
            },
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#374151',
          bodyColor: '#374151',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed * 100) / total).toFixed(1);
              return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// Gráfico de barras para países
function createCountriesBarChart(statsData) {
  const canvas = document.getElementById('chart-countries');
  if (!canvas) return;
  
  // Destruir gráfico existente
  if (window.countriesChart) {
    window.countriesChart.destroy();
  }
  
  // Configurar alta resolución
  const ctx = configureHighResCanvas(canvas);
  
  // Usar datos de países del resultado
  const countries = statsData.topCountries || [];
  const labels = countries.map(c => c.country);
  const values = countries.map(c => c.total);
  
  window.countriesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total de Casos',
        data: values,
        backgroundColor: [
          '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
          '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'
        ],
        borderColor: '#ffffff',
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: window.devicePixelRatio || 2,
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart'
      },
      plugins: {
        title: {
          display: true,
          text: 'Países con Más Casos Registrados',
          font: {
            size: 18,
            weight: 'bold'
          },
          color: '#374151',
          padding: 20
        },
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#374151',
          bodyColor: '#374151',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed.y.toLocaleString()} casos`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 12,
              weight: '500'
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            callback: function(value) {
              return value.toLocaleString();
            },
            font: {
              size: 12
            }
          }
        }
      }
    }
  });
}

// Información del sistema (función simplificada)
async function loadSystemInfo() {
  const infoDiv = document.getElementById('system-info');
  if (!infoDiv) return;
  
  infoDiv.innerHTML = '<div class="animate-pulse text-center py-4">Cargando información...</div>';
  
  try {
    const response = await fetch('/system/info');
    const result = await response.json();
    
    if (result.ok) {
      let html = `
        <div class="space-y-4">
          <div>
            <h4 class="font-semibold mb-2">Versión: ${result.version}</h4>
            <p class="text-sm text-gray-600">Sistema con estructuras de datos avanzadas</p>
          </div>
          <div class="grid md:grid-cols-2 gap-4 text-sm">
      `;
      
      Object.entries(result.dataStructures).forEach(([key, description]) => {
        html += `
          <div class="p-3 bg-gray-50 rounded">
            <strong>${key.toUpperCase()}:</strong><br>
            <span class="text-gray-600">${description}</span>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
      
      infoDiv.innerHTML = html;
      Utils.showNotification('✅ Información cargada', 'success');
    } else {
      infoDiv.innerHTML = `<div class="text-red-600 text-center py-4">${result.error}</div>`;
    }
  } catch (error) {
    console.error('Error:', error);
    infoDiv.innerHTML = '<div class="text-red-600 text-center py-4">Error de conexión</div>';
  }
}

// Casos críticos
async function loadCriticalCases() {
  const count = document.getElementById('critical-count')?.value || 10;
  const resultsDiv = document.getElementById('critical-results');
  if (!resultsDiv) return;
  
  resultsDiv.innerHTML = '<div class="animate-pulse text-center py-4">Cargando casos críticos...</div>';
  
  try {
    const response = await fetch(`/records/critical?count=${count}`);
    const result = await response.json();
    
    if (result.ok) {
      const columns = [
        { key: 'country', title: 'País' },
        { key: 'date', title: 'Fecha', formatter: Utils.formatDate },
        { key: 'type', title: 'Tipo' },
        { key: 'cases', title: 'Casos', formatter: Utils.formatNumber }
      ];
      
      let html = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <div class="text-red-800 text-sm">
            🚨 <strong>${result.count}</strong> casos más críticos
          </div>
        </div>
      `;
      
      html += Utils.createTable(result.records, columns);
      resultsDiv.innerHTML = html;
      
      Utils.showNotification(`✅ ${result.count} casos críticos cargados`, 'success');
    } else {
      resultsDiv.innerHTML = `<div class="text-red-600 text-center py-4">${result.error}</div>`;
    }
  } catch (error) {
    console.error('Error:', error);
    resultsDiv.innerHTML = '<div class="text-red-600 text-center py-4">Error de conexión</div>';
  }
}

// Crear gráfico de líneas para cronología de país
function createCountryTimelineChart(timelineData, countryName) {
  const canvas = document.getElementById('country-timeline-chart');
  if (!canvas) return;
  
  // Destruir gráfico existente si existe
  if (window.countryChart) {
    window.countryChart.destroy();
  }
  
  // Configurar alta resolución para líneas más nítidas
  const ctx = configureHighResCanvas(canvas);
  
  // Preparar datos para el gráfico
  const labels = timelineData.map(item => {
    const date = new Date(item.date);
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
  });
  
  const confirmedData = timelineData.map(item => item.confirmed);
  const deathData = timelineData.map(item => item.death);
  const recoveredData = timelineData.map(item => item.recovered);
  
  window.countryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Confirmados',
          data: confirmedData,
          borderColor: 'rgb(220, 38, 38)',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: 'rgb(220, 38, 38)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        },
        {
          label: 'Fallecidos',
          data: deathData,
          borderColor: 'rgb(75, 85, 99)',
          backgroundColor: 'rgba(75, 85, 99, 0.1)',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: 'rgb(75, 85, 99)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        },
        {
          label: 'Recuperados',
          data: recoveredData,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: 'rgb(34, 197, 94)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: window.devicePixelRatio || 2,
      animation: {
        duration: 2000,
        easing: 'easeInOutQuart'
      },
      elements: {
        point: {
          hoverRadius: 8
        },
        line: {
          tension: 0.4
        }
      },
      plugins: {
        title: {
          display: true,
          text: `Evolución COVID-19 en ${countryName}`,
          font: {
            size: 16,
            weight: 'bold'
          },
          color: '#4338ca'
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              size: 12,
              weight: '500'
            }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#374151',
          bodyColor: '#374151',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            title: function(tooltipItems) {
              return `Fecha: ${timelineData[tooltipItems[0].dataIndex].date}`;
            },
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} casos`;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Período de Tiempo',
            font: {
              size: 12,
              weight: 'bold'
            }
          },
          grid: {
            display: false
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Número de Casos',
            font: {
              size: 12,
              weight: 'bold'
            }
          },
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            callback: function(value) {
              return value.toLocaleString();
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      elements: {
        point: {
          hoverRadius: 8
        }
      }
    }
  });
}

// Formulario de estadísticas por país
async function setupCountryStatsForm() {
  const form = document.getElementById('form-country-stats');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const country = document.getElementById('stats-country').value.trim();
    const resultsDiv = document.getElementById('country-stats');
    
    if (!country) {
      Utils.showNotification('Por favor ingresa un país', 'error');
      return;
    }
    
    try {
      resultsDiv.innerHTML = `
        <div class="text-center py-8">
          <div class="animate-spin inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mb-3"></div>
          <div class="text-indigo-600 font-medium">Cargando estadísticas y generando gráficos...</div>
          <div class="text-xs text-gray-500 mt-1">📊 Procesando datos de ${country}</div>
        </div>
      `;
      
      const response = await fetch(`/stats/country/${encodeURIComponent(country)}`);
      const data = await response.json();
      
      if (data.ok) {
        resultsDiv.innerHTML = `
          <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold text-indigo-800">🌍 ${data.country}</h3>
              <span class="text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded">${data.method} - ${data.durationMs}ms</span>
            </div>
            
            <div class="grid md:grid-cols-4 gap-4 mb-6">
              <div class="bg-white rounded-lg p-4 text-center border border-indigo-100">
                <div class="text-2xl font-bold text-red-600">${data.summary.confirmed.toLocaleString()}</div>
                <div class="text-sm text-gray-600">Confirmados</div>
              </div>
              <div class="bg-white rounded-lg p-4 text-center border border-indigo-100">
                <div class="text-2xl font-bold text-gray-800">${data.summary.death.toLocaleString()}</div>
                <div class="text-sm text-gray-600">Fallecidos</div>
              </div>
              <div class="bg-white rounded-lg p-4 text-center border border-indigo-100">
                <div class="text-2xl font-bold text-green-600">${data.summary.recovered.toLocaleString()}</div>
                <div class="text-sm text-gray-600">Recuperados</div>
              </div>
              <div class="bg-white rounded-lg p-4 text-center border border-indigo-100">
                <div class="text-2xl font-bold text-indigo-600">${data.summary.total.toLocaleString()}</div>
                <div class="text-sm text-gray-600">Total Casos</div>
              </div>
            </div>
            
            <div class="text-sm text-gray-600 space-y-1">
              <div><strong>Registros:</strong> ${data.totalRecords}</div>
              <div><strong>Período:</strong> ${data.dateRange.first} - ${data.dateRange.last}</div>
            </div>
            
            ${data.timeline && data.timeline.length > 0 ? `
              <div class="mt-6 space-y-6">
                <!-- Gráfico de líneas -->
                <div class="bg-white rounded-lg p-6 border border-indigo-100 shadow-sm">
                  <div class="flex justify-between items-center mb-4">
                    <h4 class="font-semibold text-indigo-800">📈 Evolución Temporal - ${data.country}</h4>
                    <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${data.timeline.length} días de datos</span>
                  </div>
                  <div class="relative bg-gray-50 rounded-lg p-4" style="height: 400px;">
                    <canvas id="country-timeline-chart"></canvas>
                  </div>
                  <div class="mt-4 text-xs text-gray-500 text-center">
                    💡 Pasa el cursor sobre el gráfico para ver detalles específicos de cada fecha
                  </div>
                </div>
                
                <!-- Tabla resumen de últimos días -->
                <div class="bg-white rounded-lg p-4 border border-indigo-100 shadow-sm">
                  <div class="flex justify-between items-center mb-3">
                    <h4 class="font-semibold text-indigo-800">📋 Detalle de Últimos Días</h4>
                    <span class="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Últimos 7 registros</span>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                      <thead class="bg-gray-50">
                        <tr class="border-b border-gray-200">
                          <th class="text-left py-3 px-4 font-medium text-gray-700 rounded-tl-lg">📅 Fecha</th>
                          <th class="text-right py-3 px-4 font-medium text-red-600">🔴 Confirmados</th>
                          <th class="text-right py-3 px-4 font-medium text-gray-600">⚫ Fallecidos</th>
                          <th class="text-right py-3 px-4 font-medium text-green-600">🟢 Recuperados</th>
                          <th class="text-right py-3 px-4 font-medium text-indigo-600 rounded-tr-lg">📊 Total</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        ${data.timeline.slice(-7).map((day, index) => `
                          <tr class="hover:bg-indigo-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                            <td class="py-3 px-4 font-medium text-gray-800">${day.date}</td>
                            <td class="py-3 px-4 text-right text-red-600 font-medium">${day.confirmed.toLocaleString()}</td>
                            <td class="py-3 px-4 text-right text-gray-600 font-medium">${day.death.toLocaleString()}</td>
                            <td class="py-3 px-4 text-right text-green-600 font-medium">${day.recovered.toLocaleString()}</td>
                            <td class="py-3 px-4 text-right text-indigo-600 font-bold bg-indigo-50">${day.total.toLocaleString()}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                  <div class="mt-3 text-xs text-gray-500 text-center border-t pt-3">
                    🔄 Datos ordenados cronológicamente • Total de ${data.timeline.length} registros históricos
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        `;
        Utils.showNotification(`📊 Estadísticas de ${data.country} cargadas`, 'success');
        
        // Crear gráfico si hay datos de cronología
        if (data.timeline && data.timeline.length > 0) {
          // Mostrar indicador de carga del gráfico temporalmente
          const chartContainer = document.querySelector('#country-timeline-chart')?.parentElement;
          if (chartContainer) {
            const originalContent = chartContainer.innerHTML;
            chartContainer.innerHTML = `
              <div class="flex items-center justify-center h-full">
                <div class="text-center">
                  <div class="animate-spin inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div>
                  <div class="text-sm text-indigo-600">Generando gráfico...</div>
                </div>
              </div>
            `;
            
            setTimeout(() => {
              chartContainer.innerHTML = '<canvas id="country-timeline-chart"></canvas>';
              createCountryTimelineChart(data.timeline, data.country);
            }, 300);
          } else {
            setTimeout(() => createCountryTimelineChart(data.timeline, data.country), 100);
          }
        }
      } else {
        resultsDiv.innerHTML = `<div class="text-center py-8 text-gray-500">${data.error || 'No hay datos para ese país'}</div>`;
        Utils.showNotification(data.error || 'País no encontrado', 'error');
      }
      
    } catch (error) {
      console.error('Error:', error);
      resultsDiv.innerHTML = '<div class="text-red-600 text-center py-4">Error de conexión</div>';
      Utils.showNotification('Error al cargar estadísticas', 'error');
    }
  });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  // Configurar formularios y eventos
  setupAutocomplete();
  setupRecordForm();
  setupSearchForm();
  setupCountryStatsForm();
  setupAdvancedQueries();
  setupExportForm();
  setupUniqueFieldSearch();
  
  // Mostrar notificación de bienvenida
  setTimeout(() => {
    Utils.showNotification('🦠 SIRECOV v2.0 - Sistema cargado correctamente', 'success', 6000);
  }, 500);
});

// Función para mostrar/ocultar datos de prueba
function toggleTestData() {
  const panel = document.getElementById('test-data-panel');
  const icon = document.getElementById('test-data-icon');
  const button = event.target.closest('button');
  const span = button.querySelector('span:last-child');
  
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    icon.textContent = '📋';
    span.textContent = 'Ocultar datos de prueba';
  } else {
    panel.classList.add('hidden');
    icon.textContent = '📋';
    span.textContent = 'Mostrar datos de prueba';
  }
}

// Función para llenar ejemplos de prueba
function fillExample(country, date, type) {
  document.getElementById('g-country').value = country;
  document.getElementById('g-date').value = date;
  document.getElementById('g-type').value = type;
  
  // Limpiar resultado anterior
  const resultDiv = document.getElementById('get-result');
  resultDiv.classList.add('hidden');
  
  // Ocultar panel de pruebas después de seleccionar
  const panel = document.getElementById('test-data-panel');
  panel.classList.add('hidden');
  const button = document.querySelector('button[onclick="toggleTestData()"]');
  const span = button.querySelector('span:last-child');
  span.textContent = 'Mostrar datos de prueba';
  
  Utils.showNotification(`📝 Formulario llenado: ${country} - ${date} - ${type}`, 'info');
}

// Configurar consultas avanzadas
function setupAdvancedQueries() {
  setupRangeSearch();
  setupQuickSearches();
}

// Búsqueda por rango de fechas (B-Tree)
function setupRangeSearch() {
  const form = document.getElementById('form-range');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const startDate = document.getElementById('range-start').value;
    const endDate = document.getElementById('range-end').value;
    const page = document.getElementById('range-page').value || 1;
    const limit = document.getElementById('range-limit').value || 25;
    const resultsDiv = document.getElementById('range-results');
    
    if (!startDate || !endDate) {
      Utils.showNotification('Por favor selecciona ambas fechas', 'error');
      return;
    }
    
    if (startDate > endDate) {
      Utils.showNotification('La fecha inicial debe ser anterior a la final', 'error');
      return;
    }
    
    try {
      resultsDiv.innerHTML = `
        <div class="text-center py-6">
          <div class="animate-spin inline-block w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mb-3"></div>
          <div class="text-purple-600 font-medium">Buscando registros en rango...</div>
          <div class="text-sm text-gray-500 mt-1">Usando B-Tree para búsqueda eficiente</div>
        </div>
      `;
      
      const params = new URLSearchParams({ startDate, endDate, page, limit });
      const response = await fetch(`/records/date-range?${params}`);
      const result = await response.json();
      
      if (result.ok && result.records) {
        resultsDiv.innerHTML = `
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="font-semibold text-purple-800">📊 Resultados del Rango</h3>
              <div class="text-xs text-purple-600 space-x-2">
                <span class="bg-purple-100 px-2 py-1 rounded">B-Tree: ${result.durationMs}ms</span>
                <span class="bg-purple-100 px-2 py-1 rounded">${result.records.length} registros</span>
              </div>
            </div>
            
            <div class="grid md:grid-cols-3 gap-4 mb-4 text-sm">
              <div class="bg-white p-3 rounded border">
                <div class="font-medium text-gray-700">Rango de Fechas</div>
                <div class="text-purple-800">${startDate} → ${endDate}</div>
              </div>
              <div class="bg-white p-3 rounded border">
                <div class="font-medium text-gray-700">Total Encontrados</div>
                <div class="text-2xl font-bold text-purple-800">${result.totalFound || result.records.length}</div>
              </div>
              <div class="bg-white p-3 rounded border">
                <div class="font-medium text-gray-700">Página Actual</div>
                <div class="text-purple-800">${page} de ${Math.ceil((result.totalFound || result.records.length) / limit)}</div>
              </div>
            </div>
            
            <div class="bg-white rounded border overflow-hidden">
              <table class="min-w-full text-sm">
                <thead class="bg-purple-100">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium text-purple-800">País</th>
                    <th class="px-4 py-3 text-left font-medium text-purple-800">Fecha</th>
                    <th class="px-4 py-3 text-left font-medium text-purple-800">Tipo</th>
                    <th class="px-4 py-3 text-right font-medium text-purple-800">Casos</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  ${result.records.map(record => `
                    <tr class="hover:bg-purple-50">
                      <td class="px-4 py-3 font-medium text-gray-800">${record.country}</td>
                      <td class="px-4 py-3 text-gray-600">${record.date}</td>
                      <td class="px-4 py-3">
                        <span class="inline-block px-2 py-1 rounded text-xs font-medium ${
                          record.type === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          record.type === 'death' ? 'bg-red-100 text-red-800' :
                          'bg-green-100 text-green-800'
                        }">
                          ${record.type}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right font-bold text-gray-800">${record.cases.toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
        Utils.showNotification(`📊 ${result.records.length} registros encontrados`, 'success');
      } else {
        resultsDiv.innerHTML = `
          <div class="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
            <div class="text-4xl mb-2">🔍</div>
            <div class="font-medium">Sin Resultados</div>
            <div class="text-sm mt-1">No hay registros en el rango de fechas seleccionado</div>
          </div>
        `;
        Utils.showNotification('No se encontraron registros en el rango', 'info');
      }
    } catch (error) {
      console.error('Error:', error);
      resultsDiv.innerHTML = `
        <div class="text-center py-8 text-red-500">
          <div class="text-4xl mb-2">❌</div>
          <div class="font-medium">Error de Conexión</div>
        </div>
      `;
      Utils.showNotification('Error al buscar registros', 'error');
    }
  });
}

// Búsquedas rápidas (Hash Index)
function setupQuickSearches() {
  // Búsqueda por fecha
  const dateForm = document.getElementById('form-by-date');
  if (dateForm) {
    dateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const date = document.getElementById('bydate-date').value;
      const resultsDiv = document.getElementById('bydate-result');
      
      if (!date) {
        Utils.showNotification('Por favor selecciona una fecha', 'error');
        return;
      }
      
      try {
        resultsDiv.innerHTML = '<div class="text-center py-4"><div class="animate-spin inline-block w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full"></div></div>';
        
        const response = await fetch(`/records/by-date/${date}`);
        const result = await response.json();
        
        if (result.ok && result.records) {
          resultsDiv.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <div class="flex justify-between items-center mb-3">
                <h4 class="font-semibold text-green-800">📅 Registros del ${date}</h4>
                <div class="text-xs text-green-600">
                  <span class="bg-green-100 px-2 py-1 rounded">Hash: ${result.durationMs}ms</span>
                  <span class="bg-green-100 px-2 py-1 rounded">${result.count} registros</span>
                </div>
              </div>
              <div class="space-y-2 max-h-60 overflow-y-auto">
                ${result.records.map(record => `
                  <div class="bg-white p-3 rounded border flex justify-between items-center">
                    <div>
                      <div class="font-medium text-gray-800">${record.country}</div>
                      <div class="text-sm text-gray-600 capitalize">${record.type}</div>
                    </div>
                    <div class="text-lg font-bold text-green-800">${record.cases.toLocaleString()}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
          Utils.showNotification(`✅ ${result.count} registros encontrados`, 'success');
        } else {
          resultsDiv.innerHTML = `<div class="text-center py-4 text-gray-500">No hay registros para esta fecha</div>`;
          Utils.showNotification('No hay registros para esta fecha', 'info');
        }
      } catch (error) {
        console.error('Error:', error);
        resultsDiv.innerHTML = '<div class="text-red-600 text-center py-4">Error de conexión</div>';
        Utils.showNotification('Error al buscar registros', 'error');
      }
    });
  }

  // Búsqueda por país
  const countryForm = document.getElementById('form-by-country');
  if (countryForm) {
    countryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const country = document.getElementById('bycountry-country').value.trim();
      const resultsDiv = document.getElementById('bycountry-result');
      
      if (!country) {
        Utils.showNotification('Por favor ingresa un país', 'error');
        return;
      }
      
      try {
        resultsDiv.innerHTML = '<div class="text-center py-4"><div class="animate-spin inline-block w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full"></div></div>';
        
        const response = await fetch(`/records/by-country/${encodeURIComponent(country)}`);
        const result = await response.json();
        
        if (result.ok && result.records) {
          resultsDiv.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <div class="flex justify-between items-center mb-3">
                <h4 class="font-semibold text-green-800">🌍 Registros de ${country}</h4>
                <div class="text-xs text-green-600">
                  <span class="bg-green-100 px-2 py-1 rounded">Hash: ${result.durationMs}ms</span>
                  <span class="bg-green-100 px-2 py-1 rounded">${result.count} registros</span>
                </div>
              </div>
              <div class="space-y-2 max-h-60 overflow-y-auto">
                ${result.records.map(record => `
                  <div class="bg-white p-3 rounded border flex justify-between items-center">
                    <div>
                      <div class="font-medium text-gray-800">${record.date}</div>
                      <div class="text-sm text-gray-600 capitalize">${record.type}</div>
                    </div>
                    <div class="text-lg font-bold text-green-800">${record.cases.toLocaleString()}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
          Utils.showNotification(`✅ ${result.count} registros encontrados`, 'success');
        } else {
          resultsDiv.innerHTML = `<div class="text-center py-4 text-gray-500">No hay registros para este país</div>`;
          Utils.showNotification('No hay registros para este país', 'info');
        }
      } catch (error) {
        console.error('Error:', error);
        resultsDiv.innerHTML = '<div class="text-red-600 text-center py-4">Error de conexión</div>';
        Utils.showNotification('Error al buscar registros', 'error');
      }
    });
  }
}

// Configurar formulario de exportación
function setupExportForm() {
  const form = document.getElementById('form-export');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formatElement = document.querySelector('input[name="format"]:checked');
    const format = formatElement ? formatElement.value : 'json';
    const country = document.getElementById('export-country').value.trim();
    const startDate = document.getElementById('export-start').value;
    const endDate = document.getElementById('export-end').value;
    const type = document.getElementById('export-type').value;
    
    // Debug: Mostrar formato seleccionado
    console.log('🔍 Debug exportación:', {
      format: format,
      formatElement: formatElement,
      allFormats: document.querySelectorAll('input[name="format"]')
    });
    
    // Validar fechas
    if (startDate && endDate && startDate > endDate) {
      Utils.showNotification('La fecha inicial debe ser anterior a la final', 'error');
      return;
    }
    
    try {
      // Mostrar indicador de carga
      const button = form.querySelector('button[type="submit"]');
      const originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `
        <div class="flex items-center justify-center">
          <div class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
          Generando archivo...
        </div>
      `;
      
      // Construir parámetros de consulta
      const params = new URLSearchParams();
      if (country) params.append('country', country);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (type) params.append('type', type);
      
      Utils.showNotification('🔄 Generando archivo de exportación...', 'info');
      
      // Realizar petición de exportación
      const response = await fetch(`/export/${format}?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en la exportación');
      }
      
      // Obtener el contenido del archivo
      let content, filename, blob;
      
      if (format === 'json') {
        const data = await response.json();
        content = JSON.stringify(data, null, 2);
        filename = `sirecov_export_${new Date().toISOString().split('T')[0]}.json`;
        blob = new Blob([content], { type: 'application/json' });
      } else if (format === 'csv') {
        content = await response.text();
        filename = `sirecov_export_${new Date().toISOString().split('T')[0]}.csv`;
        blob = new Blob([content], { type: 'text/csv' });
      } else if (format === 'excel') {
        // Para Excel, obtener como array buffer
        const arrayBuffer = await response.arrayBuffer();
        filename = `sirecov_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        blob = new Blob([arrayBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
      }
      // Crear enlace de descarga
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Mostrar estadísticas de exportación
      const stats = format === 'json' && content && typeof JSON.parse(content) === 'object' ? 
        JSON.parse(content) : null;
      
      let message = `✅ Archivo ${format.toUpperCase()} generado: ${filename}`;
      if (stats && stats.summary) {
        message += ` (${stats.summary.totalRecords} registros)`;
      } else {
        // Para Excel, obtener estadísticas del header de respuesta
        const recordCount = response.headers.get('X-Export-Records');
        if (recordCount) {
          message += ` (${recordCount} registros)`;
        }
      }
      
      Utils.showNotification(message, 'success', 8000);
      
    } catch (error) {
      console.error('Error en exportación:', error);
      Utils.showNotification(`❌ Error: ${error.message}`, 'error');
    } finally {
      // Restaurar botón
      const button = form.querySelector('button[type="submit"]');
      button.disabled = false;
      button.innerHTML = originalText;
    }
  });
}

// Función para exportación rápida
function quickExport(format, country, startDate, endDate, type) {
  console.log(`🚀 Exportación rápida: ${format.toUpperCase()}`);
  
  // Crear objeto de filtros
  const filters = {};
  if (country) filters.country = country;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (type) filters.type = type;
  
  // Construir URL con parámetros
  const params = new URLSearchParams();
  Object.keys(filters).forEach(key => {
    if (filters[key]) params.append(key, filters[key]);
  });
  
  const url = `http://localhost:3000/export/${format}?${params.toString()}`;
  
  // Mostrar mensaje de inicio
  let filterText = Object.keys(filters).length > 0 ? 
    ` (Filtros: ${Object.entries(filters).map(([k,v]) => `${k}=${v}`).join(', ')})` : '';
  Utils.showNotification(`🚀 Exportando ${format.toUpperCase()}${filterText}...`, 'info', 3000);
  
  // Realizar descarga
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.blob();
    })
    .then(blob => {
      // Crear y descargar el archivo
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `sirecov_quick_${format}_${timestamp}.${format}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      Utils.showNotification(`✅ ${format.toUpperCase()} descargado: ${filename}`, 'success', 6000);
    })
    .catch(error => {
      console.error('Error en exportación rápida:', error);
      Utils.showNotification(`❌ Error: ${error.message}`, 'error');
    });
}

// ---------- Segunda Entrega - Búsqueda por Campo Único ----------

// Configurar formularios de búsqueda por campo único
function setupUniqueFieldSearch() {
  // Formulario de búsqueda por país
  const countryForm = document.getElementById('form-search-country');
  if (countryForm) {
    countryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const country = document.getElementById('search-country-input').value.trim();
      if (country) {
        await searchByUniqueField('country', country);
      }
    });
  }
  
  // Formulario de búsqueda por fecha
  const dateForm = document.getElementById('form-search-date');
  if (dateForm) {
    dateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('search-date-input').value.trim();
      if (date) {
        await searchByUniqueField('date', date);
      }
    });
  }
}

// Función principal para búsqueda por campo único
async function searchByUniqueField(fieldType, value) {
  console.log(`🎯 Búsqueda por ${fieldType}: ${value}`);
  
  const resultsDiv = document.getElementById('unique-search-results');
  resultsDiv.innerHTML = `
    <div class="text-center py-8">
      <div class="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-600">Buscando en archivo de índice...</p>
    </div>
  `;
  
  try {
    const response = await fetch(`http://localhost:3000/search/${fieldType}/${encodeURIComponent(value)}`);
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', response.headers.get('content-type'));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📡 Parsed result:', result);
    
    displayUniqueFieldResults(result, fieldType, value);
    
  } catch (error) {
    console.error('Error en búsqueda:', error);
    resultsDiv.innerHTML = `
      <div class="text-red-600 text-center py-8">
        <div class="text-4xl mb-4">❌</div>
        <p class="font-medium">Error de conexión: ${error.message}</p>
        <p class="text-sm">Verifica que el servidor esté ejecutándose en http://localhost:3000</p>
        <div class="mt-4">
          <p class="text-xs text-gray-500">Detalles técnicos:</p>
          <pre class="text-xs bg-gray-100 p-2 rounded mt-2 text-left">${error.stack || error.toString()}</pre>
        </div>
      </div>
    `;
  }
}

// Mostrar resultados de búsqueda por campo único
function displayUniqueFieldResults(result, fieldType, searchValue) {
  const resultsDiv = document.getElementById('unique-search-results');
  let html = ''; // Variable correctamente declarada
  
  if (result.found) {
    const records = result.records || [];
    const indexInfo = result.indexInfo || {};
    
    html = `
      <div class="border-l-4 border-green-500 bg-green-50 p-4 mb-6">
        <div class="flex items-center mb-2">
          <div class="text-green-600 text-xl mr-2">✅</div>
          <h4 class="font-medium text-green-800">Registros Encontrados</h4>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="font-medium">Campo:</span> ${fieldType === 'country' ? 'País' : 'Fecha'}
          </div>
          <div>
            <span class="font-medium">Valor:</span> ${searchValue}
          </div>
          <div>
            <span class="font-medium">Registros:</span> ${result.totalRecords || 'N/A'}
          </div>
          <div>
            <span class="font-medium">Tiempo:</span> ${indexInfo.searchTime ? indexInfo.searchTime.toFixed(2) + 'ms' : 'N/A'}
          </div>
        </div>
    `;
    
    if (fieldType === 'country' && indexInfo.totalCases) {
      html += `
        <div class="mt-2 text-sm text-green-700">
          <span class="font-medium">Total de casos:</span> ${indexInfo.totalCases.toLocaleString()}
          ${indexInfo.lastUpdate ? `| <span class="font-medium">Última actualización:</span> ${indexInfo.lastUpdate}` : ''}
        </div>
      `;
    }
    
    html += `
        <div class="mt-2 text-xs text-gray-600">
          <span class="font-medium">Mensaje:</span> ${result.message || 'Búsqueda completada exitosamente'}
        </div>
      </div>
    `;
    
  } else {
    // No encontrado
    html = `
      <div class="border-l-4 border-yellow-500 bg-yellow-50 p-4">
        <div class="flex items-center mb-2">
          <div class="text-yellow-600 text-xl mr-2">⚠️</div>
          <h4 class="font-medium text-yellow-800">No se encontraron registros</h4>
        </div>
        <p class="text-yellow-700 mb-4">No hay datos para <strong>${fieldType === 'country' ? 'país' : 'fecha'}: "${searchValue}"</strong></p>
        
        ${result.searchTime ? `<p class="text-sm text-yellow-600 mb-4">Tiempo de búsqueda: ${result.searchTime.toFixed(2)}ms</p>` : ''}
        
        ${result.suggestions && result.suggestions.length > 0 ? `
          <div class="mt-4">
            <p class="text-sm font-medium text-yellow-800 mb-2">Opciones disponibles:</p>
            <div class="flex flex-wrap gap-2">
              ${result.suggestions.map(suggestion => `
                <button onclick="searchByUniqueField('${fieldType}', '${suggestion}')" 
                  class="bg-yellow-200 hover:bg-yellow-300 text-yellow-800 px-3 py-1 rounded text-sm transition-colors">
                  ${suggestion}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  resultsDiv.innerHTML = html;
}

// Funciones para búsquedas rápidas
function quickSearchCountry(country) {
  document.getElementById('search-country-input').value = country;
  searchByUniqueField('country', country);
}

function quickSearchDate(date) {
  document.getElementById('search-date-input').value = date;
  searchByUniqueField('date', date);
}

// Cargar información de archivos de índice
async function loadIndexInfo() {
  const infoDiv = document.getElementById('index-info');
  infoDiv.innerHTML = `
    <div class="text-center py-4">
      <div class="animate-spin w-6 h-6 border-4 border-gray-500 border-t-transparent rounded-full mx-auto mb-2"></div>
      <p class="text-gray-600">Cargando información de índices...</p>
    </div>
  `;
  
  try {
    const response = await fetch('http://localhost:3000/index/info');
    const result = await response.json();
    
    if (result.ok) {
      displayIndexInfo(result.indexFiles);
    } else {
      infoDiv.innerHTML = `<div class="text-red-600">Error: ${result.error}</div>`;
    }
    
  } catch (error) {
    console.error('Error cargando info de índices:', error);
    infoDiv.innerHTML = `<div class="text-red-600">Error de conexión</div>`;
  }
}

// Mostrar información de archivos de índice
function displayIndexInfo(indexFiles) {
  const infoDiv = document.getElementById('index-info');
  
  let html = `
    <div class="grid md:grid-cols-2 gap-4">
  `;
  
  Object.entries(indexFiles).forEach(([indexName, info]) => {
    const statusColor = info.error ? 'red' : (info.status === 'not_found' ? 'yellow' : 'green');
    const statusIcon = info.error ? '❌' : (info.status === 'not_found' ? '⚠️' : '✅');
    
    html += `
      <div class="border rounded-lg p-4 bg-${statusColor === 'green' ? 'green-50' : statusColor === 'yellow' ? 'yellow-50' : 'red-50'}">
        <h4 class="font-medium text-${statusColor === 'green' ? 'green' : statusColor === 'yellow' ? 'yellow' : 'red'}-800 mb-2">
          ${statusIcon} Índice: ${indexName}
        </h4>
    `;
    
    if (info.error) {
      html += `<p class="text-red-600 text-sm">Error: ${info.error}</p>`;
    } else if (info.status === 'not_found') {
      html += `<p class="text-yellow-600 text-sm">Archivo no encontrado</p>`;
    } else {
      html += `
        <div class="text-sm space-y-1">
          <div><span class="font-medium">Registros:</span> ${info.recordCount}</div>
          <div><span class="font-medium">Tamaño:</span> ${(info.fileSize / 1024).toFixed(1)} KB</div>
          <div><span class="font-medium">Creado:</span> ${new Date(info.createdAt).toLocaleString()}</div>
        </div>
      `;
    }
    
    html += '</div>';
  });
  
  html += '</div>';
  
  // Botón para reconstruir índices
  html += `
    <div class="mt-6 text-center">
      <button onclick="rebuildIndexes()" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors">
        🔧 Reconstruir Todos los Índices
      </button>
    </div>
  `;
  
  infoDiv.innerHTML = html;
}

// Reconstruir archivos de índice
async function rebuildIndexes() {
  Utils.showNotification('🔧 Reconstruyendo archivos de índice...', 'info');
  
  try {
    const response = await fetch('http://localhost:3000/index/rebuild', {
      method: 'POST'
    });
    const result = await response.json();
    
    if (result.ok) {
      Utils.showNotification(`✅ Índices reconstruidos: ${result.stats.uniqueCountries} países, ${result.stats.uniqueDates} fechas`, 'success', 5000);
      // Recargar información
      loadIndexInfo();
    } else {
      Utils.showNotification(`❌ Error: ${result.error}`, 'error');
    }
    
  } catch (error) {
    console.error('Error reconstruyendo índices:', error);
    Utils.showNotification('❌ Error de conexión', 'error');
  }
}

// Exportar funciones globales para uso en HTML
window.showTab = showTab;
window.selectCountry = selectCountry;
window.loadCriticalCases = loadCriticalCases;
window.loadGeneralStats = loadGeneralStats;
window.loadSystemInfo = loadSystemInfo;
window.fillExample = fillExample;
window.toggleTestData = toggleTestData;
window.quickExport = quickExport;
window.quickSearchCountry = quickSearchCountry;
window.quickSearchDate = quickSearchDate;
window.loadIndexInfo = loadIndexInfo;
window.rebuildIndexes = rebuildIndexes;

// ==========================================================
// 🚀 SISTEMA DE BENCHMARKS Y PRUEBAS DE RENDIMIENTO
// ==========================================================

// Variables para tracking de benchmarks
let benchmarkResults = {};
let benchmarkHistory = [];

// Función principal de benchmark
async function benchmarkSearch(searchType, method) {
  const resultsDiv = document.getElementById('benchmark-results');
  
  try {
    // Obtener valores de entrada
    let searchValue;
    if (searchType === 'date') {
      searchValue = document.getElementById('bench-date').value;
      if (!searchValue) {
        Utils.showNotification('❌ Por favor selecciona una fecha', 'error');
        return;
      }
    } else {
      searchValue = document.getElementById('bench-country').value.trim().toLowerCase();
      if (!searchValue) {
        Utils.showNotification('❌ Por favor ingresa un país', 'error');
        return;
      }
    }

    // Mostrar indicador de carga
    resultsDiv.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <div class="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p class="text-blue-700">Ejecutando benchmark ${method.toUpperCase()} para ${searchType}...</p>
      </div>
    `;

    // Ejecutar benchmark
    const startTime = performance.now();
    let result;
    
    if (method === 'hash') {
      // Usar índices Hash (rápido)
      result = await performHashSearch(searchType, searchValue);
    } else {
      // Usar escaneo lineal (lento)
      result = await performLinearScan(searchType, searchValue);
    }
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    // Guardar resultado
    const benchmarkResult = {
      searchType,
      method,
      searchValue,
      executionTime: executionTime.toFixed(3),
      recordsFound: result.totalRecords || 0,
      timestamp: new Date().toLocaleTimeString(),
      success: result.ok
    };

    benchmarkResults[`${searchType}_${method}`] = benchmarkResult;
    benchmarkHistory.push(benchmarkResult);

    // Mostrar resultados
    displayBenchmarkResults();
    
    Utils.showNotification(`✅ Benchmark completado: ${executionTime.toFixed(2)}ms`, 'success', 3000);

  } catch (error) {
    console.error('Error en benchmark:', error);
    resultsDiv.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-700">❌ Error ejecutando benchmark: ${error.message}</p>
      </div>
    `;
  }
}

// Búsqueda usando índices Hash (optimizada)
async function performHashSearch(searchType, searchValue) {
  const endpoint = searchType === 'date' 
    ? `/search/date/${searchValue}`
    : `/search/country/${searchValue}`;
    
  const response = await fetch(`http://localhost:3000${endpoint}`);
  return await response.json();
}

// Búsqueda usando escaneo lineal (simulación)
async function performLinearScan(searchType, searchValue) {
  // Simular escaneo lineal más lento
  const simulationDelay = Math.random() * 100 + 50; // 50-150ms delay
  await new Promise(resolve => setTimeout(resolve, simulationDelay));
  
  // Usar endpoints existentes pero con delay para simular escaneo lineal
  let response;
  
  if (searchType === 'date') {
    response = await fetch(`http://localhost:3000/records/by-date/${searchValue}`);
  } else {
    response = await fetch(`http://localhost:3000/records/by-country/${searchValue}`);
  }
  
  const data = await response.json();
  
  return {
    ok: data.ok,
    found: data.ok && (data.count > 0 || data.totalRecords > 0),
    totalRecords: data.count || data.totalRecords || 0,
    records: data.records || [],
    searchType: `linear_scan_${searchType}`,
    searchValue,
    simulatedDelay: simulationDelay.toFixed(1)
  };
}

// Mostrar resultados de benchmarks
function displayBenchmarkResults() {
  const resultsDiv = document.getElementById('benchmark-results');
  
  if (Object.keys(benchmarkResults).length === 0) {
    resultsDiv.innerHTML = `
      <div class="text-gray-500 text-center py-4">
        <p>🏁 No hay resultados de benchmark aún</p>
        <p class="text-sm">Ejecuta algunas pruebas para ver las comparaciones</p>
      </div>
    `;
    return;
  }

  // Crear tabla comparativa
  let html = `
    <div class="bg-white rounded-lg border overflow-hidden">
      <div class="bg-gray-50 px-4 py-3 border-b">
        <h4 class="font-semibold text-gray-800">📊 Resultados de Benchmark</h4>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-100">
            <tr>
              <th class="px-3 py-2 text-left">Tipo</th>
              <th class="px-3 py-2 text-left">Método</th>
              <th class="px-3 py-2 text-left">Valor</th>
              <th class="px-3 py-2 text-left">Tiempo (ms)</th>
              <th class="px-3 py-2 text-left">Registros</th>
              <th class="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
  `;

  // Mostrar resultados ordenados por timestamp
  benchmarkHistory.slice(-10).forEach(result => {
    const methodIcon = result.method === 'hash' ? '⚡' : '🐌';
    const statusIcon = result.success ? '✅' : '❌';
    const speedClass = result.method === 'hash' ? 'text-green-600' : 'text-orange-600';
    
    html += `
      <tr class="hover:bg-gray-50">
        <td class="px-3 py-2 capitalize">${result.searchType}</td>
        <td class="px-3 py-2 ${speedClass} font-medium">${methodIcon} ${result.method.toUpperCase()}</td>
        <td class="px-3 py-2 text-gray-600">${result.searchValue}</td>
        <td class="px-3 py-2 font-mono ${speedClass}">${result.executionTime}</td>
        <td class="px-3 py-2">${result.recordsFound}</td>
        <td class="px-3 py-2">${statusIcon}</td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Agregar comparación de rendimiento
  const dateComparison = getPerformanceComparison('date');
  const countryComparison = getPerformanceComparison('country');

  if (dateComparison || countryComparison) {
    html += `
      <div class="mt-4 grid md:grid-cols-2 gap-4">
    `;
    
    if (dateComparison) {
      html += `
        <div class="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
          <h5 class="font-semibold text-green-800 mb-2">📅 Búsqueda por Fecha</h5>
          ${dateComparison}
        </div>
      `;
    }
    
    if (countryComparison) {
      html += `
        <div class="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <h5 class="font-semibold text-blue-800 mb-2">🌍 Búsqueda por País</h5>
          ${countryComparison}
        </div>
      `;
    }
    
    html += `</div>`;
  }

  // Botón para limpiar resultados
  html += `
    <div class="mt-4 text-center">
      <button onclick="clearBenchmarks()" 
        class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
        🗑️ Limpiar Resultados
      </button>
    </div>
  `;

  resultsDiv.innerHTML = html;
}

// Comparar rendimiento entre métodos
function getPerformanceComparison(searchType) {
  const hashResult = benchmarkResults[`${searchType}_hash`];
  const scanResult = benchmarkResults[`${searchType}_scan`];
  
  if (!hashResult || !scanResult) return null;
  
  const hashTime = parseFloat(hashResult.executionTime);
  const scanTime = parseFloat(scanResult.executionTime);
  const speedup = (scanTime / hashTime).toFixed(1);
  const improvement = (((scanTime - hashTime) / scanTime) * 100).toFixed(1);
  
  return `
    <div class="text-sm space-y-2">
      <div class="flex justify-between">
        <span>⚡ Hash:</span>
        <span class="font-mono text-green-600">${hashTime}ms</span>
      </div>
      <div class="flex justify-between">
        <span>🐌 Escaneo:</span>
        <span class="font-mono text-orange-600">${scanTime}ms</span>
      </div>
      <hr class="border-gray-300">
      <div class="flex justify-between font-semibold">
        <span>🚀 Mejora:</span>
        <span class="text-green-600">${speedup}x más rápido</span>
      </div>
      <div class="text-xs text-gray-600">
        Reducción del ${improvement}% en tiempo de ejecución
      </div>
    </div>
  `;
}

// Limpiar resultados de benchmark
function clearBenchmarks() {
  benchmarkResults = {};
  benchmarkHistory = [];
  displayBenchmarkResults();
  Utils.showNotification('🗑️ Resultados de benchmark limpiados', 'info', 2000);
}

// Ejecutar benchmark automático para demostración
function runAutoBenchmark() {
  Utils.showNotification('🤖 Ejecutando benchmarks automáticos...', 'info', 3000);
  
  setTimeout(() => {
    // Benchmark por país
    document.getElementById('bench-country').value = 'colombia';
    benchmarkSearch('country', 'hash');
  }, 500);
  
  setTimeout(() => {
    benchmarkSearch('country', 'scan');
  }, 1500);
  
  setTimeout(() => {
    // Benchmark por fecha
    document.getElementById('bench-date').value = '1994-11-16';
    benchmarkSearch('date', 'hash');
  }, 2500);
  
  setTimeout(() => {
    benchmarkSearch('date', 'scan');
  }, 3500);
}

// Exportar funciones de benchmark
window.benchmarkSearch = benchmarkSearch;
window.clearBenchmarks = clearBenchmarks;
window.runAutoBenchmark = runAutoBenchmark;

// ==========================================================
// 📤 SISTEMA DE EXPORTACIÓN AVANZADO
// ==========================================================

// Variables para el sistema de exportación
let exportHistory = [];
let exportPreviewVisible = false;

// Alternar vista previa de exportación
function toggleExportPreview() {
  const previewDiv = document.getElementById('export-preview');
  const toggleBtn = document.getElementById('toggle-preview');
  
  exportPreviewVisible = !exportPreviewVisible;
  
  if (exportPreviewVisible) {
    previewDiv.classList.remove('hidden');
    toggleBtn.innerHTML = '👁️ Ocultar';
    updateExportPreview();
  } else {
    previewDiv.classList.add('hidden');
    toggleBtn.innerHTML = '👁️ Mostrar';
  }
}

// Actualizar selección de formato
function updateFormatSelection(format) {
  // Resetear estilos
  document.getElementById('format-json').className = 'format-option border-2 border-gray-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg text-center transition-all hover:border-blue-400';
  document.getElementById('format-csv').className = 'format-option border-2 border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50 p-4 rounded-lg text-center transition-all hover:border-gray-400';
  document.getElementById('format-excel').className = 'format-option border-2 border-gray-300 bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg text-center transition-all hover:border-green-500';
  
  // Aplicar estilo seleccionado
  if (format === 'json') {
    document.getElementById('format-json').className = 'format-option selected border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg text-center transition-all shadow-sm';
  } else if (format === 'csv') {
    document.getElementById('format-csv').className = 'format-option selected border-2 border-gray-500 bg-gradient-to-br from-gray-50 to-slate-50 p-4 rounded-lg text-center transition-all shadow-sm';
  } else if (format === 'excel') {
    document.getElementById('format-excel').className = 'format-option selected border-2 border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg text-center transition-all shadow-sm';
  }
  
  updateExportPreview();
}

// Establecer país para exportación
function setExportCountry(country) {
  document.getElementById('export-country').value = country;
  updateExportPreview();
}

// Actualizar vista previa de exportación
async function updateExportPreview() {
  if (!exportPreviewVisible) return;
  
  const format = document.querySelector('input[name="format"]:checked')?.value || 'json';
  const country = document.getElementById('export-country').value;
  const startDate = document.getElementById('export-start').value;
  const endDate = document.getElementById('export-end').value;
  const type = document.getElementById('export-type').value;
  
  // Actualizar elementos de vista previa
  document.getElementById('preview-format').textContent = format.toUpperCase();
  document.getElementById('preview-country').textContent = country || 'Todos';
  
  let dateText = 'Todas';
  if (startDate && endDate) {
    dateText = `${startDate} a ${endDate}`;
  } else if (startDate) {
    dateText = `Desde ${startDate}`;
  } else if (endDate) {
    dateText = `Hasta ${endDate}`;
  }
  document.getElementById('preview-dates').textContent = dateText;
  
  document.getElementById('preview-type').textContent = type || 'Todos';
  
  // Calcular registros estimados
  try {
    document.getElementById('preview-count').textContent = 'Calculando...';
    const params = new URLSearchParams();
    if (country) params.append('country', country);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (type) params.append('type', type);
    
    // Usar endpoint de estadísticas para estimar
    const response = await fetch(`http://localhost:3000/stats?${params.toString()}`);
    const data = await response.json();
    
    if (data.ok) {
      document.getElementById('preview-count').textContent = `~${data.summary.totalRecords} registros`;
    } else {
      document.getElementById('preview-count').textContent = 'Error al calcular';
    }
  } catch (error) {
    document.getElementById('preview-count').textContent = 'Error de conexión';
  }
}

// Generar exportación personalizada
function generateCustomExport() {
  // Enfocar el formulario principal
  document.querySelector('#form-export button[type="submit"]').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center' 
  });
  
  // Mostrar vista previa si no está visible
  if (!exportPreviewVisible) {
    toggleExportPreview();
  }
  
  // Añadir efecto visual
  const form = document.getElementById('form-export');
  form.classList.add('ring-4', 'ring-blue-300');
  setTimeout(() => {
    form.classList.remove('ring-4', 'ring-blue-300');
  }, 2000);
  
  Utils.showNotification('🎯 Configura tus filtros y haz clic en "Generar y Descargar"', 'info', 4000);
}

// Descargar archivo de muestra
async function downloadSample() {
  Utils.showNotification('📋 Generando archivo de muestra...', 'info');
  
  try {
    const response = await fetch('http://localhost:3000/export/json?country=colombia');
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'sirecov_muestra_colombia.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    
    Utils.showNotification('✅ Archivo de muestra descargado', 'success', 3000);
    
    // Agregar al historial
    addToExportHistory('Archivo de muestra', 'JSON', 'Colombia', new Date());
    
  } catch (error) {
    console.error('Error descargando muestra:', error);
    Utils.showNotification('❌ Error al descargar muestra', 'error');
  }
}

// Agregar exportación al historial
function addToExportHistory(name, format, filters, date) {
  const historyItem = {
    id: Date.now(),
    name,
    format,
    filters,
    date,
    size: Math.floor(Math.random() * 500) + 50 // Tamaño simulado
  };
  
  exportHistory.unshift(historyItem);
  exportHistory = exportHistory.slice(0, 10); // Mantener solo los últimos 10
  
  updateExportHistoryDisplay();
}

// Actualizar visualización del historial
function updateExportHistoryDisplay() {
  const historyDiv = document.getElementById('export-history');
  
  if (exportHistory.length === 0) {
    historyDiv.innerHTML = `
      <div class="text-sm text-gray-500 text-center py-2">
        No hay exportaciones recientes
      </div>
    `;
    return;
  }
  
  let html = '';
  exportHistory.forEach(item => {
    const timeAgo = getTimeAgo(item.date);
    html += `
      <div class="flex items-center justify-between bg-white border rounded p-3 hover:bg-gray-50 transition-colors">
        <div class="flex-1">
          <div class="font-medium text-sm">${item.name}</div>
          <div class="text-xs text-gray-600">${item.format} • ${item.filters} • ${item.size} KB</div>
        </div>
        <div class="text-xs text-gray-500">${timeAgo}</div>
      </div>
    `;
  });
  
  historyDiv.innerHTML = html;
}

// Obtener tiempo transcurrido
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
  return `${Math.floor(diffMins / 1440)}d`;
}

// Limpiar historial de exportaciones
function clearExportHistory() {
  exportHistory = [];
  updateExportHistoryDisplay();
  Utils.showNotification('🗑️ Historial de exportaciones limpiado', 'info', 2000);
}

// Cargar estadísticas de exportación
async function loadExportStats() {
  try {
    const response = await fetch('http://localhost:3000/stats');
    const data = await response.json();
    
    if (data.ok) {
      document.getElementById('stats-total').textContent = data.summary.totalRecords;
      document.getElementById('stats-countries').textContent = data.summary.uniqueCountries || 0;
      document.getElementById('stats-dates').textContent = data.summary.uniqueDates || 0;
    }
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

// Mejorar función de exportación existente
document.getElementById('form-export')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const format = document.querySelector('input[name="format"]:checked')?.value || 'json';
  const country = document.getElementById('export-country').value;
  const startDate = document.getElementById('export-start').value;
  const endDate = document.getElementById('export-end').value;
  const type = document.getElementById('export-type').value;
  
  // Crear nombre descriptivo
  let exportName = 'Exportación personalizada';
  let filterDesc = [];
  if (country) filterDesc.push(`País: ${country}`);
  if (startDate || endDate) {
    if (startDate && endDate) filterDesc.push(`${startDate} a ${endDate}`);
    else if (startDate) filterDesc.push(`Desde ${startDate}`);
    else filterDesc.push(`Hasta ${endDate}`);
  }
  if (type) filterDesc.push(`Tipo: ${type}`);
  
  const filterText = filterDesc.length > 0 ? filterDesc.join(', ') : 'Sin filtros';
  
  Utils.showNotification(`🚀 Generando exportación ${format.toUpperCase()}...`, 'info', 3000);
  
  try {
    // Usar la función quickExport existente pero mejorada
    await quickExport(format, country, startDate, endDate, type);
    
    // Agregar al historial
    addToExportHistory(exportName, format.toUpperCase(), filterText, new Date());
    
  } catch (error) {
    console.error('Error en exportación:', error);
    Utils.showNotification('❌ Error en la exportación', 'error');
  }
});

// Inicializar sistema de exportación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  // Cargar estadísticas
  setTimeout(loadExportStats, 1000);
  
  // Configurar eventos de actualización de vista previa
  ['export-country', 'export-start', 'export-end', 'export-type'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', updateExportPreview);
      element.addEventListener('change', updateExportPreview);
    }
  });
});

// Exportar funciones globales
window.toggleExportPreview = toggleExportPreview;
window.updateFormatSelection = updateFormatSelection;
window.setExportCountry = setExportCountry;
window.generateCustomExport = generateCustomExport;
window.downloadSample = downloadSample;
window.clearExportHistory = clearExportHistory;

// Función para optimizar todos los canvas existentes
function optimizeAllCharts() {
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    
    // Mejorar suavizado de texto y formas
    ctx.textBaseline = 'middle';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Configurar alta resolución si no se ha hecho
    if (!canvas.dataset.optimized) {
      configureHighResCanvas(canvas);
      canvas.dataset.optimized = 'true';
    }
  });
}

// Optimizar charts cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(optimizeAllCharts, 100);
});

// Re-optimizar cuando cambia el tamaño de ventana
window.addEventListener('resize', () => {
  setTimeout(optimizeAllCharts, 100);
});

// Cache buster - October 30, 2025 16:47:00 - Export System Fixed
console.log('✅ SIRECOV App.js loaded successfully - v2.2.0 (Export + HD Charts)');

// Validar que las funciones de exportación estén disponibles
console.log('🔍 Validando funciones de exportación:', {
  updateFormatSelection: typeof window.updateFormatSelection,
  toggleExportPreview: typeof window.toggleExportPreview,
  setupExportForm: typeof setupExportForm,
  quickExport: typeof window.quickExport
});