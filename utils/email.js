const nodemailer = require('nodemailer');

// Create transporter (configure with your email service)
const createTransporter = () => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_PASS) {
    console.log('⚠️ Email credentials not configured. Email notifications will be disabled.');
    return null;
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'jazzmanhousecalls@gmail.com',
      pass: process.env.EMAIL_PASS
    }
  });
};

// Generic email sending function
const sendEmail = async (emailOptions) => {
  try {
    const transporter = createTransporter();
    
    // If no transporter (missing credentials), skip email sending
    if (!transporter) {
      console.log('⚠️ Skipping email send - no email transporter available');
      return null;
    }
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emailOptions.to,
      subject: emailOptions.subject,
      html: emailOptions.html,
      text: emailOptions.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;

  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Send booking confirmation email to customer
const sendBookingConfirmation = async (booking) => {
  try {
    const transporter = createTransporter();
    
    // If no transporter (missing credentials), skip email sending
    if (!transporter) {
      console.log('⚠️ Skipping booking confirmation email - no email transporter available');
      return null;
    }
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: booking.customer_email,
      subject: 'JazzMan Housecalls - Booking Confirmation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
            <h1>JazzMan Housecalls</h1>
            <p>Premium Housecall Barber Services</p>
          </div>
          
          <div style="padding: 20px; background-color: #f9f9f9;">
            <h2>Booking Confirmation</h2>
            <p>Dear ${booking.customer_name},</p>
            <p>Thank you for booking with JazzMan Housecalls! Your appointment has been confirmed.</p>
            
            <div style="background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3>Booking Details:</h3>
              <p><strong>Booking ID:</strong> #${booking.id}</p>
              <p><strong>Service:</strong> ${booking.service_type}</p>
              <p><strong>Price:</strong> KSh ${booking.service_price}</p>
              <p><strong>Date & Time:</strong> ${new Date(booking.preferred_datetime).toLocaleString('en-KE')}</p>
              <p><strong>Address:</strong> ${booking.address}</p>
              <p><strong>Barber:</strong> ${booking.barber_name}</p>
              <p><strong>Barber Phone:</strong> ${booking.barber_phone}</p>
            </div>
            
            <p><strong>Status:</strong> <span style="color: #4CAF50;">${booking.status.toUpperCase()}</span></p>
            
            <p>Thank you for choosing JazzMan Housecalls!</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Booking confirmation email sent:', info.messageId);
    return info;

  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
    throw error;
  }
};

// Send booking assignment notification to barber
const sendBarberAssignmentNotification = async (barber, booking) => {
  try {
    // Check if barber has an email address
    if (!barber.email) {
      console.log(`⚠️ Barber ${barber.name} has no email address. Skipping email notification.`);
      return null;
    }

    const transporter = createTransporter();
    
    // If no transporter (missing credentials), skip email sending
    if (!transporter) {
      console.log('⚠️ Skipping barber notification email - no email transporter available');
      return null;
    }
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: barber.email,
      subject: '🎯 New Booking Assignment - JazzMan Housecalls',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #008000; color: white; padding: 20px; text-align: center;">
            <h1>🎯 JazzMan Housecalls</h1>
            <p>New Booking Assignment</p>
          </div>
          
          <div style="padding: 20px; background-color: #f9f9f9;">
            <h2>🎉 Congratulations! You have a new booking!</h2>
            <p>Dear <strong>${barber.name}</strong>,</p>
            <p>You have been assigned a new booking. Please review the details below and contact the customer to confirm.</p>
            
            <div style="background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #008000;">
              <h3>📋 Booking Details:</h3>
              <p><strong>Booking ID:</strong> #${booking.id}</p>
              <p><strong>Service Type:</strong> ${booking.service_type}</p>
              <p><strong>Service Price:</strong> KSh ${booking.service_price.toLocaleString()}</p>
              <p><strong>Preferred Date & Time:</strong> ${new Date(booking.preferred_datetime).toLocaleString('en-KE')}</p>
              <p><strong>Payment Method:</strong> ${booking.payment_method}</p>
            </div>

            <div style="background-color: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid #28a745;">
              <h3>👤 Customer Information:</h3>
              <p><strong>Name:</strong> ${booking.customer_name}</p>
              <p><strong>Phone:</strong> ${booking.customer_phone}</p>
              <p><strong>Email:</strong> ${booking.customer_email || 'Not provided'}</p>
              <p><strong>Address:</strong> ${booking.address}</p>
              <p><strong>Location Notes:</strong> ${booking.location_notes || 'No additional notes'}</p>
            </div>

            <div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid #ffc107;">
              <h3>📝 Additional Notes:</h3>
              <p>${booking.notes || 'No special requests'}</p>
            </div>

            <div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid #17a2b8;">
              <h3>🚀 Next Steps:</h3>
              <ol>
                <li><strong>Contact the customer</strong> to confirm the appointment</li>
                <li><strong>Verify the address</strong> and plan your route</li>
                <li><strong>Arrive on time</strong> for the scheduled appointment</li>
                <li><strong>Collect payment</strong> upon service completion</li>
                <li><strong>Update booking status</strong> in the admin dashboard</li>
              </ol>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; font-size: 14px;">
                <strong>Important:</strong> Please contact the customer within 30 minutes of receiving this notification.
              </p>
            </div>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Barber assignment notification sent to ${barber.name} (${barber.email}):`, info.messageId);
    return info;

  } catch (error) {
    console.error(`❌ Error sending barber assignment notification to ${barber.name}:`, error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendBarberAssignmentNotification
};