// utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html, text) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,   // Gmail ID
        pass: process.env.EMAIL_PASS    // App Password
      }
    });

    const mailOptions = {
      from: `"Your App Name" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: html || `<p>${text || ''}</p>`,
      text: text || html?.replace(/<[^>]+>/g, '') // Fallback to plain text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email Sent:', info.messageId);

    return info;
  } catch (error) {
    console.error('❌ Email Send Failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = sendEmail;
