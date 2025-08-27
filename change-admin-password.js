const bcrypt = require('bcryptjs');
const { runQuery } = require('./config/database');

async function changeAdminPassword() {
  try {
    console.log('🔐 Changing admin password...');
    
    // New secure password - CHANGE THIS TO YOUR PREFERRED PASSWORD
    const newPassword = 'JazzMan2025!'; // You can change this to any password you want
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    const result = await runQuery(`
      UPDATE admin_users 
      SET password_hash = ? 
      WHERE username = 'admin'
    `, [hashedPassword]);
    
    if (result.changes > 0) {
      console.log('✅ Admin password updated successfully!');
      console.log('🔑 New credentials:');
      console.log('   Username: admin');
      console.log('   Password: ' + newPassword);
      console.log('');
      console.log('⚠️  IMPORTANT: Save this password somewhere safe!');
      console.log('⚠️  You will need it to access the admin dashboard.');
    } else {
      console.log('❌ No admin user found to update');
    }
    
  } catch (error) {
    console.error('❌ Error changing admin password:', error);
  }
}

changeAdminPassword();
