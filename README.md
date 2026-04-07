# Placement Cell Management System

MERN-based placement platform with:
- student/admin auth + OTP verification
- student profile/document management
- admin student filtering and email workflows
- invite-only job application flow
- admin job analytics with applicant tracking

---

## What Is Implemented (Latest)

### 1) Admin job posting and invitation-based access
- Admin creates jobs from `/admin/post-job`.
- Job is saved with `postedBy` and `eligibleStudents` list.
- Admin invites selected students from `/admin/filter-students` using:
  - selected students
  - selected posted job
  - custom email subject + message
- On invitation send:
  - `User.allowed` is set `true` for selected students
  - selected student IDs are added into `Job.eligibleStudents`
  - invitation email includes direct job link (`/student/jobs/:jobId`)

### 2) Student can apply only when invited
- Student job list (`/job`) and dashboard "Available Jobs" section show all jobs posted by admin.
- Student can open job details via:
  - dashboard/list
  - invitation email direct link
- Student can apply only if:
  - role = student
  - `allowed === true`
  - student ID exists in `Job.eligibleStudents`
  - application deadline is not over
  - student has not already applied
  - student can apply from dashboard card (`Apply Now`) or job detail page

### 3) Email-link experience fixed
- Protected route now preserves original destination (e.g. `/student/jobs/:jobId`).
- After login, student is redirected back to the same job detail page.

### 4) Admin gets notified on application
- When student applies:
  - application record is created
  - admin who posted that job receives email notification

### 5) Admin dashboard application analytics
- Dashboard now includes:
  - total jobs posted by admin
  - total applications on admin’s jobs
  - jobs with zero applications
  - per-job applicant list (who applied)
- Admin can still open student full details using drawer/profile view.

### 6) Admin job CRUD + company logo
- Admin can edit job posts from dashboard.
- Admin can update logo, title, description, visibility, deadlines, salary, etc.
- Admin can delete job posts (and related applications).
- Company logo upload is supported during create and update.

### 7) AI resume intelligence
- Resume analysis keeps the existing keyword score and now also calls the FastAPI AI service for semantic matching.
- FastAPI `POST /match` returns:
  - `semantic_score`
  - `raw_similarity`
  - `resume_skills`
  - `job_skills`
  - `matched_skills`
  - `missing_skills`
  - `skill_gap_percent`
  - `suggestions`
- Skill Gap Detection compares extracted resume skills against job skills and highlights missing technologies.
- Resume Suggestions combine keyword-based guidance with AI-generated improvement ideas such as adding missing tools, project evidence, and measurable achievements.
- Job Recommendation Engine uses extracted resume skills to search internal MongoDB jobs and returns up to 5 recommended jobs with matched skills.
- External Job Leads generate source-specific search/apply links for LinkedIn, Naukri, and Unstop so students can continue the application on the source website.
- Final resume analysis response now includes:
  - `finalScore`
  - `keywordScore`
  - `semanticScore`
  - `matchedSkills`
  - `missingSkills`
  - `suggestions`
  - `recommendedJobs`
  - `externalJobs`

### 8) AI job description generator
- Admin job posting uses a backend AI bridge before publishing a role.
- FastAPI `POST /generate-job-description` supports:
  - fresh job description generation
  - controlled regeneration using admin improvement instructions
  - safe fallback templates when the generator model is unavailable
- The React admin form keeps the generated description editable before final save, so admins can review and refine every output.

### 9) Placement chatbot assistant
- Student dashboard now includes a professional placement chatbot widget.
- Backend `POST /api/v1/ai/chat` proxies requests to the FastAPI AI service and keeps an authenticated app-level endpoint for the frontend.
- FastAPI `POST /chat` answers placement-related questions using:
  - placement knowledge base content
  - retrieval over relevant topics
  - generator-based answers when available
  - safe fallback guidance when the model is unavailable
- Chatbot scope includes:
  - resume and ATS guidance
  - interview preparation
  - skill-gap planning
  - placement and job-search strategy

### 10) AI mock interview simulation
- Student can open `/preparation/mock-interview`, upload a resume PDF, choose:
  - target role
  - English level
  - interview difficulty
  - total interview questions
- Before starting, the frontend now verifies:
  - camera + microphone permission
  - live camera preview
  - microphone activity meter
  - speaker test playback confirmation
  - rules/instructions acknowledgement
- Backend `POST /api/v1/ai/mock-interview/start` extracts resume context and starts a resume-aware interview session.
- Backend `POST /api/v1/ai/mock-interview/next` continues the interview with:
  - interviewer reply to the candidate answer
  - deeper follow-up or next question
  - end-of-interview handling when the planned question count is reached
