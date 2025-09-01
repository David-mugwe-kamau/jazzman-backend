const path = require('path');

// Force PostgreSQL usage in all environments
const isProduction = true;

let db, runQuery, getRow, getAll;

if (isProduction) {
  // PostgreSQL for production (Render)
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('✅ Connected to PostgreSQL database (Production)');

  // PostgreSQL helper functions
  runQuery = async (sql, params = []) => {
    try {
      const result = await pool.query(sql, params);
      return { id: result.rows[0]?.id, changes: result.rowCount };
    } catch (error) {
      throw error;
    }
  };

  getRow = async (sql, params = []) => {
    try {
      const result = await pool.query(sql, params);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  };

  getAll = async (sql, params = []) => {
    try {
      const result = await pool.query(sql, params);
      return result.rows || [];
    } catch (error) {
      throw error;
    }
  };

  // Initialize PostgreSQL tables
  initializePostgresTables();

} else {
  // This branch is no longer used; SQLite support has been removed.
}

// Initialize PostgreSQL tables
async function initializePostgresTables() {
  console.log('🔧 Initializing PostgreSQL tables...');
  
  try {
    // Create enhanced bookings table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        customer_phone TEXT,
        address TEXT NOT NULL,
        location_notes TEXT,
        preferred_datetime TIMESTAMP NOT NULL,
        service_type TEXT NOT NULL,
        service_price REAL NOT NULL,
        barber_id INTEGER,
        barber_name TEXT NOT NULL,
        barber_phone TEXT NOT NULL,
        barber_identity_badge TEXT,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        payment_method TEXT,
        mpesa_phone TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cancellation_reason TEXT,
        notification_sent_at TIMESTAMP,
        barber_notified BOOLEAN DEFAULT FALSE,
        cancelled_at TIMESTAMP,
        cancelled_by TEXT
      )
    `);
    console.log('✅ Enhanced bookings table ready');

    // Create barbers table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS barbers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        email TEXT,
        profile_photo TEXT,
        identity_badge_number TEXT UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        is_blocked BOOLEAN DEFAULT FALSE,
        block_reason TEXT,
        blocked_at TIMESTAMP,
        block_expires_at TIMESTAMP,
        block_duration_hours INTEGER DEFAULT 24,
        block_type TEXT DEFAULT 'temporary',
        block_category TEXT,
        block_severity TEXT DEFAULT 'medium',
        block_warning_count INTEGER DEFAULT 0,
        blocked_by INTEGER,
        total_services INTEGER DEFAULT 0,
        total_earnings REAL DEFAULT 0.0,
        current_location TEXT,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Barbers table ready');

    // Create payments table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_method_used TEXT,
        phone_number TEXT,
        customer_notes TEXT,
        status TEXT DEFAULT 'pending',
        transaction_id TEXT,
        receipt_sent BOOLEAN DEFAULT FALSE,
        payment_received_at TIMESTAMP,
        payment_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings (id)
      )
    `);
    console.log('✅ Payments table ready');

    // Create admin users table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Ensure UNIQUE constraints exist (migration for existing tables)
    try {
      await runQuery(`
        ALTER TABLE admin_users 
        ADD CONSTRAINT admin_users_username_unique 
        UNIQUE (username)
      `);
      console.log('✅ Admin users username UNIQUE constraint added');
    } catch (error) {
      console.log('ℹ️ Admin users username UNIQUE constraint already exists');
    }
    
    try {
      await runQuery(`
        ALTER TABLE admin_users 
        ADD CONSTRAINT admin_users_email_unique 
        UNIQUE (email)
      `);
      console.log('✅ Admin users email UNIQUE constraint added');
    } catch (error) {
      console.log('ℹ️ Admin users email UNIQUE constraint already exists');
    }
    
    console.log('✅ Admin users table ready');

    // Create clients table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        address TEXT,
        location_notes TEXT,
        preferred_service TEXT,
        preferred_barber_name TEXT,
        preferred_barber_phone TEXT,
        total_bookings INTEGER DEFAULT 0,
        total_spent REAL DEFAULT 0.0,
        last_booking_date TIMESTAMP,
        favorite_service TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Ensure UNIQUE constraint exists (migration for existing tables)
    try {
      await runQuery(`
        ALTER TABLE clients 
        ADD CONSTRAINT clients_phone_unique 
        UNIQUE (phone)
      `);
      console.log('✅ Clients phone UNIQUE constraint added');
    } catch (error) {
      console.log('ℹ️ Clients phone UNIQUE constraint already exists');
    }
    
    console.log('✅ Clients table ready');

    // Create working hours table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS working_hours (
        id SERIAL PRIMARY KEY,
        day_of_week INTEGER NOT NULL,
        day_name TEXT,
        is_open BOOLEAN DEFAULT TRUE,
        open_time TEXT,
        close_time TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Ensure UNIQUE constraint exists (migration for existing tables)
    try {
      await runQuery(`
        ALTER TABLE working_hours 
        ADD CONSTRAINT working_hours_day_of_week_unique 
        UNIQUE (day_of_week)
      `);
      console.log('✅ Working hours UNIQUE constraint added');
    } catch (error) {
      // Constraint might already exist, ignore error
      console.log('ℹ️ Working hours UNIQUE constraint already exists');
    }
    
    console.log('✅ Working hours table ready');

    // Create performance indexes (PostgreSQL)
    try {
      await runQuery(`
        CREATE INDEX IF NOT EXISTS idx_bookings_status_preferred_datetime
        ON bookings (status, preferred_datetime)
      `);
      await runQuery(`
        CREATE INDEX IF NOT EXISTS idx_bookings_barber_id_status
        ON bookings (barber_id, status)
      `);
      await runQuery(`
        CREATE INDEX IF NOT EXISTS idx_bookings_created_at
        ON bookings (created_at)
      `);
      await runQuery(`
        CREATE INDEX IF NOT EXISTS idx_payments_booking_id
        ON payments (booking_id)
      `);
      await runQuery(`
        CREATE INDEX IF NOT EXISTS idx_payments_created_at
        ON payments (created_at)
      `);
      console.log('✅ Performance indexes created/verified');
    } catch (error) {
      console.log('ℹ️ Index creation skipped or already exists:', error.message);
    }

    // Run database migrations for existing deployments
    await runDatabaseMigrations();
    
    // Insert default working hours
    await insertDefaultWorkingHoursPostgres();
    
    // Insert default admin user
    await insertDefaultAdminPostgres();

    console.log('🎉 PostgreSQL initialization complete!');

  } catch (error) {
    console.error('❌ Error initializing PostgreSQL tables:', error);
  }
}

