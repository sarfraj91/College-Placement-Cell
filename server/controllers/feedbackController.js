import Feedback from "../models/feedbackModel.js";
import User from "../models/userModel.js";
import appError from "../utils/errorUtils.js";
import sendEmail from "../utils/sentEmail.js";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const submitFeedback = async (req, res, next) => {
  try {
    const { name, email, phone, rating, message, channel } = req.body;

    if (!rating || !message) {
      return next(new appError("Rating and message are required", 400));
    }

    const numericRating = Number(rating);
    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return next(new appError("Rating must be between 1 and 5", 400));
    }

    const trimmedMessage = String(message).trim();
    if (!trimmedMessage) {
      return next(new appError("Review message is required", 400));
    }

    let linkedUser = null;
    if (req.user?.id) {
      linkedUser = await User.findById(req.user.id).select(
        "fullname email phone role",
      );
    }

    const normalizedName = (name || linkedUser?.fullname || "").trim();
    const normalizedEmail = (email || linkedUser?.email || "")
      .trim()
      .toLowerCase();
    const normalizedPhone = (phone || linkedUser?.phone || "").trim();
    const role = linkedUser?.role || req.user?.role || "student";

    const feedback = await Feedback.create({
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      rating: numericRating,
      message: trimmedMessage,
      channel: channel === "whatsapp" ? "whatsapp" : "web",
      user: req.user?.id,
      role,
    });

    const feedbackInbox =
      process.env.FEEDBACK_RECEIVER_EMAIL ||
      process.env.REVIEW_RECEIVER_EMAIL ||
      process.env.NOTIFICATION_ADMIN_EMAIL;

    if (feedbackInbox) {
      const submittedAt = new Date(feedback.createdAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const stars = "★".repeat(numericRating) + "☆".repeat(5 - numericRating);
      const safeName = escapeHtml(normalizedName || "Not provided");
      const safeEmail = escapeHtml(normalizedEmail || "Not provided");
      const safePhone = escapeHtml(normalizedPhone || "Not provided");
      const safeRole = escapeHtml(role);
      const safeSubmittedAt = escapeHtml(submittedAt);
      const safeMessage = escapeHtml(trimmedMessage);

      await sendEmail(
        feedbackInbox,
        `New ${role} review: ${numericRating}/5`,
        `
          <div style="font-family: Arial, sans-serif; color: #10233f; line-height: 1.6;">
            <h2 style="margin-bottom: 8px;">New dashboard review received</h2>
            <p style="margin-top: 0;">A user submitted feedback from the student dashboard.</p>
            <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #d7e2ef;"><strong>Name</strong></td>
                <td style="padding: 8px; border: 1px solid #d7e2ef;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #d7e2ef;"><strong>Email</strong></td>
                <td style="padding: 8px; border: 1px solid #d7e2ef;">${safeEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #d7e2ef;"><strong>Phone</strong></td>
                <td style="padding: 8px; border: 1px solid #d7e2ef;">${safePhone}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #d7e2ef;"><strong>Role</strong></td>
                <td style="padding: 8px; border: 1px solid #d7e2ef; text-transform: capitalize;">${safeRole}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #d7e2ef;"><strong>Rating</strong></td>
                <td style="padding: 8px; border: 1px solid #d7e2ef;">${numericRating}/5 (${stars})</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #d7e2ef;"><strong>Submitted</strong></td>
                <td style="padding: 8px; border: 1px solid #d7e2ef;">${safeSubmittedAt}</td>
              </tr>
            </table>
            <div style="margin-top: 18px; padding: 16px; background: #f5f8fc; border-radius: 12px; border: 1px solid #d7e2ef;">
              <strong>Message</strong>
              <p style="margin: 10px 0 0; white-space: pre-wrap;">${safeMessage}</p>
            </div>
          </div>
        `,
        {
          replyTo: normalizedEmail || undefined,
        },
      );
    }

    return res.status(201).json({
      success: true,
      message: "Thanks for sharing your feedback!",
      feedbackId: feedback._id,
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};
