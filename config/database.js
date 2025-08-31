const path = require('path');

// Check if we're in production (Render) or development (local)
const isProduction = process.env.NODE_ENV === 'production';

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
  // SQLite for local development
  const sqlite3 = require('sqlite3').verbose();
  
  // Database file path - use local data directory
  const dbPath = path.join(__dirname, '..', 'data', 'jazzman.db');

  // Create database connection
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('✅ Connected to SQLite database (Local Development)');
      console.log('🔍 Database path:', dbPath);
      initializeTables();
    }
  });

  // SQLite helper functions
  runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  };

  getRow = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  };

  getAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  };
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
        preferred_datetime TEXT NOT NULL,
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
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Admin users table ready');

    // Create clients table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
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
    console.log('✅ Clients table ready');

    // Create working hours table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS working_hours (
        id SERIAL PRIMARY KEY,
        day_of_week INTEGER NOT NULL UNIQUE,
        day_name TEXT,
        is_open BOOLEAN DEFAULT TRUE,
        open_time TEXT,
        close_time TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Working hours table ready');

    // Insert default working hours
    await insertDefaultWorkingHoursPostgres();
    
    // Insert default admin user
    await insertDefaultAdminPostgres();

    console.log('🎉 PostgreSQL initialization complete!');

  } catch (error) {
    console.error('❌ Error initializing PostgreSQL tables:', error);
  }
}

