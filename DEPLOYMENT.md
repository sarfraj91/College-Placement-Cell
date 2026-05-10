# Deployment Guide

This project is a monorepo with three deployable apps:

- `server`: Express API, deploy to Railway.
- `ai-service`: FastAPI AI service, deploy to Railway.
- `client`: Vite React app, deploy to Vercel.

## 1. Prepare Accounts

Create or log in to:

- Railway
- Vercel
- MongoDB Atlas
- Cloudinary
- Brevo
- Google AI Studio for the Gemini API key

## 2. Deploy the AI Service to Railway

1. In Railway, create a new project from this GitHub repository.
2. Set the Railway service root directory to `ai-service`.
3. Railway will use `ai-service/railway.json`.
4. Add these variables in Railway:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
ENABLE_EMBEDDING_MODEL=true
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
ENABLE_JOB_GENERATOR=false
JOB_GENERATION_MODEL=google/flan-t5-base
JOB_GENERATION_FALLBACK_MODEL=distilgpt2
```

5. Deploy and open:

```text
https://your-ai-service.up.railway.app/health
```

You should see a JSON health response.

## 3. Deploy the Server to Railway

1. Create another Railway service from the same GitHub repository.
2. Set the service root directory to `server`.
3. Railway will use `server/railway.json`.
4. Add these variables in Railway:

```env
NODE_ENV=production
PORT=3000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=use_a_long_random_secret
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-frontend.vercel.app
FRONTEND_URLS=https://your-frontend.vercel.app
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
BREVO_API_KEY=your_brevo_transactional_api_key
BREVO_SENDER_EMAIL=verified_sender@example.com
BREVO_SENDER_NAME=MIT Placement Cell
BREVO_REPLY_TO_EMAIL=verified_sender@example.com
BREVO_TIMEOUT_MS=15000
NOTIFICATION_ADMIN_EMAIL=admin@example.com
FEEDBACK_RECEIVER_EMAIL=admin@example.com
REVIEW_RECEIVER_EMAIL=admin@example.com
AI_SERVICE_URL=https://your-ai-service.up.railway.app
```

5. Deploy and open:

```text
https://your-server.up.railway.app/
```

You should see `API is running...`.

## 4. Configure Brevo

1. In Brevo, go to Transactional Email.
2. Create or copy an SMTP/API key for transactional email.
3. Verify the sender email or sender domain.
4. Put the API key in `BREVO_API_KEY`.
5. Put the verified sender address in `BREVO_SENDER_EMAIL`.

The app now sends verification OTPs, password OTPs, feedback alerts, job invitations, and application notifications through Brevo's transactional email API.

## 5. Deploy the Frontend to Vercel

1. Import the same GitHub repository into Vercel.
2. Set the root directory to `client`.
3. Use these settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

4. Add this Vercel environment variable:

```env
VITE_API_BASE_URL=https://your-server.up.railway.app/api/v1
```

5. Add the optional footer/contact variables if you want them:

```env
VITE_SUPPORT_PHONE=
VITE_SUPPORT_WHATSAPP_URL=
VITE_SUPPORT_HOURS=10am - 6pm
VITE_SOCIAL_FACEBOOK_URL=
VITE_SOCIAL_TWITTER_URL=
VITE_SOCIAL_YOUTUBE_URL=
VITE_SOCIAL_INSTAGRAM_URL=
VITE_SOCIAL_LINKEDIN_URL=
```

6. Deploy the frontend.

## 6. Final Connection Step

After Vercel gives you the final frontend URL, go back to Railway server variables and update:

```env
FRONTEND_URL=https://your-final-frontend.vercel.app
FRONTEND_URLS=https://your-final-frontend.vercel.app
```

Then redeploy the Railway server. This is required for CORS and auth cookies.

## 7. Smoke Test

1. Open the Vercel URL.
2. Register a student with the required college email domain.
3. Confirm the OTP email arrives from Brevo.
4. Verify email, log in, and open the student dashboard.
5. Register or log in as admin.
6. Try a feature that calls AI, such as chatbot, resume analysis, or job description generation.

If login works locally but not in production, recheck `NODE_ENV=production`, `FRONTEND_URLS`, and `VITE_API_BASE_URL`.
