# Goodkid

Goodkid helps high school students spend less time rereading and more time remembering. Upload a class PDF, add an optional test focus and study-time limit, then get a prioritized topic map, concise teaching, page references, flashcards, and mixed recall questions.

Topics are ranked by how central and well-supported they are in the uploaded PDF, whether they recur or are emphasized, and how well they match the student's stated test focus. Study sessions draw from the highest-priority topics rather than following document page order.

## Run locally

Serve this folder with a local web server. For the Vercel function, use `npx vercel dev`.

Without an API key, Goodkid uses a lightweight on-device topic sort so students can still study. For AI-ranked topics, teaching, and practice questions, set the Vercel environment variable `GEMINI_API_KEY` (the exact name) for the Production environment. The `/api/study` serverless function reads the secret on the server and sends sampled extracted PDF text (up to 60,000 characters) to Gemini; the key and original PDF are never placed in the browser bundle. After adding or changing the variable, redeploy the Vercel project so the deployment can read it. The study map identifies whether AI or the local fallback produced it, and explains when AI could not connect.

## Deploy to Vercel

Import this repository into Vercel. Use the default static site settings; no build command or framework preset is required. Add `GEMINI_API_KEY` under Project Settings → Environment Variables, select Production, save, then redeploy the latest deployment. The serverless route is in `/api/study.js`.

PDF text extraction uses PDF.js from cdnjs, and the interface uses Google Fonts; both need an internet connection. Study sets and progress are stored in local browser storage. This version does not include account sync, cloud file storage, or OCR for scanned PDFs.

