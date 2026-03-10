import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ["web", "whatsapp"],
      default: "web",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    role: {
      type: String,
      enum: ["student", "admin"],
    },
  },
  { timestamps: true },
);

export default mongoose.model("Feedback", feedbackSchema);
