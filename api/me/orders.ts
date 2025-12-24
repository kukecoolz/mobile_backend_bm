import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../../src/lib/http.js";
import { requireUserFromHeaders } from "../../src/lib/auth-serverless.js";
import { getAdminDb } from "../../src/lib/firebaseAdmin.js";

export default async function handler(req: IncomingMessage & { method?: string; headers: any }, res: ServerResponse) {
  try {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

    const user = await requireUserFromHeaders(req.headers);

    const snap = await getAdminDb()
      .collection("orders")
      .where("buyer_uid", "==", user.uid)
      .where("status", "==", "completed")
      .get();

    const orders = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return sendJson(res, 200, orders);
  } catch (e: any) {
    return sendJson(res, e?.statusCode || 500, { error: e?.message || "Server error" });
  }
}
