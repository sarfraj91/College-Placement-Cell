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
- `server/controllers/adminController.js`
  - dashboard stats extended with job/application analytics
  - student list responses normalized (`{ success, students }`)
  - email invitation endpoint now requires `jobId`
  - invitation endpoint updates `User.allowed=true` and `Job.eligibleStudents`
- `server/routes/studentJobRoutes.js`
  - mounted with `isLoggedIn + isStudent`
- `server/routes/jobRoutes.js`
  - `POST /create`, `GET /admin`, `GET /admin/:jobId`, `PUT /admin/:jobId`, `DELETE /admin/:jobId`
- `server/app.js`
  - mounted `/api/v1/student` routes

### Frontend
- `client/src/services/jobApi.jsx`
  - added admin + student job endpoints
- `client/src/components/job/PostJob.jsx`
  - modern responsive animated job posting form
- `client/src/components/admin/FilterStudent.jsx`
  - job-select + invite-email workflow
- `client/src/components/admin/AdminDashboard.jsx`
  - redesigned dashboard + job CRUD manager + logo preview/update
- `client/src/components/student/JobList.jsx`
  - available jobs list with apply eligibility status
- `client/src/components/student/JobDetails.jsx`
  - full details + apply button with dynamic state
- `client/src/components/student/StudentDashboard.jsx`
  - redesigned dashboard + direct apply from available jobs cards
- `client/src/components/common/ProtectedRoute.jsx`
  - redirect state preserved for deep links
- `client/src/components/auth/Login.jsx`
  - post-login redirect to original invited job URL
- `client/src/App.jsx`
  - added `/student/jobs/:jobId` route

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

---

## Local Run

### 1) Install dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 2) Start backend
```bash
cd server
npm run dev
```

### 3) Start frontend
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

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_ADMIN=Placement Cell <your_email@gmail.com>

CLOUDINARY_CLOUD_NAME=xxxx
CLOUDINARY_API_KEY=xxxx
CLOUDINARY_API_SECRET=xxxx
```

---

## Notes
- Job invitation flow requires selecting a job in admin email panel.
- All jobs are visible to students; only invited/allowed students can apply.
- Invite gate is controlled by `User.allowed`.
- Application deadline is validated; apply closes after the last date.
- Admin dashboard includes job edit/update/delete and application insights.
