import express from "express";
import isLoggedIn from "../middlewares/authMiddleware.js";
import isAdmin from "../middlewares/isAdmin.js";
import upload from "../middlewares/multerMiddleware.js";
import {
  getDashboardStats,
  getAllStudents,
  getPendingStudents,
  getPlacedStudents,
  getStudentById,
  filterStudents,
  emailSelectedStudents,
  registerAdmin,
  verifyAdminEmailOtp,
  resendAdminEmailOtp,
  getAdminProfile,
  updateAdminProfile,
  sendAdminPasswordOtp,
  changeAdminPasswordWithOtp,
} from "../controllers/adminController.js";

const router = express.Router();

// ✅ Hidden admin self-registration + OTP verification
router.post("/register", upload.single("avatar"), registerAdmin);
router.post("/verify-email", verifyAdminEmailOtp);
router.post("/resend-otp", resendAdminEmailOtp);

// ✅ Admin profile + password OTP
router.get("/profile", isLoggedIn, isAdmin, getAdminProfile);
router.put("/profile", isLoggedIn, isAdmin, upload.single("avatar"), updateAdminProfile);
router.post("/password-otp", isLoggedIn, isAdmin, sendAdminPasswordOtp);
router.post("/change-password-otp", isLoggedIn, isAdmin, changeAdminPasswordWithOtp);

router.get("/dashboard-stats", isLoggedIn, isAdmin, getDashboardStats);
router.get("/students", isLoggedIn, isAdmin, getAllStudents);
router.get("/students/pending", isLoggedIn, isAdmin, getPendingStudents);
router.get("/students/placed", isLoggedIn, isAdmin, getPlacedStudents);
router.get(
  "/students/filter",
  isLoggedIn,
  isAdmin,
  filterStudents
);
// Send email to selected students
router.post(
  "/students/email",
  isLoggedIn,
  isAdmin,
  emailSelectedStudents
);
router.get("/students/:id", isLoggedIn, isAdmin, getStudentById);


export default router;
