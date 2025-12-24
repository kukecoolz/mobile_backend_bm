import type { FastifyInstance } from "fastify";
import { signGetObject } from "../lib/b2.js";

const ALLOWED_PREFIXES = ["albums/", "songs/", "covers/", "previews/"];

function isAllowedPath(path: string) {
  return ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

export async function registerMediaRoutes(app: FastifyInstance) {
  app.post("/media/signed-url", async (request, reply) => {
    const body = (request.body ?? {}) as any;
    const path = body.path as string | undefined;

    if (!path) return reply.code(400).send({ error: "Missing path" });
    if (!isAllowedPath(path)) return reply.code(400).send({ error: "Path not allowed" });

    const expires = Math.max(60, Math.min(Number(body.expiresInSeconds || 3600), 86400));
    const url = await signGetObject(path, expires);
    return reply.send({ url });
  });
}
