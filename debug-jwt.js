const jwt = require('jsonwebtoken');
const axios = require('axios');

async function debugJWT() {
  const baseURL = 'https://jazzman-housecalls.onrender.com';
  
  console.log('🔍 Debugging JWT Token Issues...\n');

  // Check local JWT_SECRET
  console.log('1️⃣ Local Environment Variables:');
  console.log('   JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
  console.log('   JWT_SECRET value:', process.env.JWT_SECRET || 'Using default');
  console.log('');

  // Test login to get token
  console.log('2️⃣ Getting token from server...');
  try {
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'admin',
      password: 'JazzMan2025!'
    });

    const serverToken = loginResponse.data.token;
    console.log('✅ Server token received');
    console.log('Token length:', serverToken.length);
    
    // Decode token without verification to see payload
    const decoded = jwt.decode(serverToken);
    console.log('Token payload:', decoded);
    console.log('');

    // Test verification with different secrets
    console.log('3️⃣ Testing token verification with different secrets:');
    
    const secrets = [
      'JazzMan2025SecretKey123!@#',
      'your-secret-key',
      'default-secret',
      process.env.JWT_SECRET || 'no-env-secret'
    ];

    for (const secret of secrets) {
      try {
        const verified = jwt.verify(serverToken, secret);
        console.log(`✅ Token verified with secret: "${secret}"`);
        console.log('   Verified payload:', verified);
      } catch (error) {
        console.log(`❌ Token verification failed with secret: "${secret}"`);
        console.log('   Error:', error.message);
      }
    }

    // Test the verify endpoint
    console.log('\n4️⃣ Testing server verify endpoint...');
    try {
      const verifyResponse = await axios.get(`${baseURL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${serverToken}`
        }
      });
      console.log('✅ Server verification successful');
      console.log('Response:', verifyResponse.data);
    } catch (error) {
      console.log('❌ Server verification failed');
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Error:', error.response.data);
      } else {
        console.log('Error:', error.message);
      }
    }

  } catch (error) {
    console.log('❌ Error getting token:', error.message);
  }

  console.log('\n🎯 Conclusion:');
  console.log('If the token verifies with the default secret but not on the server,');
  console.log('it means the JWT_SECRET environment variable is not set correctly on Render.');
}

// Run the debug function
debugJWT().catch(console.error);
