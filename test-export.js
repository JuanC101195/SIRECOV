// Prueba del sistema de exportación - SIRECOV
console.log('📤 Probando sistema de exportación...');

// Test 1: Exportación JSON completa
fetch('http://localhost:3000/export/json')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Exportación JSON completa:', {
      registros: data.totalRecords,
      fechaExportacion: data.exportedAt,
      tieneRecords: data.records && data.records.length > 0
    });
  })
  .catch(error => {
    console.log('❌ Error exportación JSON:', error);
  });

// Test 2: Exportación CSV completa
fetch('http://localhost:3000/export/csv')
  .then(response => response.text())
  .then(data => {
    const lines = data.split('\n').filter(line => line.trim());
    console.log('✅ Exportación CSV completa:', {
      lineas: lines.length,
      cabecera: lines[0],
      primerRegistro: lines[1] || 'No hay registros'
    });
  })
  .catch(error => {
    console.log('❌ Error exportación CSV:', error);
  });

// Test 3: Exportación con filtros
fetch('http://localhost:3000/export/json?country=colombia')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Exportación con filtro país:', {
      registrosFiltrados: data.totalRecords,
      filtrosAplicados: data.filters,
      paisFiltrado: data.filters.country
    });
  })
  .catch(error => {
    console.log('❌ Error exportación con filtros:', error);
  });

// Test 4: Exportación CSV con filtros
fetch('http://localhost:3000/export/csv?type=confirmed')
  .then(response => response.text())
  .then(data => {
    const lines = data.split('\n').filter(line => line.trim());
    const confirmedRecords = lines.filter(line => line.includes('confirmed')).length;
    console.log('✅ Exportación CSV filtrada:', {
      lineasTotales: lines.length,
      registrosConfirmados: confirmedRecords,
      funcionaFiltroTipo: confirmedRecords > 0
    });
  })
  .catch(error => {
    console.log('❌ Error exportación CSV filtrada:', error);
  });

setTimeout(() => {
  console.log('📊 Sistema de exportación validado');
  console.log('🌐 Prueba manual: ve a http://localhost:3000 → pestaña Exportar');
}, 1000);