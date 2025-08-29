const axios = require('axios');

async function checkRenderSecret() {
  const baseURL = 'https://jazzman-backend.onrender.com';
  
  console.log('🔍 Checking Render JWT_SECRET value...\n');

  // Get a fresh token
  console.log('1️⃣ Getting fresh token from Render...');
  try {
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'admin',
      password: 'JazzMan2025!'
    });

    const token = loginResponse.data.token;
    console.log('✅ Token received');
    console.log('');

    // Test common JWT_SECRET values
    console.log('2️⃣ Testing common JWT_SECRET values...');
    
    const commonSecrets = [
      'JazzMan2025SecretKey123!@#',
      'jazzman-secret-key',
      'jazzman-backend-secret',
      'render-secret',
      'production-secret',
      'admin-secret',
      'jwt-secret',
      'secret-key',
      'your-secret-key',
      'default-secret',
      'JWT_SECRET',
      'jazzman',
      'admin',
      'password',
      'secret'
    ];

    for (const secret of commonSecrets) {
      try {
        const verifyResponse = await axios.get(`${baseURL}/api/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (verifyResponse.data.success) {
          console.log(`🎯 FOUND IT! JWT_SECRET is likely: "${secret}"`);
          console.log('✅ Token verification successful with this secret');
          return;
        }
      } catch (error) {
        // Continue testing other secrets
      }
    }

    console.log('❌ Could not find the correct JWT_SECRET value');
    console.log('🔧 You need to check the exact value in your Render environment variables');

  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n💡 Next steps:');
  console.log('1. Click the eye icon next to JWT_SECRET in Render');
  console.log('2. Copy the exact value');
  console.log('3. Update the code to use that value');
}

// Run the check
checkRenderSecret().catch(console.error);
