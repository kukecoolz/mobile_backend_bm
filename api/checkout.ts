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

    const phoneNumber = body?.phoneNumber as string | undefined;
    const songId = body?.songId as string | undefined;
    const albumId = body?.albumId as string | undefined;

    if (!phoneNumber) return sendJson(res, 400, { error: "Phone number is required" });
    if (!songId && !albumId) return sendJson(res, 400, { error: "Missing songId or albumId" });

    let priceCents = 0;

    if (songId) {
      const doc = await getAdminDb().collection("songs").doc(songId).get();
      const data = doc.data();
      if (!doc.exists || !data) return sendJson(res, 404, { error: "Song not found" });
      priceCents = Number(data.price_cents || 0);
    } else if (albumId) {
      const doc = await getAdminDb().collection("albums").doc(albumId).get();
      const data = doc.data();
      if (!doc.exists || !data) return sendJson(res, 404, { error: "Album not found" });
      priceCents = Number(data.price_cents || 0);
    }

    const amount = priceCents / 100;
    const client = new MoneyUnifyClient();
    const provider: any = await client.requestPayment(amount, phoneNumber);

    return sendJson(res, 200, {
      transactionId: provider?.data?.transaction_id,
      provider,
      buyer: { uid: user.uid, email: user.email },
    });
  } catch (e: any) {
    return sendJson(res, e?.statusCode || 500, { error: e?.message || "Server error" });
  }
}
