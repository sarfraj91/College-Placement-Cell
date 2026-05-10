import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import morgan from 'morgan';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import resumeRoutes from './routes/resumeRoutes.js';
import jobAIRoutes from "./routes/jobDescriptionRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

import jobRoutes from './routes/jobRoutes.js';
import studentJobRoutes from "./routes/studentJobRoutes.js";
import  errorMiddleware  from './middlewares/errorMiddleware.js';
import dotenv from "dotenv";

dotenv.config();


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const defaultAllowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
];

const allowedOrigins = [
    ...defaultAllowedOrigins,
    ...(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
];

const allowedOriginPatterns = (process.env.FRONTEND_ORIGIN_PATTERNS || "")
    .split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map((pattern) => new RegExp(pattern));

const corsOptions = {
    origin(origin, callback) {
        if (
            !origin ||
            allowedOrigins.includes(origin) ||
            allowedOriginPatterns.some((pattern) => pattern.test(origin))
        ) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));




app.use(cookieParser());
app.use(morgan('dev'));

app.get('/', (req, res) => {
    res.send('API is running...');
});

// routes for other modules will be here
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/jobs', jobAIRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/student', studentJobRoutes);
app.use('/api/v1/resume', resumeRoutes);
// Legacy mount kept for backward compatibility.
app.use('/api/v1/generatejobdescription', jobAIRoutes);
app.use(errorMiddleware);



export default app;
