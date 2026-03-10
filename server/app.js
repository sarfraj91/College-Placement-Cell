import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import morgan from 'morgan';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import studentJobRoutes from "./routes/studentJobRoutes.js";
import  errorMiddleware  from './middlewares/errorMiddleware.js';
import dotenv from "dotenv";
dotenv.config();


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));




app.use(cookieParser());
app.use(morgan('dev'));

app.get('/', (req, res) => {
    res.send('API is running...');
});

// routes for other modules will be here
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/student', studentJobRoutes);
app.use(errorMiddleware);



export default app;
