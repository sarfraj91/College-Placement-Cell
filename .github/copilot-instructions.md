# Copilot Instructions for CPC Codebase

This is a full-stack MERN application with role-based access (student/admin) and cloud image hosting via Cloudinary.

## Architecture Overview

**Two-part structure:**
- **Client** (`client/`): React 19 + Vite + React Router, no TypeScript
- **Server** (`server/`): Express.js with ES modules, MongoDB via Mongoose

**API Communication:**
- Client connects to `http://localhost:3000/api/v1` via `axios`
- Credentials sent via cookies (withCredentials: true)
- CORS configured to allow `http://localhost:5173` (client dev port)

**Key Data Flows:**
1. **Auth Flow**: Register/Login endpoints set JWT in cookies → authMiddleware verifies on protected routes
2. **File Upload**: Multer middleware → Cloudinary upload → stores public_id + secure_url in DB (avatar, documents)
3. **Role-Based Access**: User model has enum role (user/admin) → admin sees AdminDashboard, users see StudentDashboard

## Development Workflow

**Start both servers:**
```bash
# Terminal 1: Server (auto-reload with nodemon)
cd server && npm run dev

# Terminal 2: Client (Vite HMR on :5173)
cd client && npm run dev
```

**Critical Environment Setup:**
- Server reads `.env` from `server/.env` (NOT root `.env`)
- Required vars: `MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `FRONTEND_URL`
- Client hardcodes backend URL in `src/services/api.jsx` - change manually if ports differ

**Build & Preview:**
- Client: `npm run build` → outputs to `dist/`
- Server: No build step (uses ES modules directly)

## Code Organization Patterns

**Backend Structure** (`server/`):
- `models/` - Mongoose schemas with validation & methods
- `controllers/` - Request handlers that use custom `appError` class
- `routes/` - Route definitions with role-based middleware
- `middlewares/` - Auth (JWT from cookies), error handling (centralized with statusCode)
- `utils/` - `cloudinary.js` (upload helper), `errorUtils.js` (appError class), `uploadToCloudinary.js`

**Frontend Structure** (`client/src/`):
- `components/` - React components grouped by feature (auth/, admin/, student/, common/)
- `pages/` - Page-level components
- `services/` - `api.jsx` (single axios instance, no interceptors yet)
- No state management (Redux/Zustand) - uses React Router navigation

**User Model** (`server/models/userModel.js`):
- Fields: fullname, email, password (hashed), avatar (Cloudinary), role, profileCompleted (boolean)
- Has JWT methods (stored methods available at bottom of file)
- Password is `select: false` - explicitly `.select('+password')` when needed

## Project-Specific Conventions

**Error Handling:**
- Errors wrap in `appError(message, statusCode)` class from `utils/errorUtils.js`
- All errors passed to `next()` → caught by `errorMiddleware` → returns JSON: `{success, status, message, stack}`
- Example: `throw new appError("Invalid credentials", 401)`

**File Uploads:**
- Multer stores temp files in `server/uploads/` (not committed)
- Cloudinary integration in `utils/uploadToCloudinary.js` - extracts public_id automatically
- Avatar stored as nested object: `{public_id, secure_url}`

**API Versioning:**
- All routes prefixed `/api/v1/`

**Component Styling:**
- Each component paired with `.css` file (not CSS modules) - import as separate file

**No Linting on Server:**
- Server has no eslint config
- Client enforces ESLint rules on build (`npm run lint`)

## Critical Integration Points

1. **JWT Validation**: `authMiddleware.js` reads token from `req.cookies.token` - set by login endpoint
2. **Cloudinary**: Credentials come from `.env` → `cloudinary.js` helper reads them
3. **DB Connection**: `dbConnection.js` called in `server.js` startup sequence
4. **Route Protection**: Wrap routes with `isLoggedIn` middleware to require authentication
5. **Role Filtering**: Use `req.user.role` from verified JWT in controllers

## Common Modification Points

- **Add new routes**: Create controller in `controllers/`, define route in `routes/userRoutes.js`
- **Add student fields**: Extend `userSchema` in `userModel.js` (set `profileCompleted: false` default)
- **Add dashboard filters**: Modify `StudentFilter.jsx` or `AdminDashboard.jsx` components
- **Change API URL**: Update `baseURL` in `client/src/services/api.jsx`
