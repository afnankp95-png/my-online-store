import type { Config } from "@netlify/functions";
import { randomInt } from "node:crypto";
import { db } from "../../db/index.js";
import { orders, type OrderItem } from "../../db/schema.js";
import { PRODUCTS, COUPON, FREE_AT, SHIP_FEE, PAYMENTS } from "../lib/catalog.js";

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Method not allowed", 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request");
  }

  const name = String(body?.name ?? "").trim().slice(0, 120);
  const phone = String(body?.phone ?? "").trim();
  const pincode = String(body?.pincode ?? "").trim();
  const address = String(body?.address ?? "").trim().slice(0, 600);
  const payment = String(body?.payment ?? "");
  if (!name || !address) return bad("Enter your name and delivery address.");
  if (!/^[6-9]\d{9}$/.test(phone)) return bad("Enter a valid 10-digit mobile number.");
  if (!/^[1-9]\d{5}$/.test(pincode)) return bad("Enter a valid 6-digit pincode.");
  if (!PAYMENTS.includes(payment)) return bad("Choose a payment method.");

  const rawItems = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
  const items: OrderItem[] = [];
  for (const it of rawItems) {
    const p = PRODUCTS[String(it?.id)];
    const qty = Math.floor(Number(it?.qty));
    if (!p || !(qty >= 1 && qty <= 10)) continue;
    const ci = Math.floor(Number(it?.ci));
    items.push({
      productId: String(it.id),
      name: p.name,
      color: p.colors[ci] ?? p.colors[0],
      qty,
      price: p.price,
    });
  }
  if (!items.length) return bad("Your cart is empty.");

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const coupon = String(body?.coupon ?? "").toUpperCase() === COUPON ? COUPON : null;
  const discount = coupon ? Math.round(subtotal * 0.1) : 0;
  const after = subtotal - discount;
  const shipping = after === 0 || after >= FREE_AT ? 0 : SHIP_FEE;
  const total = after + shipping;
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = "WV-" + randomInt(100000, 999999);
    try {
      const [row] = await db
        .insert(orders)
        .values({ orderNumber, customerName: name, phone, pincode, address, payment, items, itemCount, subtotal, discount, shipping, total, coupon })
        .returning({ orderNumber: orders.orderNumber, total: orders.total });
      return Response.json(row, { status: 201 });
    } catch (e: any) {
      if (String(e?.code ?? e?.cause?.code) !== "23505") throw e; // retry only on duplicate order number
    }
  }
  return bad("Could not place the order. Please try again.", 500);
};

export const config: Config = { path: "/api/orders" };
