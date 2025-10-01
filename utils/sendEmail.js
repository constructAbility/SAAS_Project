// require('dotenv').config();
// const nodemailer = require('nodemailer');

// (async () => {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: 'smtp.gmail.com',
//       port: 465,
//       secure: true,
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     const info = await transporter.sendMail({
//       from: `"Test" <${process.env.EMAIL_USER}>`,
//       to: process.env.EMAIL_USER, // apna email ya koi bhi
//       subject: 'Test email from Nodemailer',
//       text: 'Hello! This is a test email.',
//     });


//   } catch (error) {
//     console.error('Error sending email:', error);
//   }
// })();
