const axios = require('axios');

async function testLogin() {
  const baseURL = 'https://jazzman-housecalls.onrender.com';
  const loginData = {
    username: 'admin',
    password: 'JazzMan2025!'
  };

  console.log('🧪 Testing Admin Login API...\n');
  console.log('URL:', `${baseURL}/api/auth/login`);
  console.log('Credentials:', loginData);
  console.log('');

  try {
    console.log('📡 Sending login request...');
    const response = await axios.post(`${baseURL}/api/auth/login`, loginData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Login successful!');
    console.log('Status:', response.status);
    console.log('Response:', response.data);
    
    if (response.data.token) {
      console.log('\n🎯 Token received successfully!');
      console.log('Token length:', response.data.token.length);
      console.log('User:', response.data.user);
    }

  } catch (error) {
    console.log('❌ Login failed!');
    
    if (error.response) {
      // Server responded with error status
      console.log('Status:', error.response.status);
      console.log('Error data:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('\n🔍 This suggests:');
        console.log('   - Invalid username/password');
        console.log('   - Admin user not found in database');
        console.log('   - Password hash mismatch');
      } else if (error.response.status === 500) {
        console.log('\n🔍 This suggests:');
        console.log('   - Server error (check JWT_SECRET)');
        console.log('   - Database connection issue');
        console.log('   - Missing environment variables');
      }
    } else if (error.request) {
      // Request was made but no response received
      console.log('No response received from server');
      console.log('This might indicate:');
      console.log('   - Server is down');
      console.log('   - Network connectivity issue');
      console.log('   - Server is still starting up');
    } else {
      // Something else happened
      console.log('Error:', error.message);
    }
  }

  console.log('\n🔧 Next steps:');
  console.log('1. Check if JWT_SECRET is set in Render environment variables');
  console.log('2. Run the debug script: node debug-admin-login.js');
  console.log('3. Check Render logs for any errors');
  console.log('4. Verify the admin user exists in the database');
}

// Run the test
testLogin().catch(console.error);
