import type { IncomingMessage, ServerResponse } from "node:http";
import { signGetObject } from "../../src/lib/b2.js";
import { readJsonBody, sendJson } from "../../src/lib/http.js";

const ALLOWED_PREFIXES = ["albums/", "songs/", "covers/", "previews/"];

function isAllowedPath(path: string) {
  return ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const body = await readJsonBody<any>(req);
    const path = body?.path as string | undefined;

    if (!path) return sendJson(res, 400, { error: "Missing path" });
    if (!isAllowedPath(path)) return sendJson(res, 400, { error: "Path not allowed" });

    const expires = Math.max(60, Math.min(Number(body.expiresInSeconds || 3600), 86400));
    const url = await signGetObject(path, expires);
    return sendJson(res, 200, { url });
  } catch (e: any) {
    return sendJson(res, e?.statusCode || 500, { error: e?.message || "Server error" });
  }
}