- Backend `POST /api/v1/ai/mock-interview/finish` returns:
  - interview summary
  - strengths
  - improvement areas
  - overall / communication / technical / confidence scores
  - integrity note when proctoring signals were raised
- FastAPI mock interview endpoints now generate human-style interviewer turns with structured fallback behavior when the model is unavailable.
- Frontend tracks best-effort integrity signals during the session:
  - tab hidden / focus lost
  - fullscreen exit
  - copy / paste / context menu / shortcut attempts
  - camera darkness / obstruction
  - excessive movement in frame
  - face missing or multiple faces when browser `FaceDetector` support exists

---

## Core Files Added/Updated

### Backend
- `server/models/userModel.js`
  - uses `allowed: Boolean` (default `false`) for invite/apply gate
- `server/models/jobModel.js`
  - added `eligibleStudents: [ObjectId(User)]`
  - company logo stored as `{ public_id, secure_url }`
  - improved `visibility` enum/default
  - `postedBy` now references `User` and is required
- `server/models/applicationModel.js` (new)
  - stores `{ student, job, status, appliedAt }`
  - unique compound index on `{ student, job }`
- `server/middlewares/isStudent.js` (new)
  - restricts student-only routes
- `server/controllers/studentJobController.js`
  - all-job listing/details with invite-based apply control
  - deadline handling
  - duplicate-apply prevention
  - admin email notification on apply
- `server/controllers/jobController.js`
  - create job with company logo upload
  - fetch admin posted jobs (`/jobs/admin`) with invited/applicant counts
  - get single job (`/jobs/admin/:jobId`)
  - update job (`PUT /jobs/admin/:jobId`)
  - delete job (`DELETE /jobs/admin/:jobId`)
- `server/controllers/resumeController.js`
  - parses uploaded resume PDFs
  - combines keyword matching with FastAPI semantic matching
  - merges skill gap results, suggestions, and internal job recommendations
- `server/controllers/generateJobDescriptionController.js`
  - validates admin generation requests
  - forwards structured job metadata to the FastAPI AI service
  - keeps template fallback behavior when AI is unavailable
- `server/controllers/chatbotController.js`
  - forwards placement chatbot requests to FastAPI
  - preserves safe fallback answers if the AI service is down
- `server/controllers/interviewQaController.js`
  - interview question / answer / feedback endpoints
  - mock interview start / next / finish endpoints with FastAPI proxy and local fallback behavior
- `server/controllers/adminController.js`
  - dashboard stats extended with job/application analytics
  - student list responses normalized (`{ success, students }`)
  - email invitation endpoint now requires `jobId`
  - invitation endpoint updates `User.allowed=true` and `Job.eligibleStudents`
- `server/utils/resumeAnalyzer.js`
  - keyword-based resume/job skill extraction
  - fallback skill gap scoring and resume suggestions when AI is unavailable
- `server/routes/studentJobRoutes.js`
  - mounted with `isLoggedIn + isStudent`
- `server/routes/jobRoutes.js`
  - `POST /create`, `GET /admin`, `GET /admin/:jobId`, `PUT /admin/:jobId`, `DELETE /admin/:jobId`
- `server/routes/aiRoutes.js`
  - `POST /api/v1/ai/chat` for chatbot queries
  - `POST /api/v1/ai/mock-interview/start`
  - `POST /api/v1/ai/mock-interview/next`
  - `POST /api/v1/ai/mock-interview/finish`
- `server/app.js`
  - mounted `/api/v1/student`, `/api/v1/resume`, `/api/v1/jobs/generate-description`, and `/api/v1/ai` routes
- `ai-service/main.py`
  - FastAPI app entry with health route and AI routers, including mock interview routes
- `ai-service/models/schemas.py`
  - typed request/response models for mock interview start / next / finish
- `ai-service/routers/mock_interview_router.py`
  - FastAPI router for mock interview conversation turns
- `ai-service/services/mock_interview_service.py`
  - interviewer-style prompt flow, next-turn generation, and final summary fallback logic
- `ai-service/routes/match.py`
  - semantic and fallback lexical resume matching
- `ai-service/routes/job_generator.py`
  - job description generation/regeneration endpoint
- `ai-service/routes/chat.py`
  - placement chatbot endpoint
- `ai-service/services/model_loder.py`
  - shared model registry with safe lazy loading
- `ai-service/services/embedding_service.py`
  - semantic scoring, lexical fallback scoring, and skill-gap extraction
- `ai-service/services/job_service.py`
  - prompt building, output cleanup, and fallback job description generation
