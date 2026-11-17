# fal playground

Next.js UI for every fal.ai image, video, audio, 3D and world model. The model list comes from
fal's live catalog, and each model's form is built from its published input schema, so every option shows up.
Files (images, video, audio) upload straight to fal storage and are passed to the model as URLs.

## Run locally
1. Put your key in `.env`: `FAL_KEY=...`
2. `npm install && npm run dev` → http://localhost:3000

## Deploy (Vercel)
Import the repo, add `FAL_KEY` under Settings → Environment Variables, redeploy.
The key stays server-side (`app/lib/fal.js`, `app/api/*`).

Check: `node models.test.mjs` (fetches a few live schemas)
