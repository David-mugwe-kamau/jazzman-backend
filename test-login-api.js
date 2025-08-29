const axios = require('axios');

async function testLoginAPI() {
  console.log('🧪 Testing Login API on Live Server...\n');
  
  const loginData = {
    username: 'admin',
    password: 'JazzMan2025!'
  };

  try {
    console.log('📡 Sending login request...');
    const response = await axios.post('https://jazzman-housecalls.onrender.com/api/auth/login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Login successful!');
    console.log('📊 Response status:', response.status);
    console.log('🔑 Token received:', response.data.token ? 'YES' : 'NO');
    console.log('👤 User data:', response.data.user ? 'YES' : 'NO');
    
    if (response.data.token) {
      console.log('\n🔍 Testing token verification...');
      const verifyResponse = await axios.get('https://jazzman-housecalls.onrender.com/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${response.data.token}`
        }
      });
      
      console.log('✅ Token verification successful!');
      console.log('📊 Verify status:', verifyResponse.status);
    }

  } catch (error) {
    console.log('❌ Login failed!');
    console.log('📊 Error status:', error.response?.status);
    console.log('📝 Error message:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.log('🔍 Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testLoginAPI();
