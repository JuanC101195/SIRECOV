// test-search.js - Script para probar el endpoint de búsqueda
const https = require('http');

function testSearchEndpoint() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/search/country/colombia',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response body:');
      console.log(data);
      
      try {
        const json = JSON.parse(data);
        console.log('\nParsed JSON:');
        console.log(JSON.stringify(json, null, 2));
      } catch (error) {
        console.log('\nError parsing JSON:', error.message);
        console.log('Raw data was:', data.substring(0, 500));
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error);
  });

  req.end();
}

console.log('🧪 Testing search endpoint...');
testSearchEndpoint();