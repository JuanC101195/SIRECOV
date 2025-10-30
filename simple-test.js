// simple-test.js - Prueba simple del endpoint
fetch('http://localhost:3000/search/country/colombia')
  .then(response => {
    console.log('Status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('Respuesta del servidor:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error('Error:', error);
  });