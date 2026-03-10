import express from "express";
import {
  createJob,
  getAdminJobs,
  getSingleAdminJob,
  updateAdminJob,
  deleteAdminJob,
} from "../controllers/jobController.js";
import isAdmin from "../middlewares/isAdmin.js";
import upload from "../middlewares/multerMiddleware.js";
const router = express.Router();

router.post("/create", isAdmin, upload.single("companyLogo"), createJob);
router.get("/admin", isAdmin, getAdminJobs);
router.get("/admin/:jobId", isAdmin, getSingleAdminJob);
router.put("/admin/:jobId", isAdmin, upload.single("companyLogo"), updateAdminJob);
router.delete("/admin/:jobId", isAdmin, deleteAdminJob);

export default router;
