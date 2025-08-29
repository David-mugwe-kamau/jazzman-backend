const axios = require('axios');

async function testAdminAccess() {
  const baseURL = 'https://jazzman-housecalls.onrender.com';
  
  console.log('🔍 Testing Admin Dashboard Access...\n');

  try {
    // Test 1: Direct access to admin page
    console.log('1️⃣ Testing direct access to /admin...');
    try {
      const adminResponse = await axios.get(`${baseURL}/admin`, {
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept redirects
        }
      });
      console.log('✅ Admin page accessible');
      console.log('Status:', adminResponse.status);
      console.log('Response length:', adminResponse.data.length);
    } catch (error) {
      if (error.response) {
        console.log('Status:', error.response.status);
        if (error.response.status === 302) {
          console.log('✅ Redirecting to login (expected behavior)');
        } else {
          console.log('❌ Unexpected response');
        }
      } else {
        console.log('❌ Error accessing admin page:', error.message);
      }
    }

    // Test 2: Login and get token
    console.log('\n2️⃣ Testing login process...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'admin',
      password: 'JazzMan2025!'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log('Token received');

    // Test 3: Access admin with token
    console.log('\n3️⃣ Testing admin access with token...');
    try {
      const adminWithTokenResponse = await axios.get(`${baseURL}/admin?token=${token}`, {
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });
      console.log('✅ Admin access with token successful');
      console.log('Status:', adminWithTokenResponse.status);
    } catch (error) {
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Response:', error.response.data);
      } else {
        console.log('❌ Error:', error.message);
      }
    }

    // Test 4: Check if admin page loads correctly
    console.log('\n4️⃣ Testing admin page content...');
    try {
      const adminPageResponse = await axios.get(`${baseURL}/admin?token=${token}`);
      console.log('✅ Admin page loads successfully');
      console.log('Content type:', adminPageResponse.headers['content-type']);
      console.log('Content length:', adminPageResponse.data.length);
      
      // Check if it's HTML
      if (adminPageResponse.data.includes('<html')) {
        console.log('✅ Admin page returns HTML content');
      } else {
        console.log('❌ Admin page does not return HTML');
      }
    } catch (error) {
      console.log('❌ Error loading admin page:', error.message);
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
testAdminAccess().catch(console.error);
