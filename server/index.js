require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

/* قوالب البريد في ملفّ واحد — الاستثناء المنصوص عليه في §١، وشرحُه
   وجدول تحويل القيم من رموز الثيم هناك. لا تكتب لوناً ولا صيغة تاريخ
   في هذا الملفّ. */
const nafEmail = require('./naf-email');

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
    fromName: process.env.EMAIL_FROM_NAME || 'شركة ناف',
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
      subject: 'ناف — اختبار البريد',
      html: nafEmail.testEmail()
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
      from: `${process.env.EMAIL_FROM_NAME || 'شركة ناف'} <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: nafEmail.notificationEmail({ subject, message })
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
          from: `${process.env.EMAIL_FROM_NAME || 'شركة ناف'} <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
          to: email,
          subject: `دعوة اجتماع - ${meetingDetails.title}`,
          html: nafEmail.meetingInviteEmail(meetingDetails)
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