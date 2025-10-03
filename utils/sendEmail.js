require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  try {
    // Debug: Check environment variables
    console.log("🚦 SMTP User:", process.env.BREVO_USER);
    console.log("🚦 SMTP Key Loaded:", !!process.env.BREVO_PASS);
    console.log("🚦 Recipient Email:", process.env.EMAIL_USER);

    if (!process.env.BREVO_USER || !process.env.BREVO_PASS) {
      throw new Error('Missing BREVO_USER or BREVO_PASS environment variables.');
    }

    // Create Nodemailer transporter using Brevo SMTP relay
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false, // false for STARTTLS on port 587
      auth: {
        user: process.env.BREVO_USER, // Your Brevo SMTP login, e.g. 986f58002@smtp-brevo.com
        pass: process.env.BREVO_PASS, // Your full SMTP key, e.g. xsmtpsib-xxxxxx
      },
    });

    // Verify SMTP connection before sending mail
    await transporter.verify();
    console.log("✅ SMTP connection successful");

    // Send a test email
    const info = await transporter.sendMail({
      from: `"Test App" <${process.env.BREVO_USER}>`, // Must match your SMTP user or authorized sender
      to: process.env.EMAIL_USER, // Receiver email address from .env
      subject: "🚀 Test email from Nodemailer + Brevo",
      text: "Hello! This is a test email sent via Brevo SMTP and Nodemailer.",
    });

    console.log("📨 Message sent:", info.messageId);
  } catch (error) {
    // Detailed error logging to troubleshoot authentication problems
    console.error("❌ Error sending email:");
    if (error.response) {
      console.error("Response:", error.response);
    }
    if (error.responseCode) {
      console.error("Response Code:", error.responseCode);
    }
    console.error(error);
  }
})();
