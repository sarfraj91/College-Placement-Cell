import axios from "axios";

const sendEmail = async (email, subject, message, options = {}) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = options.fromEmail || process.env.BREVO_SENDER_EMAIL;
    const senderName =
      options.fromName || process.env.BREVO_SENDER_NAME || "Placement Cell";

    if (!apiKey) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    if (!senderEmail) {
      throw new Error("BREVO_SENDER_EMAIL is not configured");
    }

    console.log("Sending email with Brevo...");

    const payload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email }],
      subject,
      htmlContent: message,
    };

    const replyToEmail =
      options.replyTo || process.env.BREVO_REPLY_TO_EMAIL || undefined;
    if (replyToEmail) {
      payload.replyTo = {
        email: replyToEmail,
        name: options.replyToName || senderName,
      };
    }

    const { data } = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: Number(process.env.BREVO_TIMEOUT_MS || 15000),
      },
    );

    console.log("Email sent with Brevo:", data?.messageId || "queued");

    return data;
  } catch (e) {
    const details = e.response?.data || e.message;
    console.error("Email error:", details);
    throw e;
  }
};

export default sendEmail;
