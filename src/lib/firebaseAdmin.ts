import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

// In serverless mode (Vercel), env vars come from the platform.
// For local dev, explicitly load .env.local/.env since server.ts may not run.
if (!process.env.VERCEL) {
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
}

function sanitizePrivateKey(privateKey?: string) {
  if (!privateKey) return "";
  return privateKey.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1");
}

let cachedAppInitialized = false;

function ensureFirebaseAdminInitialized() {
  if (cachedAppInitialized) return;

  if (getApps().length > 0) {
    cachedAppInitialized = true;
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  cachedAppInitialized = true;
}

export function getAdminAuth() {
  ensureFirebaseAdminInitialized();
  const app = getApps()[0]!;
  return getAuth(app);
}

export function getAdminDb() {
  ensureFirebaseAdminInitialized();
  const app = getApps()[0]!;
  return getFirestore(app);
}
