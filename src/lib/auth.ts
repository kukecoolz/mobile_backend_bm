import type { FastifyRequest } from "fastify";
import { getAdminAuth } from "./firebaseAdmin.js";

export type AuthedUser = {
  uid: string;
  email?: string;
};

export async function requireUser(request: FastifyRequest): Promise<AuthedUser> {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const err: any = new Error("Unauthorized: missing Bearer token");
    err.statusCode = 401;
    throw err;
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    const err: any = new Error("Unauthorized: invalid token");
    err.statusCode = 401;
    throw err;
  }
}
