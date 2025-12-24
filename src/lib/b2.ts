import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

// For local serverless dev, ensure env vars are loaded even if server.ts is not used.
if (!process.env.VERCEL) {
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
}

const sanitizeEnv = (val?: string) => (val ? val.replace(/['"]/g, "").trim() : "");

let cachedClient: S3Client | null = null;
let cachedBucket: string | null = null;

function getB2Client() {
  if (cachedClient && cachedBucket) {
    return { client: cachedClient, bucket: cachedBucket };
  }

  const B2_KEY_ID = sanitizeEnv(process.env.B2_APPLICATION_KEY_ID);
  const B2_KEY = sanitizeEnv(process.env.B2_APPLICATION_KEY);
  const B2_ENDPOINT = sanitizeEnv(process.env.B2_ENDPOINT);
  const BUCKET_NAME = sanitizeEnv(process.env.B2_BUCKET_NAME);

  if (!B2_KEY_ID || !B2_KEY || !B2_ENDPOINT || !BUCKET_NAME) {
    throw new Error("Missing B2 env vars: B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_ENDPOINT, B2_BUCKET_NAME");
  }

  const REGION = B2_ENDPOINT?.split(".")[1] || "us-east-005";

  cachedClient = new S3Client({
    region: REGION,
    endpoint: `https://${B2_ENDPOINT}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: B2_KEY_ID,
      secretAccessKey: B2_KEY,
    },
  });
  cachedBucket = BUCKET_NAME;

  return { client: cachedClient, bucket: cachedBucket };
}

export async function signGetObject(path: string, expiresInSeconds: number) {
  const { client, bucket } = getB2Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: path });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
