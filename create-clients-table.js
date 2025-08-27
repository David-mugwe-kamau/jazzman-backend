const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, 'data', 'jazzman.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Creating clients table for customer memory system...');

// Create clients table
db.serialize(() => {
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
    total_spent REAL DEFAULT 0,
    last_booking_date DATETIME,
    favorite_service TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('❌ Error creating clients table:', err.message);
    } else {
      console.log('✅ Clients table created successfully');
    }
  });

  // Create index on phone for fast lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)`, (err) => {
    if (err) {
      console.error('❌ Error creating phone index:', err.message);
    } else {
      console.log('✅ Phone index created successfully');
    }
  });

  // Create index on email for fast lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)`, (err) => {
    if (err) {
      console.error('❌ Error creating email index:', err.message);
    } else {
      console.log('✅ Email index created successfully');
    }
  });

  // Show table structure
  db.all(`PRAGMA table_info(clients)`, (err, rows) => {
    if (err) {
      console.error('❌ Error getting table info:', err.message);
    } else {
      console.log('\n📊 Clients table structure:');
      console.log('=====================================');
      rows.forEach(row => {
        console.log(`${row.name} (${row.type}) - ${row.notnull ? 'NOT NULL' : 'NULLABLE'}`);
      });
    }
    
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('\n✅ Database connection closed');
        console.log('🎉 Clients table created successfully!');
      }
    });
  });
});
