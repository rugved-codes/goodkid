# Goodkid

Goodkid turns class PDFs into a short, plain-language lesson and a practice quiz. It is designed for high school students and uses active recall, retrieval practice, and targeted review to help students prepare for tests.

## Run locally

Serve this folder with any local static web server. For example, run `npx vercel dev` to use the same routes as deployment.

Without an API key, Goodkid builds a basic study set from selectable PDF text in the browser. For AI-generated lessons and questions, set `GEMINI_API_KEY` in the Vercel project environment variables. The serverless function sends only extracted text (up to 60,000 characters) to Gemini; the PDF itself stays in the browser.

## Deploy to Vercel

Import this repository into Vercel. Use the default static site settings; no build command or framework preset is required. Add `GEMINI_API_KEY` as an environment variable to enable AI study sets. The `/api/study` function uses Vercel's Node.js runtime.

PDF text extraction uses PDF.js from cdnjs, and the interface uses Google Fonts. Both need an internet connection. Browser storage keeps study sets and progress on the current device; this starter version does not include account sync, cloud file storage, or a scanned-PDF OCR service.

## Privacy

Files are read locally in the browser and are not uploaded. If `GEMINI_API_KEY` is configured, Goodkid sends extracted text to Google's Gemini API to create the study set. Without the key, generated questions use the local fallback. Study sets and quiz history are stored in local browser storage.

