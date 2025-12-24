import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody, sendJson } from "../src/lib/http.js";
import { requireUserFromHeaders } from "../src/lib/auth-serverless.js";
import { getAdminDb } from "../src/lib/firebaseAdmin.js";
import { MoneyUnifyClient } from "../src/lib/moneyunify.js";

export default async function handler(req: IncomingMessage & { method?: string; headers: any }, res: ServerResponse) {
  try {
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

    const user = await requireUserFromHeaders(req.headers);
    const body = await readJsonBody<any>(req);

    const transactionId = body?.transactionId as string | undefined;
    const songId = body?.songId as string | undefined;
    const albumId = body?.albumId as string | undefined;

    if (!transactionId) return sendJson(res, 400, { error: "Missing transactionId" });
    if (!songId && !albumId) return sendJson(res, 400, { error: "Missing songId or albumId" });

    const existingOrders = await getAdminDb()
      .collection("orders")
      .where("transaction_id", "==", transactionId)
      .limit(1)
      .get();

    if (!existingOrders.empty) {
      const orderDoc = existingOrders.docs[0]!;
      const orderData: any = orderDoc.data();
      if (orderData.buyer_uid === user.uid || orderData.buyer_email === user.email) {
        return sendJson(res, 200, {
          verified: true,
          orderId: orderDoc.id,
          downloadToken: orderData.download_token,
          downloadExpiresAt: orderData.download_expires_at,
        });
      }
      return sendJson(res, 403, { error: "Order exists for this transaction but does not belong to current user" });
    }

    const client = new MoneyUnifyClient();
    const provider: any = await client.verifyPayment(transactionId);
    const status = provider?.data?.status;

    if (status !== "successful") {
      return sendJson(res, 200, { verified: false, provider });
    }

    let priceCents = 0;
    let itemId = "";
    let isAlbum = false;
    let itemData: any = null;

    if (songId) {
      const songDoc = await getAdminDb().collection("songs").doc(songId).get();
      itemData = songDoc.data();
      if (!songDoc.exists || !itemData) return sendJson(res, 404, { error: "Song not found" });
      priceCents = Number(itemData.price_cents || 0);
      itemId = songId;
    } else if (albumId) {
      const albumDoc = await getAdminDb().collection("albums").doc(albumId).get();
      itemData = albumDoc.data();
      if (!albumDoc.exists || !itemData) return sendJson(res, 404, { error: "Album not found" });
      priceCents = Number(itemData.price_cents || 0);
      itemId = albumId;
      isAlbum = true;
    }

    const downloadToken = crypto.randomUUID();
    const downloadExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const orderData = {
      buyer_uid: user.uid,
      buyer_email: user.email || null,
      amount_cents: priceCents,
      status: "completed",
      download_token: downloadToken,
      download_expires_at: downloadExpiresAt,
      created_at: new Date().toISOString(),
      transaction_id: transactionId,
      items: [
        {
          id: itemId,
          type: isAlbum ? "album" : "song",
          price_cents: priceCents,
          title: itemData.title,
          artist: itemData.artist,
          cover_url: itemData.cover_url,
        },
      ],
    };

    const orderRef = await getAdminDb().collection("orders").add(orderData);

    return sendJson(res, 200, {
      verified: true,
      orderId: orderRef.id,
      downloadToken,
      downloadExpiresAt,
      provider,
    });
  } catch (e: any) {
    return sendJson(res, e?.statusCode || 500, { error: e?.message || "Server error" });
  }
}
