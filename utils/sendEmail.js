// utils/sendEmail.js
const axios = require('axios');

const sendEmail = async (to, subject, text) => {
  const response = await axios.post(
    'https://api.resend.com/emails',
    {
      from: process.env.RESEND_EMAIL_FROM,
      to,
      subject,
      text,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log('✅ Resend response:', response.data);
  return response.data;
};

module.exports = sendEmail;
