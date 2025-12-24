import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson, sendRedirect } from "../../../../src/lib/http.js";
import { getAdminDb } from "../../../../src/lib/firebaseAdmin.js";
import { signGetObject } from "../../../../src/lib/b2.js";

function isExpired(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export default async function handler(req: IncomingMessage & { method?: string; query?: any }, res: ServerResponse) {
  try {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

    const query: any = (req as any).query || {};
    const token = query.token as string | undefined;
    const songId = query.songId as string | undefined;

    if (!token || !songId) return sendJson(res, 400, { error: "Missing token or songId" });

    const snap = await getAdminDb()
      .collection("orders")
      .where("download_token", "==", token)
      .where("status", "==", "completed")
      .limit(1)
      .get();

    if (snap.empty) return sendJson(res, 404, { error: "Invalid download token" });

    const order: any = snap.docs[0]!.data();
    if (!order.download_expires_at || isExpired(order.download_expires_at)) {
      return sendJson(res, 410, { error: "Download link has expired" });
    }

    const hasSong = Array.isArray(order.items) && order.items.some((it: any) => it.id === songId);
    if (!hasSong) return sendJson(res, 403, { error: "Song not found in order" });

    const songDoc = await getAdminDb().collection("songs").doc(songId).get();
    const song: any = songDoc.data();
    if (!song || !song.audio_url) return sendJson(res, 404, { error: "Song not found or has no audio file" });

    const url = song.audio_url.startsWith("http") ? song.audio_url : await signGetObject(song.audio_url, 3600);
    return sendRedirect(res, url, 302);
  } catch (e: any) {
    return sendJson(res, e?.statusCode || 500, { error: e?.message || "Server error" });
  }
}
