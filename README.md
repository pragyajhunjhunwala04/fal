# fal playground

Next.js UI for generating images and video with fal.ai models (FLUX, Recraft, Ideogram, SD 3.5, Veo 3).

## Run locally
1. Put your key in `.env`: `FAL_KEY=...`
2. `npm install && npm run dev` → http://localhost:3000

## Deploy (Vercel)
Import the repo, add `FAL_KEY` under Settings → Environment Variables, deploy.
The key stays server-side (`app/api/generate/route.js`). Models + their settings live in `app/models.js`; add one there and the UI picks it up.

Check: `node models.test.mjs`
