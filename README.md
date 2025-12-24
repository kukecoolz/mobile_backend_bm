# Mobile App Backend (Standalone)

This is a standalone backend for the React Native mobile app. It is separate from the website.

## What it does
- Public signed URLs for **covers** and **previews** stored in Backblaze B2.
- Authenticated purchase flow using **MoneyUnify**.
- Creates `orders` in Firestore after successful payment.
- Provides token-based download links that redirect to signed B2 URLs.

## Setup
1. Create a local env file and fill values:
   - Recommended: `.env.local` (gitignored)
   - You can also use `.env`
   - Use `ENV.example` as the template
2. Install deps:
   - `npm install`

## Run locally
### Option A: Serverless (recommended if deploying to Vercel)
- `npm run dev:serverless`

### Option B: Long-running server (Fastify)
- `npm run dev`

## Endpoints
- `POST /media/signed-url` (public)
- `POST /checkout` (auth)
- `POST /verify-payment` (auth)
- `GET /me/orders` (auth)
- `GET /download/:token/song/:songId` (token link)
- `GET /download/:token/album/:albumId` (token link)

See `IMPLEMENTATION_PLAN.md` for details.

## Deploy (Serverless on Vercel)
1. Deploy this folder as its own Vercel project.
2. Add env vars in Vercel Project Settings (same keys used in `.env.local`).
3. `vercel.json` rewrites keep the public paths the same (e.g. `/checkout` maps to `/api/checkout`).
