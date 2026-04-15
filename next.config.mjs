import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadDotenv } from 'dotenv';

// Explicitly load .env.local from the app directory regardless of workspace root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(__dirname, '.env.local'), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Explicitly forward EmailJS vars so workspace root confusion doesn't block them
    NEXT_PUBLIC_EMAILJS_SERVICE_ID: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
    NEXT_PUBLIC_EMAILJS_TEMPLATE_ID: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
    NEXT_PUBLIC_EMAILJS_PUBLIC_KEY: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY,
  },
  // ── Vercel: ensure mupdf WASM binary is bundled with the pdf-parse API route ──
  // Without this, Vercel's file tracer misses the .wasm file and PDF→Word fails in prod.
  outputFileTracingIncludes: {
    '/api/pdf-parse': ['./node_modules/mupdf/dist/*.wasm'],
  },
};

export default nextConfig;
