import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders } from "../../db/schema.js";
import { isAdmin } from "../lib/auth.js";
import { STATUSES } from "../lib/catalog.js";

export default async (req: Request) => {
  if (!process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "The admin password has not been set up yet." }, { status: 503 });
  }
  if (!isAdmin(req)) return Response.json({ error: "Wrong password." }, { status: 401 });

  if (req.method === "GET") {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5000);
    return Response.json({ orders: rows });
  }

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    const status = String(body?.status ?? "");
    if (!Number.isInteger(id) || !STATUSES.includes(status)) {
      return Response.json({ error: "Invalid update." }, { status: 400 });
    }
    const [row] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    if (!row) return Response.json({ error: "Order not found." }, { status: 404 });
    return Response.json({ order: row });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};

export const config: Config = { path: "/api/admin/orders" };
