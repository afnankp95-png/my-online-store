import type { Config, Context } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { createHash, timingSafeEqual, randomInt } from "node:crypto";

// Prices are recomputed on the server so totals can't be changed from the browser.
const CATALOG: Record<string, { name: string; price: number; colors: string[] }> = {
  "orbit-lamp": { name: "Orbit Desk Lamp", price: 3499, colors: ["Chalk", "Graphite", "Sage"] },
  "slate-mugs": { name: "Slate Mug Set", price: 1299, colors: ["Slate", "Oat", "Rust"] },
  "field-pack": { name: "Field Daypack", price: 2799, colors: ["Olive", "Ink", "Sand"] },
  "loom-throw": { name: "Loom Throw", price: 1899, colors: ["Fog", "Indigo", "Clay"] },
};
const COUPON = "WHY10";
const PAY: Record<string, { off: number; prepaid?: boolean; advance?: number }> = {
  UPI: { off: 100, prepaid: true },
  Card: { off: 100, prepaid: true },
  COD: { off: 0 },
  PCOD: { off: 50, advance: 0.3 },
};
const STATUSES = ["new", "packed", "shipped", "delivered", "returned", "cancelled"];

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (msg: string, status = 400) => Response.json({ error: msg }, { status });

function isAdmin(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function createOrder(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return bad("Invalid request."); }
  const c = body?.customer || {};
  const name = str(c.name, 120), phone = str(c.phone, 10), phone2 = str(c.phone2, 10);
  const address = str(c.address, 500), city = str(c.city, 100), district = str(c.district, 100);
  const state = str(c.state, 100), pincode = str(c.pincode, 6);
  if (!name || !address || !city || !district || !state) return bad("Please fill in all delivery details.");
  if (!/^[6-9]\d{9}$/.test(phone)) return bad("Enter a valid 10-digit mobile number.");
  if (phone2 && !/^[6-9]\d{9}$/.test(phone2)) return bad("Enter a valid secondary number.");
  if (!/^[1-9]\d{5}$/.test(pincode)) return bad("Enter a valid 6-digit pincode.");

  const method = str(body?.payment, 10);
  const pay = PAY[method];
  if (!pay) return bad("Choose a payment method.");

  const rawItems = Array.isArray(body?.items) ? body.items.slice(0, 20) : [];
  const items: { id: string; name: string; color: string; qty: number; price: number }[] = [];
  for (const it of rawItems) {
    const p = CATALOG[it?.id];
    const qty = Math.floor(Number(it?.qty));
    const ci = Math.floor(Number(it?.ci));
    if (!p || !(qty >= 1 && qty <= 10) || !(ci >= 0 && ci < p.colors.length)) return bad("Your cart has an invalid item.");
    items.push({ id: it.id, name: p.name, color: p.colors[ci], qty, price: p.price });
  }
  if (!items.length) return bad("Your cart is empty.");

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const couponDiscount = body?.coupon === COUPON ? Math.round(subtotal * 0.1) : 0;
  const after = subtotal - couponDiscount;
  const paymentDiscount = Math.min(pay.off, after);
  const total = after - paymentDiscount;
  const paidNow = pay.prepaid ? total : pay.advance ? Math.round(total * pay.advance) : 0;
  const due = total - paidNow;

  const db = getDatabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNo = "WV-" + randomInt(100000, 999999);
    try {
      const [row] = await db.sql`
        INSERT INTO orders (order_no, customer_name, phone, phone2, address, city, district, state, pincode,
          items, payment_method, subtotal, coupon_discount, payment_discount, total, paid_now, due_on_delivery)
        VALUES (${orderNo}, ${name}, ${phone}, ${phone2 || null}, ${address}, ${city}, ${district}, ${state}, ${pincode},
          ${JSON.stringify(items)}::jsonb, ${method}, ${subtotal}, ${couponDiscount}, ${paymentDiscount}, ${total}, ${paidNow}, ${due})
        ON CONFLICT (order_no) DO NOTHING
        RETURNING order_no, total, paid_now, due_on_delivery, payment_method`;
      if (row) return Response.json({ order: row }, { status: 201 });
    } catch (e) {
      console.error("Order insert failed", e);
      return bad("Could not save your order. Please try again.", 500);
    }
  }
  return bad("Could not save your order. Please try again.", 500);
}

async function listOrders() {
  const db = getDatabase();
  const orders = await db.sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000`;
  return Response.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}

async function updateOrder(req: Request, orderNo: string) {
  let body: any;
  try { body = await req.json(); } catch { return bad("Invalid request."); }
  const db = getDatabase();
  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) return bad("Unknown status.");
  }
  const status = body?.status ?? null;
  const note = body?.note !== undefined ? str(body.note, 1000) : null;
  const [row] = await db.sql`
    UPDATE orders SET
      status = COALESCE(${status}, status),
      note = CASE WHEN ${note !== null} THEN ${note} ELSE note END
    WHERE order_no = ${orderNo}
    RETURNING *`;
  if (!row) return bad("Order not found.", 404);
  return Response.json({ order: row });
}

export default async (req: Request, context: Context) => {
  const orderNo = context.params?.no;
  if (req.method === "POST" && !orderNo) return createOrder(req);

  if (!process.env.ADMIN_PASSWORD) return bad("The admin password has not been set up yet.", 503);
  if (!isAdmin(req)) {
    await new Promise((r) => setTimeout(r, 600));
    return bad("Wrong password.", 401);
  }
  try {
    if (req.method === "GET" && !orderNo) return await listOrders();
    if (req.method === "PATCH" && orderNo) return await updateOrder(req, orderNo);
  } catch (e) {
    console.error("Admin request failed", e);
    return bad("Something went wrong. Please try again.", 500);
  }
  return bad("Not allowed.", 405);
};

export const config: Config = {
  path: ["/api/orders", "/api/orders/:no"],
};
