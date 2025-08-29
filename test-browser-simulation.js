const axios = require('axios');

async function simulateBrowserLogin() {
  const baseURL = 'https://jazzman-housecalls.onrender.com';
  
  console.log('🔍 Simulating Browser Login Process...\n');

  try {
    // Step 1: Login (simulating the form submission)
    console.log('1️⃣ Simulating login form submission...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'admin',
      password: 'JazzMan2025!'
    });

    const data = loginResponse.data;
    console.log('✅ Login response received');
    console.log('Success:', data.success);
    console.log('Message:', data.message);
    console.log('Token exists:', !!data.token);
    console.log('User exists:', !!data.user);

    if (data.success && data.token) {
      // Step 2: Simulate storing in localStorage
      console.log('\n2️⃣ Simulating localStorage storage...');
      console.log('Token would be stored in localStorage as "adminToken"');
      console.log('User would be stored in localStorage as "adminUser"');

      // Step 3: Simulate redirect to /admin
      console.log('\n3️⃣ Simulating redirect to /admin...');
      try {
        const adminResponse = await axios.get(`${baseURL}/admin`, {
          headers: {
            'Cookie': `adminToken=${data.token}`
          }
        });
        console.log('✅ Admin page accessible after login');
        console.log('Status:', adminResponse.status);
        console.log('Content type:', adminResponse.headers['content-type']);
      } catch (error) {
        console.log('❌ Error accessing admin page:', error.message);
        if (error.response) {
          console.log('Status:', error.response.status);
        }
      }

      // Step 4: Test with token in query parameter
      console.log('\n4️⃣ Testing admin access with token in URL...');
      try {
        const adminWithTokenResponse = await axios.get(`${baseURL}/admin?token=${data.token}`);
        console.log('✅ Admin page accessible with token in URL');
        console.log('Status:', adminWithTokenResponse.status);
      } catch (error) {
        console.log('❌ Error accessing admin with token:', error.message);
      }
    } else {
      console.log('❌ Login failed - no token received');
    }

  } catch (error) {
    console.log('❌ Simulation failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }

  console.log('\n🎯 Browser Debugging Steps:');
  console.log('1. Open browser developer tools (F12)');
  console.log('2. Go to Console tab');
  console.log('3. Try logging in and watch for any errors');
  console.log('4. Check Network tab to see the API calls');
  console.log('5. Check Application tab > Local Storage to see if token is stored');
}

// Run the simulation
simulateBrowserLogin().catch(console.error);
