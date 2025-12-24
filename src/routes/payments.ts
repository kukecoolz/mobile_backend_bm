import type { FastifyInstance } from "fastify";
import { requireUser } from "../lib/auth.js";
import { MoneyUnifyClient } from "../lib/moneyunify.js";
import { getAdminDb } from "../lib/firebaseAdmin.js";

type CheckoutBody = {
  songId?: string;
  albumId?: string;
  phoneNumber?: string;
};

type VerifyBody = {
  transactionId?: string;
  songId?: string;
  albumId?: string;
};

export async function registerPaymentsRoutes(app: FastifyInstance) {
  app.post("/checkout", async (request, reply) => {
    const user = await requireUser(request);
    const body = request.body as CheckoutBody;

    const phoneNumber = body?.phoneNumber;
    if (!phoneNumber) return reply.code(400).send({ error: "Phone number is required" });

    const songId = body?.songId;
    const albumId = body?.albumId;

    if (!songId && !albumId) return reply.code(400).send({ error: "Missing songId or albumId" });

    let priceCents = 0;

    if (songId) {
      const doc = await getAdminDb().collection("songs").doc(songId).get();
      const data = doc.data();
      if (!doc.exists || !data) return reply.code(404).send({ error: "Song not found" });
      priceCents = Number(data.price_cents || 0);
    } else if (albumId) {
      const doc = await getAdminDb().collection("albums").doc(albumId).get();
      const data = doc.data();
      if (!doc.exists || !data) return reply.code(404).send({ error: "Album not found" });
      priceCents = Number(data.price_cents || 0);
    }

    const amount = priceCents / 100;

    const client = new MoneyUnifyClient();
    const provider: any = await client.requestPayment(amount, phoneNumber);

    const transactionId = provider?.data?.transaction_id;

    return reply.send({
      transactionId,
      provider,
      buyer: { uid: user.uid, email: user.email },
    });
  });

  app.post("/verify-payment", async (request, reply) => {
    const user = await requireUser(request);
    const body = request.body as VerifyBody;

    const transactionId = body?.transactionId;
    if (!transactionId) return reply.code(400).send({ error: "Missing transactionId" });

    const songId = body?.songId;
    const albumId = body?.albumId;
    if (!songId && !albumId) return reply.code(400).send({ error: "Missing songId or albumId" });

    // Idempotency: return existing order for this transaction
    const existingOrders = await getAdminDb()
      .collection("orders")
      .where("transaction_id", "==", transactionId)
      .limit(1)
      .get();

    if (!existingOrders.empty) {
      const orderDoc = existingOrders.docs[0]!;
      const orderData = orderDoc.data();
      // Only return it if it belongs to current user
      if (orderData.buyer_uid === user.uid || orderData.buyer_email === user.email) {
        return reply.send({ verified: true, orderId: orderDoc.id, downloadToken: orderData.download_token, downloadExpiresAt: orderData.download_expires_at });
      }
      return reply.code(403).send({ error: "Order exists for this transaction but does not belong to current user" });
    }

    const client = new MoneyUnifyClient();
    const provider: any = await client.verifyPayment(transactionId);
    const status = provider?.data?.status;

    if (status !== "successful") {
      return reply.send({ verified: false, provider });
    }

    let priceCents = 0;
    let itemId = "";
    let isAlbum = false;
    let itemData: any = null;

    if (songId) {
      const songDoc = await getAdminDb().collection("songs").doc(songId).get();
      itemData = songDoc.data();
      if (!songDoc.exists || !itemData) return reply.code(404).send({ error: "Song not found" });
      priceCents = Number(itemData.price_cents || 0);
      itemId = songId;
    } else if (albumId) {
      const albumDoc = await getAdminDb().collection("albums").doc(albumId).get();
      itemData = albumDoc.data();
      if (!albumDoc.exists || !itemData) return reply.code(404).send({ error: "Album not found" });
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

    return reply.send({
      verified: true,
      orderId: orderRef.id,
      downloadToken,
      downloadExpiresAt,
      provider,
    });
  });
}
