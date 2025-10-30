// Prueba del sistema de benchmarks - SIRECOV
console.log('🚀 Probando sistema de benchmarks...');

// Test 1: Endpoint de país
fetch('http://localhost:3000/records/by-country/colombia')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Endpoint país funciona:', {
      ok: data.ok,
      records: data.count,
      tiempo: data.durationMs + 'ms'
    });
  })
  .catch(error => {
    console.log('❌ Error endpoint país:', error);
  });

// Test 2: Endpoint de fecha
fetch('http://localhost:3000/records/by-date/1994-11-16')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Endpoint fecha funciona:', {
      ok: data.ok,
      records: data.count,
      tiempo: data.durationMs + 'ms'
    });
  })
  .catch(error => {
    console.log('❌ Error endpoint fecha:', error);
  });

// Test 3: Endpoint de búsqueda optimizada
fetch('http://localhost:3000/search/country/colombia')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Endpoint búsqueda optimizada funciona:', {
      found: data.found,
      records: data.totalRecords,
      tiempo: data.indexInfo?.searchTime + 'ms'
    });
  })
  .catch(error => {
    console.log('❌ Error endpoint búsqueda:', error);
  });

console.log('📊 Benchmarks listos para usar');
console.log('🌐 Abre http://localhost:3000 y ve a la pestaña Sistema');