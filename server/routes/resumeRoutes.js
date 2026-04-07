import express from "express";
import multer from "multer";
import { analyzeResumeController } from "../controllers/resumeController.js";
import isLoggedIn from "../middlewares/authMiddleware.js";
import isStudent from "../middlewares/isStudent.js";

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post(
  "/analyze",
  isLoggedIn,
  isStudent,
  upload.single("resume"),
  analyzeResumeController
);

export default router;
