const https = require('https');

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

console.log('🧪 Testing login API...');
console.log('📡 Sending request to:', options.hostname + options.path);

const req = https.request(options, (res) => {
  console.log('📊 Status:', res.statusCode);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('📝 Response:', responseData);
    
    try {
      const parsed = JSON.parse(responseData);
      console.log('✅ Parsed response:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('❌ Could not parse JSON response');
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Request error:', error.message);
});

req.write(data);
req.end();
