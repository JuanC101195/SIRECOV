// Prueba de calidad de gráficos - SIRECOV HD
console.log('🎨 Probando mejoras de calidad visual...');

// Verificar que el servidor responde
fetch('http://localhost:3000/api/stats')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Servidor funcionando');
    console.log('📊 Datos disponibles:', data.summary.totalRecords, 'registros');
  })
  .catch(error => {
    console.log('❌ Error de conexión:', error);
  });

// Simular carga de página para probar gráficos
setTimeout(() => {
  console.log('🔍 Verificando optimizaciones...');
  
  const canvases = document.querySelectorAll ? document.querySelectorAll('canvas') : [];
  console.log('📈 Canvas encontrados:', canvases.length);
  
  if (window.devicePixelRatio) {
    console.log('📱 Device Pixel Ratio:', window.devicePixelRatio);
  }
  
  console.log('✨ Pruebas de calidad completadas');
}, 1000);