- `ai-service/services/chatbot_service.py`
  - placement knowledge retrieval and chatbot answer generation
- `ai-service/requirements.txt`
  - Python dependencies for the AI service runtime

### Frontend
- `client/src/services/jobApi.jsx`
  - added admin + student job endpoints
- `client/src/services/chatbotApi.jsx`
  - chatbot request helper
- `client/src/services/interviewQaApi.jsx`
  - interview QA helpers plus mock interview start / next / finish helpers
- `client/src/components/job/PostJob.jsx`
  - modern responsive animated job posting form
- `client/src/components/admin/FilterStudent.jsx`
  - job-select + invite-email workflow
- `client/src/components/admin/AdminDashboard.jsx`
  - redesigned dashboard + job CRUD manager + logo preview/update
- `client/src/components/student/JobList.jsx`
  - available jobs list with apply eligibility status
  - direct entry into resume analysis for a selected job
- `client/src/components/student/JobDetails.jsx`
  - full details + apply button with dynamic state
  - direct entry into resume analysis for the opened job
- `client/src/components/student/MockInterview.jsx`
  - setup flow for resume upload, device checks, rules acknowledgement, and interview start
- `client/src/components/student/InterviewCore.jsx`
  - live mock interview experience, interviewer follow-up flow, speech input, transcript, and final summary
- `client/src/components/student/ResumeAnalyzer.jsx`
  - listed-job and custom-description resume analysis
  - job-aware deep-link support through query params
- `client/src/components/student/ChatBot.jsx`
  - authenticated placement assistant widget
- `client/src/components/student/StudentDashboard.jsx`
  - redesigned dashboard + direct apply from available jobs cards
  - embedded placement chatbot assistant
- `client/src/components/common/ProtectedRoute.jsx`
  - redirect state preserved for deep links
- `client/src/components/auth/Login.jsx`
  - post-login redirect to original invited job URL
- `client/src/App.jsx`
  - added `/student/jobs/:jobId`
  - added `/preparation/qa-generator`
  - added `/preparation/mock-interview`

---

## Workflow (End-to-End)

### Admin Side
1. Login as admin.
2. Go to `/admin/post-job` and create a job.
3. Go to `/admin/filter-students`, filter/select students.
4. Select posted job in invitation panel.
5. Send invitation email.

Result:
- selected students get invitation email + job link
- selected students become eligible to apply

### Student Side
1. Student receives invitation email.
2. Opens job link from email (if not logged in, login first).
3. After login, user is redirected back to invited job page.
4. Student can also open the same job from dashboard/list and apply from job detail page.

Result:
- application is saved
- duplicate apply blocked
- admin receives email notification
- application appears in admin dashboard insights

### Mock Interview Flow
1. Student opens `/preparation/mock-interview`.
2. Uploads resume PDF and selects role, English level, difficulty, and question count.
3. Grants camera + microphone permission, confirms speaker playback, and accepts the rules.
4. Frontend calls `POST /api/v1/ai/mock-interview/start`.
5. Backend extracts resume text and starts a resume-aware interview through FastAPI.
6. Student answers each question by typing or using browser speech recognition.
7. Frontend calls `POST /api/v1/ai/mock-interview/next` after every answer.
8. When the interview ends, frontend calls `POST /api/v1/ai/mock-interview/finish`.

Result:
- interviewer replies feel conversational instead of one-shot Q&A
- follow-up questions adapt to the previous answer
- interview summary includes strengths, improvements, and scores
- integrity signals are included in the final review when raised

---

## Routing and Controllers

### Backend Route Map

#### User routes (`/api/v1/users`) -> `server/routes/userRoutes.js`
- Auth/profile/OTP/password/feedback routes
- Controller: `server/controllers/userController.js`, `server/controllers/feedbackController.js`

#### Admin routes (`/api/v1/admin`) -> `server/routes/adminRoutes.js`
- dashboard stats, students lists, filter, email invite, admin profile/auth
- Controller: `server/controllers/adminController.js`

#### Job routes (`/api/v1/jobs`) -> `server/routes/jobRoutes.js`
- `POST /create` -> create job (admin, supports company logo upload)
- `GET /admin` -> admin jobs list with counts
- `GET /admin/:jobId` -> fetch one admin job
- `PUT /admin/:jobId` -> update admin job (supports company logo upload)
- `DELETE /admin/:jobId` -> delete admin job + related applications
- Controller: `server/controllers/jobController.js`

