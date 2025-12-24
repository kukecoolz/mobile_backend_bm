import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";

import { registerMediaRoutes } from "./routes/media.js";
import { registerPaymentsRoutes } from "./routes/payments.js";
import { registerOrdersRoutes } from "./routes/orders.js";
import { registerDownloadRoutes } from "./routes/download.js";

// Explicitly load .env.local first (common in Next.js setups), then .env.
// This prevents missing env vars when users only define .env.local.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const app = Fastify({ logger: true });

const port = Number(process.env.PORT || 4000);

const corsOrigin = process.env.CORS_ORIGIN;
await app.register(cors, {
  origin: corsOrigin ? corsOrigin.split(",").map((s) => s.trim()) : true,
});

await app.register(registerMediaRoutes);
await app.register(registerPaymentsRoutes);
await app.register(registerOrdersRoutes);
await app.register(registerDownloadRoutes);

await app.listen({ port, host: "0.0.0.0" });
