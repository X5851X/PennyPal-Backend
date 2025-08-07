import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587, 
  secure: false, 
  auth: {
    user: process.env.BREVO_SMTP_USER, 
    pass: process.env.BREVO_SMTP_PASS 
  },
  tls: {
    rejectUnauthorized: false
  }
});


transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP connection failed:', error);
  } else {
    console.log('✅ SMTP server ready for messages');
  }
});

export default async (to, subject, html) => {
  try {
    console.log('📧 Sending email to:', to);
    
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'PennyPal'}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html
    });

    console.log('✅ Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
};