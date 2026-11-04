import { pgTable, serial, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export type OrderItem = {
  productId: string;
  name: string;
  color: string;
  qty: number;
  price: number;
};

export const orders = pgTable(
  "orders",
  {
    id: serial().primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    customerName: text("customer_name").notNull(),
    phone: text().notNull(),
    pincode: text().notNull(),
    address: text().notNull(),
    payment: text().notNull(),
    items: jsonb().$type<OrderItem[]>().notNull(),
    itemCount: integer("item_count").notNull(),
    subtotal: integer().notNull(),
    discount: integer().notNull().default(0),
    shipping: integer().notNull().default(0),
    total: integer().notNull(),
    coupon: text(),
    status: text().notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_created_at_idx").on(t.createdAt)],
);
