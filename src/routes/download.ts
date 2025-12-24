import type { FastifyInstance } from "fastify";
import { signGetObject } from "../lib/b2.js";
import { getAdminDb } from "../lib/firebaseAdmin.js";

async function findOrderByToken(token: string) {
  const snap = await getAdminDb()
    .collection("orders")
    .where("download_token", "==", token)
    .where("status", "==", "completed")
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as any;
}

function isExpired(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export async function registerDownloadRoutes(app: FastifyInstance) {
  app.get("/download/:token/song/:songId", async (request, reply) => {
    const { token, songId } = request.params as any;

    const order = await findOrderByToken(token);
    if (!order) return reply.code(404).send({ error: "Invalid download token" });
    if (!order.download_expires_at || isExpired(order.download_expires_at)) {
      return reply.code(410).send({ error: "Download link has expired" });
    }

    const hasSong = Array.isArray(order.items) && order.items.some((it: any) => it.id === songId);
    if (!hasSong) return reply.code(403).send({ error: "Song not found in order" });

    const songDoc = await getAdminDb().collection("songs").doc(songId).get();
    const song = songDoc.data() as any;
    if (!song || !song.audio_url) return reply.code(404).send({ error: "Song not found or has no audio file" });

    const url = song.audio_url.startsWith("http") ? song.audio_url : await signGetObject(song.audio_url, 3600);
    return reply.redirect(url);
  });

  app.get("/download/:token/album/:albumId", async (request, reply) => {
    const { token, albumId } = request.params as any;

    const order = await findOrderByToken(token);
    if (!order) return reply.code(404).send({ error: "Invalid download token" });
    if (!order.download_expires_at || isExpired(order.download_expires_at)) {
      return reply.code(410).send({ error: "Download link has expired" });
    }

    const hasAlbum = Array.isArray(order.items) && order.items.some((it: any) => it.id === albumId);
    if (!hasAlbum) return reply.code(403).send({ error: "Album not found in order" });

    const albumDoc = await getAdminDb().collection("albums").doc(albumId).get();
    const album = albumDoc.data() as any;
    if (!album || !album.zip_url) return reply.code(404).send({ error: "Album not found or has no ZIP file" });

    const url = album.zip_url.startsWith("http") ? album.zip_url : await signGetObject(album.zip_url, 3600);
    return reply.redirect(url);
  });
}
