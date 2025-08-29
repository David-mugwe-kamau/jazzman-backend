const axios = require('axios');

async function testVerify() {
  const baseURL = 'https://jazzman-housecalls.onrender.com';
  
  console.log('🧪 Testing Token Verification...\n');

  // First, get a token by logging in
  console.log('1️⃣ Getting token by logging in...');
  try {
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'admin',
      password: 'JazzMan2025!'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    console.log('Token length:', token.length);

    // Now test the verify endpoint
    console.log('\n2️⃣ Testing verify endpoint...');
    const verifyResponse = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Token verification successful!');
    console.log('Status:', verifyResponse.status);
    console.log('User data:', verifyResponse.data.user);

  } catch (error) {
    console.log('❌ Error occurred:');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Run the test
testVerify().catch(console.error);