// Run database migrations for existing PostgreSQL deployments
async function runDatabaseMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    
    // Check if passport_photo column exists and rename it to profile_photo
    try {
      const columnCheck = await runQuery(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'barbers' AND column_name = 'passport_photo'
      `);
      
      if (columnCheck && columnCheck.length > 0) {
        console.log('🔄 Renaming passport_photo column to profile_photo...');
        await runQuery(`
          ALTER TABLE barbers 
          RENAME COLUMN passport_photo TO profile_photo
        `);
        console.log('✅ Column renamed successfully');
      } else {
        console.log('ℹ️ passport_photo column does not exist, skipping rename');
      }
    } catch (error) {
      console.log('ℹ️ Column rename migration skipped:', error.message);
    }
    
    // Update existing file paths from /uploads/passports/ to /uploads/profiles/
    try {
      console.log('🔄 Updating file paths in existing records...');
      const result = await runQuery(`
        UPDATE barbers 
        SET profile_photo = REPLACE(profile_photo, '/uploads/passports/', '/uploads/profiles/')
        WHERE profile_photo LIKE '/uploads/passports/%'
      `);
      console.log(`✅ Updated ${result.rowCount || 0} file paths`);
    } catch (error) {
      console.log('ℹ️ File path update migration skipped:', error.message);
    }
    
    // Ensure the profile_photo column exists with correct type
    try {
      const profilePhotoCheck = await runQuery(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'barbers' AND column_name = 'profile_photo'
      `);
      
      if (!profilePhotoCheck || profilePhotoCheck.length === 0) {
        console.log('🔄 Adding profile_photo column...');
        await runQuery(`
          ALTER TABLE barbers 
          ADD COLUMN profile_photo TEXT
        `);
        console.log('✅ profile_photo column added');
      } else {
        console.log('ℹ️ profile_photo column already exists');
      }
    } catch (error) {
      console.log('ℹ️ Column addition migration skipped:', error.message);
    }
    
    // Fix preferred_datetime column type if it's TEXT instead of TIMESTAMP
    try {
      const datetimeCheck = await getRow(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'preferred_datetime'
      `);
      
      if (datetimeCheck && datetimeCheck.data_type === 'text') {
        console.log('🔄 Converting preferred_datetime from TEXT to TIMESTAMP...');
        
        // First, add a temporary column
        await runQuery(`
          ALTER TABLE bookings 
          ADD COLUMN preferred_datetime_new TIMESTAMP
        `);
        
        // Convert existing data
        await runQuery(`
          UPDATE bookings 
          SET preferred_datetime_new = preferred_datetime::timestamp
          WHERE preferred_datetime IS NOT NULL
        `);
        
        // Drop the old column and rename the new one
        await runQuery(`
          ALTER TABLE bookings 
          DROP COLUMN preferred_datetime
        `);
        
        await runQuery(`
          ALTER TABLE bookings 
          RENAME COLUMN preferred_datetime_new TO preferred_datetime
        `);
        
        console.log('✅ preferred_datetime column converted to TIMESTAMP');
      } else if (datetimeCheck && datetimeCheck.data_type === 'timestamp') {
        console.log('ℹ️ preferred_datetime column already has correct type');
      } else {
        // Column might not exist or be in an inconsistent state, ensure it exists as TIMESTAMP
        console.log('🔄 Ensuring preferred_datetime column exists as TIMESTAMP...');
        try {
          await runQuery(`
            ALTER TABLE bookings 
            ALTER COLUMN preferred_datetime TYPE TIMESTAMP USING preferred_datetime::timestamp
          `);
          console.log('✅ preferred_datetime column type fixed');
        } catch (alterError) {
          console.log('ℹ️ Column type alteration not needed');
        }
      }
    } catch (error) {
      console.log('ℹ️ preferred_datetime migration skipped:', error.message);
    }
    
    console.log('✅ Database migrations completed');
    
    // Ensure uploads directories exist
    await ensureUploadsDirectories();
  } catch (error) {
    console.error('❌ Error running migrations:', error);
  }
}

// Ensure uploads directories exist
async function ensureUploadsDirectories() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const uploadsDir = path.join(__dirname, '../public/uploads');
    const profilesDir = path.join(uploadsDir, 'profiles');
    
    // Create directories if they don't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Created uploads directory');
    }
    
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
      console.log('✅ Created profiles directory');
    }
    
    console.log('✅ Upload directories ready');
  } catch (error) {
    console.error('❌ Error creating upload directories:', error);
  }
}

// Insert default working hours (PostgreSQL version)
async function insertDefaultWorkingHoursPostgres() {
  const workingHours = [
    { day: 1, dayName: 'Monday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
    { day: 2, dayName: 'Tuesday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
    { day: 3, dayName: 'Wednesday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
    { day: 4, dayName: 'Thursday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
    { day: 5, dayName: 'Friday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
    { day: 6, dayName: 'Saturday', isOpen: true, openTime: '08:00', closeTime: '16:00' },
    { day: 0, dayName: 'Sunday', isOpen: false, openTime: null, closeTime: null }
  ];

  for (const hours of workingHours) {
    try {
      await runQuery(`
        INSERT INTO working_hours (day_of_week, day_name, is_open, open_time, close_time) 
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (day_of_week) DO NOTHING
      `, [hours.day, hours.dayName, hours.isOpen, hours.openTime, hours.closeTime]);
    } catch (error) {
      console.error('Error inserting working hours:', error.message);
    }
  }
}

// Insert default admin user (PostgreSQL version)
async function insertDefaultAdminPostgres() {
  try {
    const bcrypt = require('bcryptjs');
    const defaultPassword = 'JazzMan2025!';
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

    await runQuery(`
      INSERT INTO admin_users (username, email, password_hash, role, is_active) 
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO NOTHING
    `, ['admin', 'admin@jazzman.com', hashedPassword, 'admin', true]);

    console.log('✅ Default admin user created (username: admin, password: JazzMan2025!)');
  } catch (error) {
    console.error('Error inserting admin user:', error.message);
  }
}

// SQLite helper functions removed

module.exports = {
  db,
  runQuery,
  getRow,
  getAll
};