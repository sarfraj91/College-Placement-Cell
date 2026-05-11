# College Placement Cell

A modern full-stack placement management platform for colleges to manage students, job opportunities, applications, resumes, and AI-powered placement preparation from one clean workspace.

The system brings together a React student/admin portal, a secure Express API, MongoDB data models, Cloudinary file storage, transactional email flows, and a FastAPI AI service for resume analysis, job description generation, chatbot support, interview questions, and mock interview practice.

## Highlights

- Student registration, login, email OTP verification, and profile completion
- Admin registration, protected admin dashboard, and student management
- Detailed student profiles with academic records, skills, resume, certificates, projects, and placement status
- Job posting workflow with company details, eligibility visibility, hiring process, compensation, and deadlines
- Student job listing, job details, and application tracking
- Resume analyzer for placement readiness support
- AI placement assistant chatbot
- Interview question generator, suggested answers, answer evaluation, follow-up questions, and mock interviews
- Admin student filtering, pending/placed student views, and selected student email communication
- Cloudinary uploads for avatars, certificates, resumes, and company logos
- Brevo-powered transactional emails for OTPs, notifications, feedback, and admin communication

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, Axios, Framer Motion, Lucide React, Tailwind CSS |
| Backend | Node.js, Express 5, MongoDB, Mongoose, JWT, Multer, Cookie Parser |
| AI Service | FastAPI, Pydantic, Google GenAI, Transformers, Sentence Transformers |
| Storage & Email | Cloudinary, Brevo |
| Deployment | Vercel for client, Railway for server and AI service |

## Project Structure

```text
College Placement Cell/
+-- client/        # React + Vite frontend
+-- server/        # Express API and MongoDB models
+-- ai-service/    # FastAPI AI microservice
+-- uploads/       # Local upload directory
+-- DEPLOYMENT.md  # Production deployment guide
```

## Application Modules

### Student Portal

Students can create an account, verify their email, complete their placement profile, upload documents, browse jobs, apply for opportunities, analyze resumes, and prepare for interviews using AI-powered tools.

### Admin Portal

Admins can monitor dashboard statistics, view all students, filter students by profile and placement data, manage pending or placed students, post jobs, update job details, and contact selected students through email.

### AI Service

The AI service powers intelligent placement features such as resume matching, job description generation, chatbot support, interview question generation, answer suggestions, answer evaluation, follow-up questions, and mock interview sessions.

## Getting Started

### Prerequisites

Install these before running the project:

- Node.js 18 or later
- Python 3.10 or later
- MongoDB database
- Cloudinary account
- Brevo account
- Google AI Studio API key

## Environment Variables

Create the following environment files.

### `server/.env`

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_jwt_secret
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173,http://127.0.0.1:5173

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=verified_sender@example.com
BREVO_SENDER_NAME=College Placement Cell
BREVO_REPLY_TO_EMAIL=verified_sender@example.com

NOTIFICATION_ADMIN_EMAIL=admin@example.com
FEEDBACK_RECEIVER_EMAIL=admin@example.com
REVIEW_RECEIVER_EMAIL=admin@example.com

AI_SERVICE_URL=http://localhost:8000
```

### `client/.env`

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### `ai-service/.env`

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
ENABLE_EMBEDDING_MODEL=true
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
ENABLE_JOB_GENERATOR=false
JOB_GENERATION_MODEL=google/flan-t5-base
JOB_GENERATION_FALLBACK_MODEL=distilgpt2
```

## Run Locally

Open three terminals and run each service separately.

### 1. Start the AI service

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

AI service: `http://localhost:8000`

### 2. Start the backend server

```bash
cd server
npm install
npm run dev
```

Backend API: `http://localhost:3000`

### 3. Start the frontend

```bash
cd client
npm install
npm run dev
```

Frontend app: `http://localhost:5173`

## Main Routes

### Frontend

| Route | Purpose |
| --- | --- |
| `/` | Home page |
| `/register` | Student registration |
| `/login` | Student/admin login |
| `/student/dashboard` | Student dashboard |
| `/student/complete-profile` | Student profile form |
| `/job` | Student job list |
| `/student/resume-analyzer` | Resume analyzer |
| `/preparation/qa-generator` | Interview Q&A generator |
| `/preparation/mock-interview` | Mock interview |
| `/admin/dashboard` | Admin dashboard |
| `/admin/students` | Student management |
| `/admin/filter-students` | Student filtering |
| `/admin/post-job` | Job posting |

### Backend API

| Base Path | Description |
| --- | --- |
| `/api/v1/users` | Auth, profile, OTP, password reset, feedback |
| `/api/v1/admin` | Admin profile, dashboard, students, filters, emails |
| `/api/v1/jobs` | Job creation, updates, admin jobs, student jobs |
| `/api/v1/resume` | Resume analysis |
| `/api/v1/ai` | Chatbot, interview Q&A, mock interview |

### AI Service

| Endpoint | Description |
| --- | --- |
| `/health` | Service health check |
| `/match` | Resume matching |
| `/generate-job-description` | AI job description generation |
| `/ai/chat` | Placement assistant chatbot |
| `/ai/generate-questions` | Interview question generation |
| `/ai/evaluate-answer` | Interview answer evaluation |
| `/ai/mock-interview/start` | Start mock interview |

## Deployment

This repository is designed as a three-service monorepo:

- Deploy `client` to Vercel
- Deploy `server` to Railway
- Deploy `ai-service` to Railway

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete deployment checklist and production environment variables.

## Build Commands

```bash
# Frontend production build
cd client
npm run build

# Backend production start
cd server
npm start

# AI service production start
cd ai-service
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Why This Project Matters

College placement teams often manage student data, eligibility checks, job communication, resumes, and interview preparation across multiple disconnected tools. This project brings those workflows into one organized platform, helping students prepare better and helping administrators make faster, clearer placement decisions.

## Author

Built as a professional college placement management system with integrated AI assistance.
