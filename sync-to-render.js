const axios = require('axios');

// Render API configuration
const RENDER_BASE_URL = 'https://jazzman-backend.onrender.com';
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'JazzMan2025!'
};

async function syncToRender() {
  try {
    console.log('🔄 Syncing clean local structure to Render...\n');
    
    // Step 1: Login to get JWT token
    console.log('🔐 Logging in to Render...');
    const loginResponse = await axios.post(`${RENDER_BASE_URL}/api/auth/login`, ADMIN_CREDENTIALS);
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Set up headers for authenticated requests
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Step 2: Sync Services
    console.log('\n📋 Syncing services...');
    const { getAll } = require('./config/database');
    const services = await getAll('SELECT name, price, description FROM services');
    
    for (const service of services) {
      try {
        await axios.post(`${RENDER_BASE_URL}/api/admin/services`, service, { headers });
        console.log(`   ✅ Synced: ${service.name}`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`   ⚠️  Already exists: ${service.name}`);
        } else {
          console.log(`   ❌ Failed to sync: ${service.name} - ${error.message}`);
        }
      }
    }
    
    // Step 3: Sync Barbers
    console.log('\n✂️ Syncing barbers...');
    const barbers = await getAll('SELECT name, phone, email, identity_badge_number FROM barbers');
    
    for (const barber of barbers) {
      try {
        await axios.post(`${RENDER_BASE_URL}/api/admin/barbers`, barber, { headers });
        console.log(`   ✅ Synced: ${barber.name}`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`   ⚠️  Already exists: ${barber.name}`);
        } else {
          console.log(`   ❌ Failed to sync: ${barber.name} - ${error.message}`);
        }
      }
    }
    
    // Step 4: Sync Working Hours
    console.log('\n⏰ Syncing working hours...');
    const workingHours = await getAll('SELECT day_of_week, is_open, open_time, close_time FROM working_hours');
    
    for (const hours of workingHours) {
      try {
        await axios.post(`${RENDER_BASE_URL}/api/admin/working-hours`, hours, { headers });
        console.log(`   ✅ Synced: Day ${hours.day_of_week}`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`   ⚠️  Already exists: Day ${hours.day_of_week}`);
        } else {
          console.log(`   ❌ Failed to sync: Day ${hours.day_of_week} - ${error.message}`);
        }
      }
    }
    
    console.log('\n🎉 Sync completed!');
    console.log('✅ Services synced');
    console.log('✅ Barbers synced');
    console.log('✅ Working hours synced');
    console.log('\n💡 Your Render deployment now has the same clean structure as local!');
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  } finally {
    process.exit(0);
  }
}

// Check if axios is installed
try {
  require('axios');
  syncToRender();
} catch (error) {
  console.log('📦 Installing axios for API calls...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install axios', { stdio: 'inherit' });
    console.log('✅ Axios installed, running sync...');
    syncToRender();
  } catch (installError) {
    console.error('❌ Failed to install axios:', installError.message);
    console.log('💡 Please run: npm install axios');
  }
}
