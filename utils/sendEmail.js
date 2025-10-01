const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use App Password
      },
    });

    const mailOptions = {
      from: `"Inventory App" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📤 Email sent:', info.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    throw error;
  }
};

module.exports = sendEmail;
