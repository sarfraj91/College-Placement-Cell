import nodemailer from "nodemailer";

// Create a transporter using Ethereal test credentials.
// For production, replace with your actual SMTP server details.
const sendEmail = async (email, subject, message) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,

      // env values are strings → convert to number
      port: Number(process.env.SMTP_PORT),

      // auto handle 465 vs 587
      secure: process.env.SMTP_PORT == 465,

      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log("⏳ Sending email...");

    const info = await transporter.sendMail({
      from: process.env.SMTP_ADMIN,
      to: email,
      subject: subject,
      html: message,
    });

  console.log("✅ Email sent to real inbox:", info.messageId);

    return info;



    // IMPORTANT: return something so caller knows it succeeded
    return info;
  } catch (e) {
    console.error("❌ Email error:", e);
    throw e; // let controller handle error
  }
};

export default sendEmail;
