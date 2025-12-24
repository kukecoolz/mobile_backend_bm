import type { IncomingMessage } from "node:http";

export async function readJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {} as T;

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    const err: any = new Error("Invalid JSON body");
    err.statusCode = 400;
    throw err;
  }
}

export function sendJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function sendRedirect(res: any, location: string, status = 302) {
  res.statusCode = status;
  res.setHeader("Location", location);
  res.end();
}
