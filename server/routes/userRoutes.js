import { Router } from "express";
import {
  getProfile,
  login,
  logout,
  register,
  verifyEmailOtp,
  resendEmailOtp,
  postUserData,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
} from "../controllers/userController.js";
import { submitFeedback } from "../controllers/feedbackController.js";
import upload from "../middlewares/multerMiddleware.js";
import isLoggedIn from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", upload.single("avatar"), register);
// ✅ Email verification (OTP)
router.post("/verify-email", verifyEmailOtp);
router.post("/resend-otp", resendEmailOtp);
router.post("/login", login);
router.get("/logout", logout);
router.get("/profile", isLoggedIn, getProfile);
router.post(
  "/saveInfo",
  isLoggedIn,
  upload.fields([
    { name: "tenthMarksheet", maxCount: 1 },
    { name: "twelthMarksheet", maxCount: 1 },
    { name: "semesterMarksheet", maxCount: 1 },
    { name: "cocubes", maxCount: 1 },
    { name: "amcat", maxCount: 1 },
    { name: "resume", maxCount: 1 },
    { name: "other", maxCount: 5 },
  ]),
  postUserData,
);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:resetToken", resetPassword);
router.post("/change-password", isLoggedIn, changePassword);
// ✅ Public feedback/support from footer
router.post("/feedback", submitFeedback);
router.put(
  "/updateProfile",
  isLoggedIn,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "tenthMarksheet", maxCount: 1 },
    { name: "twelthMarksheet", maxCount: 1 },
    { name: "semesterMarksheet", maxCount: 1 },
    { name: "cocubes", maxCount: 1 },
    { name: "amcat", maxCount: 1 },
    { name: "resume", maxCount: 1 },
    { name: "other", maxCount: 5 },
  ]),
  updateProfile,
);

export default router;
