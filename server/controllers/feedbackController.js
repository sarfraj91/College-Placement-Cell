import Feedback from "../models/feedbackModel.js";
import appError from "../utils/errorUtils.js";

// ✅ Save feedback/support requests from footer
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

    const feedback = await Feedback.create({
      name,
      email,
      phone,
      rating: numericRating,
      message,
      channel: channel === "whatsapp" ? "whatsapp" : "web",
      user: req.user?.id,
      role: req.user?.role,
    });

    return res.status(201).json({
      success: true,
      message: "Thanks for your feedback!",
      feedbackId: feedback._id,
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};
