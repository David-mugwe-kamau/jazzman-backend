const { getAll, db } = require('./config/database');

async function checkLocalData() {
  try {
    console.log('🔍 Checking local database contents...\n');
    
    // Wait a bit for database to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check barbers
    try {
      const barbers = await getAll('SELECT COUNT(*) as count FROM barbers');
      console.log('✂️ Barbers:', barbers[0].count);
      
      if (barbers[0].count > 0) {
        const barberDetails = await getAll('SELECT name, phone, is_blocked FROM barbers LIMIT 3');
        console.log('   Sample barbers:', barberDetails.map(b => `${b.name} (${b.phone}) - Blocked: ${b.is_blocked}`));
      }
    } catch (err) {
      console.log('✂️ Barbers: Table not ready yet');
    }
    
    // Check bookings
    try {
      const bookings = await getAll('SELECT COUNT(*) as count FROM bookings');
      console.log('📅 Bookings:', bookings[0].count);
    } catch (err) {
      console.log('📅 Bookings: Table not ready yet');
    }
    
    // Check payments
    try {
      const payments = await getAll('SELECT COUNT(*) as count FROM payments');
      console.log('💳 Payments:', payments[0].count);
    } catch (err) {
      console.log('💳 Payments: Table not ready yet');
    }
    
    // Check services
    try {
      const services = await getAll('SELECT COUNT(*) as count FROM services');
      console.log('🛠️ Services:', services[0].count);
    } catch (err) {
      console.log('🛠️ Services: Table not ready yet');
    }
    
    // Check admin users
    try {
      const adminUsers = await getAll('SELECT COUNT(*) as count FROM admin_users');
      console.log('👤 Admin Users:', adminUsers[0].count);
    } catch (err) {
      console.log('👤 Admin Users: Table not ready yet');
    }
    
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  } finally {
    process.exit(0);
  }
}

checkLocalData();
