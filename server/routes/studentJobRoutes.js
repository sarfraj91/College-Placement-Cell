import express from "express";
import {
  getAllJobsForStudent,
  getJobDetailsForStudent,
  applyToJob,
  getAppliedJobs,
  getApplicationStatus,
} from "../controllers/studentJobController.js";

import isStudent from "../middlewares/isStudent.js";
import isLoggedIn from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(isLoggedIn, isStudent);

/* JOB DISCOVERY */
router.get("/jobs", getAllJobsForStudent);
router.get("/jobs/:jobId", getJobDetailsForStudent);

/* APPLICATION */
router.post("/jobs/:jobId/apply", applyToJob);

/* STUDENT DASHBOARD */
router.get("/applied-jobs", getAppliedJobs);
router.get("/jobs/:jobId/status", getApplicationStatus);

export default router;
