const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, 'data', 'jazzman.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Updating payments table with new fields...');

// Add new columns to payments table
db.serialize(() => {
  // Add payment_received_at column
  db.run(`ALTER TABLE payments ADD COLUMN payment_received_at DATETIME`, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('✅ payment_received_at column already exists');
    } else if (err) {
      console.error('❌ Error adding payment_received_at column:', err.message);
    } else {
      console.log('✅ Added payment_received_at column');
    }
  });

  // Add payment_notes column
  db.run(`ALTER TABLE payments ADD COLUMN payment_notes TEXT`, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('✅ payment_notes column already exists');
    } else if (err) {
      console.error('❌ Error adding payment_notes column:', err.message);
    } else {
      console.log('✅ Added payment_notes column');
    }
  });

  // Add payment_method_used column
  db.run(`ALTER TABLE payments ADD COLUMN payment_method_used TEXT`, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('✅ payment_method_used column already exists');
    } else if (err) {
      console.error('❌ Error adding payment_method_used column:', err.message);
    } else {
      console.log('✅ Added payment_method_used column');
    }
  });

  // Show final table structure
  db.all(`PRAGMA table_info(payments)`, (err, rows) => {
    if (err) {
      console.error('❌ Error getting table info:', err.message);
    } else {
      console.log('\n📊 Final payments table structure:');
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
        console.log('🎉 Payments table updated successfully!');
      }
    });
  });
});
