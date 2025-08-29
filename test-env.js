const axios = require('axios');

async function testEnvironment() {
  const baseURL = 'https://jazzman-housecalls.onrender.com';
  
  console.log('🔍 Testing Environment Variables on Server...\n');

  try {
    // Test the health endpoint to see if we can get environment info
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get(`${baseURL}/api/health`);
    console.log('Health response:', healthResponse.data);
    
    // Try to get a token and see what happens
    console.log('\n2️⃣ Testing login to see JWT behavior...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'admin',
      password: 'JazzMan2025!'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log('Token received:', token.substring(0, 50) + '...');

    // Try to verify the token immediately after getting it
    console.log('\n3️⃣ Testing immediate token verification...');
    try {
      const verifyResponse = await axios.get(`${baseURL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ Token verification successful!');
      console.log('User data:', verifyResponse.data.user);
    } catch (verifyError) {
      console.log('❌ Token verification failed');
      console.log('Error:', verifyError.response?.data || verifyError.message);
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

// Run the test
testEnvironment().catch(console.error);
