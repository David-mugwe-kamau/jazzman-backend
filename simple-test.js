const https = require('https');

function testLogin() {
  console.log('🧪 Testing Login API...\n');
  
  const data = JSON.stringify({
    username: 'admin',
    password: 'JazzMan2025!'
  });

  const options = {
    hostname: 'jazzman-housecalls.onrender.com',
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    console.log('📊 Status:', res.statusCode);
    console.log('📋 Headers:', res.headers);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('📝 Response:', responseData);
    });
  });

  req.on('error', (error) => {
    console.log('❌ Error:', error.message);
  });

  req.write(data);
  req.end();
}

testLogin();
