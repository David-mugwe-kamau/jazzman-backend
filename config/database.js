const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path - use /tmp for Render (writable) or local data directory
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/jazzman.db'  // Render uses /tmp for writable files
  : path.join(__dirname, '..', 'data', 'jazzman.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    console.log('🔍 Database path:', dbPath);
    initializeTables();
  }
});

// Initialize database tables
function initializeTables() {
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
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barber_id) REFERENCES barbers (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating bookings table:', err.message);
    } else {
      console.log('✅ Enhanced bookings table ready');
    }
  });

  // Create barbers table with enhanced features (preserve existing data)
  db.run(`CREATE TABLE IF NOT EXISTS barbers (
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
  )`, (err) => {
    if (err) {
      console.error('Error creating barbers table:', err.message);
    } else {
      console.log('✅ Enhanced barbers table ready');
      
      // Check if updated_at column exists, if not add it
      db.run(`ALTER TABLE barbers ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding updated_at column:', err.message);
        } else if (!err) {
          console.log('✅ Added updated_at column to barbers table');
        }
        
        // Insert default barbers only if table is empty
        db.get('SELECT COUNT(*) as count FROM barbers', (err, row) => {
          if (err) {
            console.error('Error checking barbers count:', err.message);
          } else if (row.count === 0) {
            console.log('📝 Inserting default barbers...');
            insertDefaultBarbers();
          } else {
            console.log('✅ Barbers table already has data, skipping default insertion');
          }
        });
      });
    }
  });

  // Create services table
  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating services table:', err.message);
    } else {
      console.log('✅ Services table ready');
      // insertDefaultServices(); // Commented out to start fresh
    }
  });

  // Create payments table
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_id TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    receipt_sent BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating payments table:', err.message);
    } else {
      console.log('✅ Payments table ready');
    }
  });

  // Create admin users table
  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating admin_users table:', err.message);
    } else {
      console.log('✅ Admin users table ready');
      insertDefaultAdmin();
    }
  });
}

// Insert default barbers with enhanced features
function insertDefaultBarbers() {
  const barbers = [
    { 
      name: 'Joseph', 
      phone: '254700888530', 
      email: 'joseph@jazzman.com',
      identity_badge_number: 'JB001',
      total_services: 0,
      total_earnings: 0.0
    },
    { 
      name: 'Yusuph', 
      phone: '254113757415', 
      email: 'yusuph@jazzman.com',
      identity_badge_number: 'JB002',
      total_services: 0,
      total_earnings: 0.0
    },
    { 
      name: 'David', 
      phone: '254116017256', 
      email: 'david@jazzman.com',
      identity_badge_number: 'JB003',
      total_services: 0,
      total_earnings: 0.0
    }
  ];

  barbers.forEach(barber => {
    db.run(`INSERT OR IGNORE INTO barbers (name, phone, email, identity_badge_number, total_services, total_earnings, is_blocked, block_reason, blocked_at, blocked_by) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL)`,
      [barber.name, barber.phone, barber.email, barber.identity_badge_number, barber.total_services, barber.total_earnings],
      (err) => {
        if (err) {
          console.error('Error inserting barber:', err.message);
        }
      }
    );
  });
}

// Insert default services
function insertDefaultServices() {
  const services = [
    { name: 'Bespoke haircut', price: 3000, description: 'Premium bespoke haircut service' },
    { name: 'Scissor cut', price: 3500, description: 'Professional scissor cut' },
    { name: 'Bald haircut', price: 2000, description: 'Clean bald haircut' },
    { name: 'Bald haircut with razor', price: 2500, description: 'Bald haircut with razor finish' },
    { name: 'Kids\' Haircut', price: 2000, description: 'Specialized haircut for children' }
  ];

  services.forEach(service => {
    db.run(`INSERT OR IGNORE INTO services (name, price, description) VALUES (?, ?, ?)`,
      [service.name, service.price, service.description],
      (err) => {
        if (err) {
          console.error('Error inserting service:', err.message);
        }
      }
    );
  });
}

// Insert default admin user
function insertDefaultAdmin() {
  const bcrypt = require('bcryptjs');
  const defaultPassword = 'admin123'; // Change this in production!
  const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

  db.run(`INSERT OR IGNORE INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)`,
    ['admin', 'admin@jazzman.com', hashedPassword],
    (err) => {
      if (err) {
        console.error('Error inserting admin user:', err.message);
      } else {
        console.log('✅ Default admin user created (username: admin, password: admin123)');
      }
    }
  );
}

// Helper function to run queries with promises
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

// Helper function to get single row
function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Helper function to get multiple rows
function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  db,
  runQuery,
  getRow,
  getAll
};