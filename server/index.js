require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create transporter
const createTransporter = (emailSettings = null) => {
  const config = emailSettings || {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    fromName: process.env.EMAIL_FROM_NAME || 'NAF Law',
    fromAddress: process.env.EMAIL_FROM || process.env.EMAIL_USER
  };

  return nodemailer.createTransporter({
    host: config.host,
    port: parseInt(config.port),
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Test email endpoint
app.post('/api/send-test-email', async (req, res) => {
  try {
    const { emailSettings, testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email address is required' 
      });
    }

    const transporter = createTransporter(emailSettings);
    
    const mailOptions = {
      from: emailSettings ? `${emailSettings.fromName} <${emailSettings.fromAddress}>` : process.env.EMAIL_FROM,
      to: testEmail,
      subject: 'Test Email from NAF Law System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">NAF Law System - Test Email</h2>
          <p>This is a test email to verify your email configuration is working correctly.</p>
          <p>If you received this email, your email settings are properly configured.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This email was sent from the NAF Law management system.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.code || 'Unknown error'
    });
  }
});

// Send notification email endpoint
app.post('/api/send-notification', async (req, res) => {
  try {
    const { to, subject, message, type } = req.body;
    
    if (!to || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email address, subject, and message are required' 
      });
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'NAF Law'} <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">NAF Law System</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            ${message}
          </div>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This email was sent from the NAF Law management system.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: 'Notification email sent successfully' 
    });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send meeting invitation endpoint
app.post('/api/send-meeting-invitation', async (req, res) => {
  try {
    const { meetingDetails, invitees, emailContent } = req.body;
    
    if (!meetingDetails || !invitees || !Array.isArray(invitees) || invitees.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Meeting details and invitees are required' 
      });
    }

    const transporter = createTransporter();
    
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // إرسال دعوة لكل مدعو
    for (const email of invitees) {
      try {
        const mailOptions = {
          from: `${process.env.EMAIL_FROM_NAME || 'NAF Law'} <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
          to: email,
          subject: `دعوة اجتماع - ${meetingDetails.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl;">
              <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">دعوة اجتماع Zoom</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">${meetingDetails.title}</p>
              </div>
              
              <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                  <h3 style="color: #1f2937; margin-top: 0;">تفاصيل الاجتماع:</h3>
                  <p style="margin: 5px 0;"><strong>📅 التاريخ والوقت:</strong> ${new Date(meetingDetails.startTime).toLocaleString('ar-SA')}</p>
                  <p style="margin: 5px 0;"><strong>⏱️ المدة:</strong> ${meetingDetails.duration} دقيقة</p>
                  <p style="margin: 5px 0;"><strong>🆔 رقم الاجتماع:</strong> ${meetingDetails.id}</p>
                  ${meetingDetails.password ? `<p style="margin: 5px 0;"><strong>🔐 كلمة المرور:</strong> ${meetingDetails.password}</p>` : ''}
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${meetingDetails.joinUrl}" 
                     style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    الانضمام إلى الاجتماع
                  </a>
                </div>
                
                ${meetingDetails.agenda ? `
                  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="color: #92400e; margin-top: 0;">📋 جدول الأعمال:</h4>
                    <p style="color: #92400e; white-space: pre-wrap; margin-bottom: 0;">${meetingDetails.agenda}</p>
                  </div>
                ` : ''}
                
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">
                    نتطلع لرؤيتك في الاجتماع.<br>
                    مع تحيات فريق NAF Law
                  </p>
                </div>
              </div>
            </div>
          `
        };

        const info = await transporter.sendMail(mailOptions);
        results.push({ email, success: true, messageId: info.messageId });
        successCount++;
        
      } catch (emailError) {
        console.error(`Failed to send invitation to ${email}:`, emailError);
        results.push({ email, success: false, error: emailError.message });
        failedCount++;
      }
    }
    
    res.json({ 
      success: successCount > 0,
      message: `تم إرسال ${successCount} دعوة من أصل ${invitees.length}`,
      summary: {
        total: invitees.length,
        success: successCount,
        failed: failedCount
      },
      results
    });
    
  } catch (error) {
    console.error('Meeting invitation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Email server is running',
    timestamp: new Date().toISOString(),
    emailConfigured: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
  });
});

app.listen(PORT, () => {
  console.log(`Email server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Email configured: ${!!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)}`);
});