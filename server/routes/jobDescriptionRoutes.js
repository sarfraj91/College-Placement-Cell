import express from "express";
import { generateJobDescription } from "../controllers/generateJobDescriptionController.js";
import isLoggedIn from "../middlewares/authMiddleware.js";
import isAdmin from "../middlewares/isAdmin.js";

const router = express.Router();

router.post("/generate-description", isLoggedIn, isAdmin, generateJobDescription);

export default router;
