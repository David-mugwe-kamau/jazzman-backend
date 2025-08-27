const { runQuery } = require('./config/database');

async function fixLiveDatabase() {
  try {
    console.log('🔍 Checking live database tables...');
    
    // Check what tables exist
    const tables = await runQuery(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    console.log('📊 Existing tables:', tables.map(t => t.name));
    
    // Check if barbers table exists
    const barbersExist = tables.some(t => t.name === 'barbers');
    console.log('👥 Barbers table exists:', barbersExist);
    
    if (!barbersExist) {
      console.log('🔧 Creating missing tables...');
      
      // Create barbers table
      await runQuery(`
        CREATE TABLE IF NOT EXISTS barbers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT NOT NULL UNIQUE,
          email TEXT,
          passport_photo TEXT,
          identity_badge_number TEXT UNIQUE,
          is_active BOOLEAN DEFAULT 1,
          is_blocked BOOLEAN DEFAULT 0,
          block_reason TEXT,
          blocked_at DATETIME,
          blocked_by INTEGER,
          total_services INTEGER DEFAULT 0,
          total_earnings REAL DEFAULT 0.0,
          current_location TEXT,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Barbers table created');
      
      // Insert default barbers
      await runQuery(`
        INSERT INTO barbers (name, phone, identity_badge_number, is_active) VALUES 
        ('David', '+254700000001', 'BARB001', 1),
        ('Joseph', '+254700000002', 'BARB002', 1),
        ('Yusuph', '+254700000003', 'BARB003', 1)
      `);
      console.log('✅ Default barbers inserted');
    }
    
    // Check if services table exists
    const servicesExist = tables.some(t => t.name === 'services');
    if (!servicesExist) {
      await runQuery(`
        CREATE TABLE IF NOT EXISTS services (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Services table created');
      
      // Insert default services
      await runQuery(`
        INSERT INTO services (name, price, description) VALUES 
        ('Bespoke haircut', 3000, 'Premium custom haircut'),
        ('bald haircut', 2000, 'Clean bald cut'),
        ('Kids Haircut', 2000, 'Children haircut service'),
        ('scissor cut', 3500, 'Professional scissor cut'),
        ('bald haircut with razor', 2500, 'Bald cut with razor finish')
      `);
      console.log('✅ Default services inserted');
    }
    
    console.log('🎉 Database fix complete!');
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
  }
}

fixLiveDatabase();
