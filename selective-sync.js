const { getAll, runQuery } = require('./config/database');

async function selectiveSync() {
  try {
    console.log('🔄 Starting selective data sync...\n');
    
    // 1. Sync Services (essential business data)
    console.log('📋 Syncing services...');
    const services = await getAll('SELECT name, price, description FROM services WHERE name IN (?, ?, ?, ?, ?)', 
      ['Bespoke haircut', 'Scissor cut', 'Bald haircut', 'Bald haircut with razor', 'Kids\' Haircut']);
    
    console.log(`✅ Found ${services.length} core services to sync`);
    services.forEach(service => {
      console.log(`   - ${service.name}: ${service.price}`);
    });
    
    // 2. Check Working Hours
    console.log('\n⏰ Checking working hours...');
    const workingHours = await getAll('SELECT day_of_week, is_open, open_time, close_time FROM working_hours');
    console.log(`✅ Found ${workingHours.length} working hours entries`);
    
    // 3. Check Admin Users
    console.log('\n👤 Checking admin users...');
    const adminUsers = await getAll('SELECT username, email FROM admin_users');
    console.log(`✅ Found ${adminUsers.length} admin users`);
    adminUsers.forEach(admin => {
      console.log(`   - ${admin.username} (${admin.email})`);
    });
    
    // 4. Summary of what will be synced
    console.log('\n📊 SYNC SUMMARY:');
    console.log('✅ WILL SYNC:');
    console.log('   - Services (5 core services)');
    console.log('   - Working Hours (business schedule)');
    console.log('   - Admin Users (admin account)');
    
    console.log('\n❌ WILL NOT SYNC:');
    console.log('   - Bookings (42 test bookings)');
    console.log('   - Payments (2 test payments)');
    console.log('   - Barbers (3 test barbers)');
    console.log('   - Customer data (privacy concern)');
    
    console.log('\n💡 RECOMMENDATION:');
    console.log('   - Let Render create fresh, clean tables');
    console.log('   - Manually add only essential barbers');
    console.log('   - Start fresh with real business data');
    
  } catch (error) {
    console.error('❌ Error during selective sync check:', error.message);
  } finally {
    process.exit(0);
  }
}

selectiveSync();
