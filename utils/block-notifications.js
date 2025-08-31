const { getAll, getRow } = require('../config/database');
const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'admin@jazzman.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Check for expiring blocks and send notifications
async function checkExpiringBlocks() {
  try {
    console.log('🔔 Checking for expiring blocks...');
    
    // Find blocks expiring in the next 24 hours
    const expiringBlocks = await getAll(`
      SELECT 
        b.id, b.name, b.email, b.phone,
        b.block_expires_at, b.block_reason, b.block_duration_hours,
        EXTRACT(EPOCH FROM (b.block_expires_at::timestamp - CURRENT_TIMESTAMP)) / 3600 as hours_until_expiry
      FROM barbers b
      WHERE b.is_blocked = 1 
        AND b.block_type = 'temporary'
        AND b.block_expires_at IS NOT NULL
        AND b.block_expires_at > CURRENT_TIMESTAMP
        AND b.block_expires_at <= CURRENT_TIMESTAMP + INTERVAL '24 hours'
      ORDER BY b.block_expires_at ASC
    `);
    
    if (expiringBlocks.length === 0) {
      console.log('✅ No blocks expiring in the next 24 hours');
      return;
    }
    
    console.log(`🔔 Found ${expiringBlocks.length} blocks expiring soon`);
    
    // Send notifications for each expiring block
    for (const block of expiringBlocks) {
      await sendExpiryNotification(block);
    }
    
  } catch (error) {
    console.error('❌ Error checking expiring blocks:', error);
  }
}

// Send expiry notification to admin
async function sendExpiryNotification(block) {
  try {
    const hoursLeft = Math.floor(block.hours_until_expiry);
    const minutesLeft = Math.floor((block.hours_until_expiry % 1) * 60);
    
    let timeText = '';
    if (hoursLeft > 0) {
      timeText = `${hoursLeft} hour(s)`;
      if (minutesLeft > 0) {
        timeText += ` and ${minutesLeft} minute(s)`;
      }
    } else {
      timeText = `${minutesLeft} minute(s)`;
    }
    
    const subject = `⚠️ Barber Block Expiring Soon: ${block.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">⚠️ Barber Block Expiring Soon</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Barber Details</h3>
          <p><strong>Name:</strong> ${block.name}</p>
          <p><strong>Email:</strong> ${block.email || 'N/A'}</p>
          <p><strong>Phone:</strong> ${block.phone || 'N/A'}</p>
        </div>
        
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0;">Block Information</h3>
          <p><strong>Reason:</strong> ${block.block_reason}</p>
          <p><strong>Duration:</strong> ${block.block_duration_hours} hour(s)</p>
          <p><strong>Expires In:</strong> <span style="color: #e74c3c; font-weight: bold;">${timeText}</span></p>
          <p><strong>Expiry Time:</strong> ${new Date(block.block_expires_at).toLocaleString()}</p>
        </div>
        
        <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
          <h3 style="color: #0c5460; margin-top: 0;">Action Required</h3>
          <p>This temporary block will expire automatically. You may want to:</p>
          <ul>
            <li>Review the barber's status</li>
            <li>Extend the block if needed</li>
            <li>Contact the barber for follow-up</li>
          </ul>
        </div>
        
        <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
          JazzMan Housecalls Admin Dashboard
        </p>
      </div>
    `;
    
    // Send to admin
    await sendEmail(process.env.ADMIN_EMAIL || 'admin@jazzman.com', subject, html);
    
    // Send to barber if email exists
    if (block.email) {
      await sendBarberExpiryNotification(block);
    }
    
    console.log(`✅ Expiry notification sent for ${block.name} (expires in ${timeText})`);
    
  } catch (error) {
    console.error(`❌ Error sending expiry notification for ${block.name}:`, error);
  }
}

// Send notification to barber about expiring block
async function sendBarberExpiryNotification(block) {
  try {
    const subject = `🔓 Your JazzMan Housecalls Account Access Will Be Restored Soon`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">🔓 Account Access Restoration</h2>
        
        <p>Dear ${block.name},</p>
        
        <p>We're writing to inform you that your temporary account suspension will expire soon.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Suspension Details</h3>
          <p><strong>Reason:</strong> ${block.block_reason}</p>
          <p><strong>Duration:</strong> ${block.block_duration_hours} hour(s)</p>
          <p><strong>Expires:</strong> ${new Date(block.block_expires_at).toLocaleString()}</p>
        </div>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
          <h3 style="color: #155724; margin-top: 0;">What Happens Next</h3>
          <p>Once your suspension expires:</p>
          <ul>
            <li>Your account will be automatically reactivated</li>
            <li>You'll be able to receive new bookings</li>
            <li>All previous services and ratings will be preserved</li>
          </ul>
        </div>
        
        <p>If you have any questions or concerns, please contact our support team.</p>
        
        <p>Best regards,<br>The JazzMan Housecalls Team</p>
        
        <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
          JazzMan Housecalls
        </p>
      </div>
    `;
    
    await sendEmail(block.email, subject, html);
    
  } catch (error) {
    console.error(`❌ Error sending barber expiry notification:`, error);
  }
}

// Generic email sending function
async function sendEmail(to, subject, html) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'admin@jazzman.com',
      to: to,
      subject: subject,
      html: html
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
    
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    throw error;
  }
}

// Send immediate notification when barber is blocked
async function sendBlockNotification(barberId, blockType, duration, reason) {
  try {
    const barber = await getRow(`
      SELECT id, name, email, phone FROM barbers WHERE id = ?
    `, [barberId]);
    
    if (!barber) return;
    
    const subject = `🚫 Barber Account Suspended: ${barber.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">🚫 Account Suspension Notice</h2>
        
        <p>Dear ${barber.name},</p>
        
        <p>Your JazzMan Housecalls account has been temporarily suspended.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Suspension Details</h3>
          <p><strong>Type:</strong> ${blockType === 'temporary' ? 'Temporary Suspension' : 'Permanent Ban'}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          ${blockType === 'temporary' ? `<p><strong>Duration:</strong> ${duration} hour(s)</p>` : ''}
        </div>
        
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0;">What This Means</h3>
          <p>During this suspension:</p>
          <ul>
            <li>You cannot receive new bookings</li>
            <li>Existing bookings may be affected</li>
            <li>Your account status is temporarily inactive</li>
          </ul>
        </div>
        
        <p>If you believe this suspension was made in error, please contact our support team immediately.</p>
        
        <p>Best regards,<br>The JazzMan Housecalls Team</p>
        
        <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
          JazzMan Housecalls
        </p>
      </div>
    `;
    
    if (barber.email) {
      await sendEmail(barber.email, subject, html);
    }
    
    // Also send to admin
    await sendEmail(process.env.ADMIN_EMAIL || 'admin@jazzman.com', 
      `🚫 Barber Blocked: ${barber.name}`, html);
    
  } catch (error) {
    console.error('❌ Error sending block notification:', error);
  }
}

module.exports = {
  checkExpiringBlocks,
  sendBlockNotification,
  sendEmail
};
