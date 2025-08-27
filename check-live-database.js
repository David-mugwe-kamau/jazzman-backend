const { runQuery } = require('./config/database');

async function checkLiveDatabase() {
  try {
    console.log('🔍 Checking live database...');
    
    // Check barbers
    const barbers = await runQuery('SELECT * FROM barbers');
    console.log('📊 Barbers in database:', barbers.length);
    barbers.forEach(barber => {
      console.log(`  - ${barber.name} (ID: ${barber.id})`);
    });
    
    // Check services
    const services = await runQuery('SELECT * FROM services');
    console.log('📊 Services in database:', services.length);
    services.forEach(service => {
      console.log(`  - ${service.name} ($${service.price})`);
    });
    
    // Check bookings
    const bookings = await runQuery('SELECT COUNT(*) as count FROM bookings');
    console.log('📊 Total bookings:', bookings[0].count);
    
    // Check payments
    const payments = await runQuery('SELECT COUNT(*) as count FROM payments');
    console.log('📊 Total payments:', payments[0].count);
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkLiveDatabase();
