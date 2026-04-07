import express from "express";

import { chatWithPlacementAssistant } from "../controllers/chatbotController.js";
import {
  continueMockInterview,
  evaluateInterviewAnswer,
  finishMockInterview,
  generateInterviewAnswer,
  generateInterviewFollowUp,
  generateInterviewQuestions,
  startMockInterview,
} from "../controllers/interviewQaController.js";
import isLoggedIn from "../middlewares/authMiddleware.js";
import isStudent from "../middlewares/isStudent.js";
import upload from "../middlewares/multerMiddleware.js";


const router = express.Router();

router.post("/chat", isLoggedIn, chatWithPlacementAssistant);
router.post(
  "/generate-questions",
  isLoggedIn,
  isStudent,
  upload.single("resume"),
  generateInterviewQuestions,
);
router.post("/generate-answer", isLoggedIn, isStudent, generateInterviewAnswer);
router.post("/evaluate-answer", isLoggedIn, isStudent, evaluateInterviewAnswer);
router.post("/follow-up", isLoggedIn, isStudent, generateInterviewFollowUp);
router.post(
  "/mock-interview/start",
  isLoggedIn,
  isStudent,
  upload.single("resume"),
  startMockInterview,
);
router.post(
  "/mock-interview/next",
  isLoggedIn,
  isStudent,
  continueMockInterview,
);
router.post(
  "/mock-interview/finish",
  isLoggedIn,
  isStudent,
  finishMockInterview,
);

export default router;
