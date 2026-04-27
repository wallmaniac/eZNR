# eZNR AI Cloud Run Service (Node.js)

This is the lightweight Express backend that safely hosts the eZNR AI endpoints (`/api/risk-ai` and `/api/zia`), migrating the execution off Vercel Serverless Functions to avoid compute fees and 15-second timeouts.

## Local Testing

1. Install modules:
   ```bash
   npm install
   ```
2. Create a `.env` file in this folder and add your API Key:
   ```
   GEMINI_API_KEY=your_google_key_here
   ```
3. Start the server locally:
   ```bash
   npm start
   ```

It will run on Port 8080. You can test your frontend by temporarily changing your frontend Next.js fetch URLs to `http://localhost:8080/api/zia`.

## Deploying to Google Cloud Run

To avoid the "2 minute manual deployment" process, you have two options: 
1. **The Fast Manual Way (gcloud cli):**
   ```bash
   gcloud run deploy eznr-ai-backend --source . --port 8080 --allow-unauthenticated
   ```
   You'll then add `GEMINI_API_KEY` into the Google Cloud GUI.

2. **The Fully Automated Way (GitHub Actions - Recommended):**
   - Upload this folder to a GitHub repository alongside your Next.js app.
   - We will write a `.github/workflows/google-cloudrun.yml` script. Every time you push code to `main`, GitHub will automatically send it to Google Cloud Run and reboot the server instantly.

If you choose the automated way, let me know and I will set up the GitHub Action workflow for you!
