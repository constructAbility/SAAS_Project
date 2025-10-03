require('dotenv').config();
const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text, html) => {
  try {
    if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
      throw new Error('Missing BREVO_USER or BREVO_PASS environment variables.');
    }

    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
      },
    });

    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"Your App" <${process.env.BREVO_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('📨 Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('❌ sendEmail failed:', err.message);
    throw err;
  }
};

module.exports = sendEmail;
