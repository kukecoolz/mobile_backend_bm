import type { FastifyInstance } from "fastify";
import { requireUser } from "../lib/auth.js";
import { getAdminDb } from "../lib/firebaseAdmin.js";

export async function registerOrdersRoutes(app: FastifyInstance) {
  app.get("/me/orders", async (request, reply) => {
    const user = await requireUser(request);

    const snap = await getAdminDb()
      .collection("orders")
      .where("buyer_uid", "==", user.uid)
      .where("status", "==", "completed")
      .get();

    const orders = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return reply.send(orders);
  });
}