#### AI routes (`/api/v1/ai`) -> `server/routes/aiRoutes.js`
- `POST /chat` -> placement chatbot request proxy
- `POST /generate-questions` -> resume-based interview question generation
- `POST /generate-answer` -> model answer generation
- `POST /evaluate-answer` -> answer review and scoring
- `POST /follow-up` -> deeper interview follow-up generation
- `POST /mock-interview/start` -> begin resume-aware mock interview
- `POST /mock-interview/next` -> continue interviewer conversation
- `POST /mock-interview/finish` -> final interview summary
- Controller: `server/controllers/chatbotController.js`, `server/controllers/interviewQaController.js`

#### Student job routes (`/api/v1/student`) -> `server/routes/studentJobRoutes.js`
- `GET /jobs` -> all admin-posted jobs with per-student apply flags (`canApply`, `isInvited`, `hasApplied`)
- `GET /jobs/:jobId` -> job details with per-student apply flags
- `POST /jobs/:jobId/apply` -> apply
- `GET /applied-jobs` -> student’s applied jobs
- `GET /jobs/:jobId/status` -> single job application status
- Controller: `server/controllers/studentJobController.js`

### Middleware used
- `server/middlewares/authMiddleware.js` -> JWT cookie auth
- `server/middlewares/isAdmin.js` -> admin authorization
- `server/middlewares/isStudent.js` -> student authorization
- `server/middlewares/errorMiddleware.js` -> central error handler

---

## Packages and Libraries Used

### Frontend (`client/package.json`)
- `react`, `react-dom`
- `react-router-dom`
- `axios`
- `framer-motion`
- `tailwindcss`, `@tailwindcss/vite`
- `vite`, `@vitejs/plugin-react`
- lint/build deps (`eslint`, etc.)

### Backend (`server/package.json`)
- `express`
- `mongoose`
- `jsonwebtoken`
- `bcryptjs`
- `cookie-parser`
- `cors`
- `morgan`
- `multer`
- `nodemailer`
- `cloudinary`
- `dotenv`
- utility deps (`path`, `url`, etc.)

### AI Service (`ai-service`)
- `fastapi`
- `uvicorn`
- `pydantic`
- `sentence-transformers`
- `transformers`
- `torch`

## Mock Interview Tools Used

### Browser / frontend side
- `navigator.mediaDevices.getUserMedia()` for camera + microphone permission and live preview
- `SpeechSynthesisUtterance` for interviewer voice playback
- `SpeechRecognition` / `webkitSpeechRecognition` for optional voice answer input
- `FaceDetector` when available for face-presence / multi-face signals
- `CanvasRenderingContext2D.getImageData()` for basic camera brightness and motion checks
- `visibilitychange`, `blur`, `fullscreenchange`, `copy`, `paste`, `cut`, `contextmenu`, and `keydown` events for best-effort interview integrity tracking

### Backend / service side
- Express authenticated proxy routes under `/api/v1/ai/mock-interview/*`
- FastAPI mock interview router under `/ai/mock-interview/*`
- resume parsing + resume context extraction before interview start
- Gemini-backed interviewer prompts with local structured fallbacks when the model is unavailable

### Important limitation
- The anti-cheating layer is best-effort only. Browsers cannot guarantee impossible cheating, and speaker output still needs user confirmation. The current implementation is designed to detect common signals and make cheating harder, not to provide strict exam-grade remote proctoring.

---

## Local Run

### 1) Install dependencies
```bash
cd server && npm install
cd ../client && npm install
cd ../ai-service && python -m pip install -r requirements.txt
```

### 2) Start AI service
```bash
cd ai-service
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

### 3) Start backend
```bash
cd server
npm run dev
```

### 4) Start frontend
```bash
cd client
npm run dev
```

---

## Environment Variables (`server/.env`)

```env
PORT=3000
MONGO_URI=your_mongo_uri

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:5173
AI_SERVICE_URL=http://127.0.0.1:8001

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_ADMIN=Placement Cell <your_email@gmail.com>

CLOUDINARY_CLOUD_NAME=xxxx
CLOUDINARY_API_KEY=xxxx
CLOUDINARY_API_SECRET=xxxx
```

## Optional Frontend Env (`client/.env`)

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

---

## Notes
- Job invitation flow requires selecting a job in admin email panel.
- All jobs are visible to students; only invited/allowed students can apply.
- Invite gate is controlled by `User.allowed`.
- Application deadline is validated; apply closes after the last date.
- Admin dashboard includes job edit/update/delete and application insights.
- Resume analysis preserves the existing keyword score and blends it with AI semantic score when the FastAPI service is reachable.
- If the AI service is unavailable, keyword analysis still works and continues to return fallback skill-gap metadata.
- Job description generation and chatbot responses both keep safe fallback behavior so the platform still works even when the generator model is not available.