// Initialize SQLite tables (existing function)
function initializeTables(callback) {
  console.log('🔧 Initializing database tables...');
  
  let tablesCreated = 0;
  const totalTables = 6; // bookings, barbers, services, payments, admin_users, working_hours
  
  function checkCompletion() {
    tablesCreated++;
    if (tablesCreated === totalTables) {
      console.log('🎉 Database initialization complete!');
      if (callback) callback();
    }
  }
  
  // Create enhanced bookings table
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    address TEXT NOT NULL,
    location_notes TEXT,
    preferred_datetime TEXT NOT NULL,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    cancellation_reason TEXT,
    notification_sent_at DATETIME,
    barber_notified BOOLEAN DEFAULT 0,
    cancelled_at DATETIME,
    cancelled_by TEXT,
    FOREIGN KEY (barber_id) REFERENCES barbers (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating bookings table:', err.message);
    } else {
      console.log('✅ Enhanced bookings table ready');
    }
    checkCompletion();
  });

  // Create barbers table with ALL required columns
  db.run(`CREATE TABLE IF NOT EXISTS barbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    profile_photo TEXT,
    identity_badge_number TEXT UNIQUE,
    is_active BOOLEAN DEFAULT 1,
    is_blocked BOOLEAN DEFAULT 0,
    block_reason TEXT,
    blocked_at DATETIME,
    block_expires_at DATETIME,
    block_duration_hours INTEGER DEFAULT 24,
    block_type TEXT DEFAULT 'temporary',
    block_category TEXT,
    block_severity TEXT DEFAULT 'medium',
    block_warning_count INTEGER DEFAULT 0,
    blocked_by INTEGER,
    total_services INTEGER DEFAULT 0,
    total_earnings REAL DEFAULT 0.0,
    current_location TEXT,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating barbers table:', err.message);
    } else {
      console.log('✅ Barbers table ready');
    }
    checkCompletion();
  });

  // Create payments table
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    payment_method_used TEXT,
    phone_number TEXT,
    customer_notes TEXT,
    status TEXT DEFAULT 'pending',
    transaction_id TEXT,
    receipt_sent BOOLEAN DEFAULT 0,
    payment_received_at DATETIME,
    payment_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating payments table:', err.message);
    } else {
      console.log('✅ Payments table ready');
      
      // Add missing payment_method_used column if it doesn't exist (migration)
      db.run(`ALTER TABLE payments ADD COLUMN payment_method_used TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding payment_method_used column:', err.message);
        } else if (err && err.message.includes('duplicate column name')) {
          console.log('✅ payment_method_used column already exists');
        } else {
          console.log('✅ Added payment_method_used column to existing payments table');
        }
      });
    }
    checkCompletion();
  });

  // Create admin users table
  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating admin_users table:', err.message);
    } else {
      console.log('✅ Admin users table ready');
      
      // Insert default admin user only if table is empty
      db.get('SELECT COUNT(*) as count FROM admin_users', (err, row) => {
        if (err) {
          console.error('Error checking admin_users count:', err.message);
        } else if (row.count === 0) {
          console.log('📝 Inserting default admin user...');
          insertDefaultAdmin();
        } else {
          console.log('✅ Admin users table already has data, skipping default insertion');
        }
      });
    }
    checkCompletion();
  });

  // Create clients table for client memory system
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    address TEXT,
    location_notes TEXT,
    preferred_service TEXT,
    preferred_barber_name TEXT,
    preferred_barber_phone TEXT,
    total_bookings INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0.0,
    last_booking_date DATETIME,
    favorite_service TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating clients table:', err.message);
    } else {
      console.log('✅ Clients table ready');
    }
    checkCompletion();
  });

  // Create working hours table
  db.run(`CREATE TABLE IF NOT EXISTS working_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL,
    day_name TEXT,
    is_open BOOLEAN DEFAULT 1,
    open_time TEXT,
    close_time TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating working_hours table:', err.message);
    } else {
      console.log('✅ Working hours table ready');
      
      // Insert default working hours only if table is empty
      db.get('SELECT COUNT(*) as count FROM working_hours', (err, row) => {
        if (err) {
          console.error('Error checking working_hours count:', err.message);
        } else if (row.count === 0) {
          console.log('📝 Inserting default working hours...');
          insertDefaultWorkingHours();
        } else {
          console.log('✅ Working hours table already has data, skipping default insertion');
        }
      });
    }
    checkCompletion();
  });
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

// Insert default working hours (SQLite version)
function insertDefaultWorkingHoursSQLite() {
  const workingHours = [
    { day: 1, dayName: 'Monday', isOpen: 1, openTime: '08:00', closeTime: '18:00' },
    { day: 2, dayName: 'Tuesday', isOpen: 1, openTime: '08:00', closeTime: '18:00' },
    { day: 3, dayName: 'Wednesday', isOpen: 1, openTime: '08:00', closeTime: '18:00' },
    { day: 4, dayName: 'Thursday', isOpen: 1, openTime: '08:00', closeTime: '18:00' },
    { day: 5, dayName: 'Friday', isOpen: 1, openTime: '08:00', closeTime: '18:00' },
    { day: 6, dayName: 'Saturday', isOpen: 1, openTime: '08:00', closeTime: '16:00' },
    { day: 0, dayName: 'Sunday', isOpen: 0, openTime: null, closeTime: null }
  ];

  workingHours.forEach(hours => {
    db.run(`INSERT OR IGNORE INTO working_hours (day_of_week, day_name, is_open, open_time, close_time) VALUES (?, ?, ?, ?, ?)`,
      [hours.day, hours.dayName, hours.isOpen, hours.openTime, hours.closeTime],
      (err) => {
        if (err) {
          console.error('Error inserting working hours:', err.message);
        }
      }
    );
  });
}

// Insert default admin user (SQLite version)
function insertDefaultAdminSQLite() {
  const bcrypt = require('bcryptjs');
  const defaultPassword = 'JazzMan2025!'; // Updated password for production
  const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

  db.run(`INSERT OR IGNORE INTO admin_users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)`,
    ['admin', 'admin@jazzman.com', hashedPassword, 'admin', 1],
    (err) => {
      if (err) {
        console.error('Error inserting admin user:', err.message);
      } else {
        console.log('✅ Default admin user created (username: admin, password: JazzMan2025!)');
      }
    }
  );
}

// Insert default admin user (SQLite version - for backward compatibility)
function insertDefaultAdmin() {
  const bcrypt = require('bcryptjs');
  const defaultPassword = 'JazzMan2025!'; // Updated password for production
  const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

  db.run(`INSERT OR IGNORE INTO admin_users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)`,
    ['admin', 'admin@jazzman.com', hashedPassword, 'admin', 1],
    (err) => {
      if (err) {
        console.error('Error inserting admin user:', err.message);
      } else {
        console.log('✅ Default admin user created (username: admin, password: JazzMan2025!)');
      }
    }
  );
}

module.exports = {
  db,
  runQuery,
  getRow,
  getAll
};