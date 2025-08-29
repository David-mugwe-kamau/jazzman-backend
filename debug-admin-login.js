const { getRow, runQuery } = require('./config/database');
const bcrypt = require('bcryptjs');

async function debugAdminLogin() {
  console.log('🔍 Debugging Admin Login Issues...\n');

  // Check 1: Environment Variables
  console.log('1️⃣ Checking Environment Variables:');
  console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET' : '❌ MISSING');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('   PORT:', process.env.PORT || '3000');
  console.log('');

  // Check 2: Database Connection
  console.log('2️⃣ Testing Database Connection:');
  try {
    const testQuery = await getRow('SELECT 1 as test');
    console.log('   Database connection: ✅ WORKING');
  } catch (error) {
    console.log('   Database connection: ❌ FAILED');
    console.log('   Error:', error.message);
    return;
  }

  // Check 3: Admin Users Table
  console.log('3️⃣ Checking Admin Users Table:');
  try {
    const adminCount = await getRow('SELECT COUNT(*) as count FROM admin_users');
    console.log(`   Admin users in database: ${adminCount.count}`);
    
    if (adminCount.count === 0) {
      console.log('   ❌ No admin users found! Creating default admin...');
      await createDefaultAdmin();
    } else {
      console.log('   ✅ Admin users exist');
    }
  } catch (error) {
    console.log('   ❌ Error checking admin users:', error.message);
    console.log('   Creating admin_users table and default admin...');
    await createTablesAndAdmin();
  }

  // Check 4: Test Admin User
  console.log('4️⃣ Testing Admin User Login:');
  try {
    const admin = await getRow('SELECT * FROM admin_users WHERE username = ? AND is_active = 1', ['admin']);
    
    if (!admin) {
      console.log('   ❌ Admin user not found or inactive');
      return;
    }

    console.log('   ✅ Admin user found');
    console.log('   Username:', admin.username);
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('   Active:', admin.is_active ? 'Yes' : 'No');

    // Test password
    const testPassword = 'JazzMan2025!';
    const isValid = await bcrypt.compare(testPassword, admin.password_hash);
    console.log('   Password test:', isValid ? '✅ CORRECT' : '❌ INCORRECT');
    
    if (!isValid) {
      console.log('   🔧 Updating admin password...');
      await updateAdminPassword();
    }

  } catch (error) {
    console.log('   ❌ Error testing admin user:', error.message);
  }

  console.log('\n🎯 Login Credentials:');
  console.log('   Username: admin');
  console.log('   Password: JazzMan2025!');
  console.log('   URL: https://jazzman-backend.onrender.com/admin');
}

async function createDefaultAdmin() {
  try {
    const defaultPassword = 'JazzMan2025!';
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

    await runQuery(
      'INSERT INTO admin_users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin@jazzman.com', hashedPassword, 'admin', 1]
    );

    console.log('   ✅ Default admin user created successfully');
  } catch (error) {
    console.log('   ❌ Error creating admin user:', error.message);
  }
}

async function updateAdminPassword() {
  try {
    const newPassword = 'JazzMan2025!';
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    await runQuery(
      'UPDATE admin_users SET password_hash = ? WHERE username = ?',
      [hashedPassword, 'admin']
    );

    console.log('   ✅ Admin password updated successfully');
  } catch (error) {
    console.log('   ❌ Error updating password:', error.message);
  }
}

async function createTablesAndAdmin() {
  try {
    // Create admin_users table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('   ✅ Admin users table created');
    await createDefaultAdmin();
  } catch (error) {
    console.log('   ❌ Error creating tables:', error.message);
  }
}

// Run the debug function
debugAdminLogin().catch(console.error);
