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
    const albumId = query.albumId as string | undefined;

    if (!token || !albumId) return sendJson(res, 400, { error: "Missing token or albumId" });

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

    const hasAlbum = Array.isArray(order.items) && order.items.some((it: any) => it.id === albumId);
    if (!hasAlbum) return sendJson(res, 403, { error: "Album not found in order" });

    const albumDoc = await getAdminDb().collection("albums").doc(albumId).get();
    const album: any = albumDoc.data();
    if (!album || !album.zip_url) return sendJson(res, 404, { error: "Album not found or has no ZIP file" });

    const url = album.zip_url.startsWith("http") ? album.zip_url : await signGetObject(album.zip_url, 3600);
    return sendRedirect(res, url, 302);
  } catch (e: any) {
    return sendJson(res, e?.statusCode || 500, { error: e?.message || "Server error" });
  }
}
