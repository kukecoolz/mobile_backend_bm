# Mobile App Backend (Standalone) – Implementation Plan

## Goal
Standalone backend for the mobile app (separate from the website) that:

- Provides **public** signed URLs for **covers and previews** stored in Backblaze B2 (S3-compatible).
- Handles **authenticated** purchase + verification flow (MoneyUnify) and creates **orders** in Firestore.
- Provides **download links** (token-based) for purchased songs/albums that redirect to **signed B2 URLs**.

The mobile app continues to use Firebase (Auth + Firestore reads) directly. This backend only adds what the mobile app cannot do securely:

- B2 signing (requires B2 secret keys)
- Payment verification + order creation (requires trusted server)

## Auth model
- Mobile app sends Firebase ID token:
  - `Authorization: Bearer <firebase_id_token>`
- Backend verifies the token using Firebase Admin.

Public endpoints (previews/covers) do **not** require login.

## Firestore collections used
- `songs`
  - Fields used: `published`, `price_cents`, `cover_url`, `preview_url`, `audio_url`, `album_id`
- `albums`
  - Fields used: `published`, `price_cents`, `cover_url`, `zip_url`
- `orders` (created by backend)
  - Suggested fields:
    - `buyer_uid`
    - `buyer_email`
    - `amount_cents`
    - `status` ("completed")
    - `transaction_id`
    - `download_token`
    - `download_expires_at` (ISO string)
    - `created_at` (ISO string)
    - `items: [{ id, type: "song"|"album", price_cents, title, artist, cover_url }]`

**Idempotency:** `verify-payment` must not create duplicates. If an order already exists with `transaction_id == <transactionId>`, return it.

## Endpoints
### Public
1) `POST /media/signed-url`
- Used for: `cover_url`, `preview_url`
- Request:
  - `{ "path": "albums/abc/previews/x.mp3", "expiresInSeconds"?: 3600 }`
- Response:
  - `{ "url": "https://...signed..." }`
- Security:
  - allowlist object key prefixes (e.g. `albums/`, `songs/`)

### Authenticated (Firebase)
2) `POST /checkout`
- Headers:
  - `Authorization: Bearer <idToken>`
- Body:
  - `{ "songId"?: string, "albumId"?: string, "phoneNumber": string }`
- Action:
  - Loads item price from Firestore.
  - Calls MoneyUnify `request`.
- Response:
  - `{ "transactionId": string, "provider": any }`

3) `POST /verify-payment`
- Headers:
  - `Authorization: Bearer <idToken>`
- Body:
  - `{ "transactionId": string, "songId"?: string, "albumId"?: string }`
- Action:
  - Calls MoneyUnify `verify`.
  - If successful, creates/returns an `orders` document with a download token.
- Response (on success):
  - `{ "verified": true, "orderId": string, "downloadToken": string, "downloadExpiresAt": string }`

4) `GET /me/orders`
- Headers:
  - `Authorization: Bearer <idToken>`
- Returns:
  - Completed orders for the current user.

### Token-based downloads (no auth header)
5) `GET /download/:token/song/:songId`
- Validates token + expiry + item membership.
- Fetches `songs/<songId>.audio_url`.
- Redirects (302) to signed B2 download URL.

6) `GET /download/:token/album/:albumId`
- Validates token + expiry + item membership.
- Fetches `albums/<albumId>.zip_url`.
- Redirects (302) to signed B2 download URL.

## Required environment variables
Create a `.env` file (never commit secrets) based on `.env.example`:

### Firebase Admin
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### B2 (S3-compatible)
- `B2_APPLICATION_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_ENDPOINT`
- `B2_BUCKET_NAME`

### MoneyUnify
- `MONEYUNIFY_AUTH_ID`

### Server
- `PORT` (default 4000)
- `CORS_ORIGIN` (optional)

## Mobile app integration
### Browse + preview
- Read songs/albums from Firestore.
- If `cover_url`/`preview_url` is not an `http(s)` URL, call `POST /media/signed-url` to obtain a playable/displayable URL.

### Buy
- Call `POST /checkout` (auth required) → get `transactionId`.
- Poll `POST /verify-payment` (auth required) until `{ verified: true }`.
- Store `downloadToken` + `orderId`.

### Download
- Build a link using the token:
  - Song: `GET /download/<token>/song/<songId>`
  - Album: `GET /download/<token>/album/<albumId>`
- The backend redirects to a signed B2 URL.

## Deployment
Deploy this backend to a Node-friendly host (Render/Railway/Fly.io). Set the environment variables there. Configure the mobile app `API_BASE_URL` to the deployed URL.
