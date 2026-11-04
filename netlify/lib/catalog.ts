// Server-side copy of the store's prices so order totals can't be tampered with in the browser.
// Keep in sync with the product list in index.html.
export const PRODUCTS: Record<string, { name: string; price: number; colors: string[] }> = {
  "orbit-lamp": { name: "Orbit Desk Lamp", price: 3499, colors: ["Chalk", "Graphite", "Sage"] },
  "slate-mugs": { name: "Slate Mug Set", price: 1299, colors: ["Slate", "Oat", "Rust"] },
  "field-pack": { name: "Field Daypack", price: 2799, colors: ["Olive", "Ink", "Sand"] },
  "loom-throw": { name: "Loom Throw", price: 1899, colors: ["Fog", "Indigo", "Clay"] },
};

export const COUPON = "WHY10";
export const FREE_AT = 1999;
export const SHIP_FEE = 99;
export const PAYMENTS = ["UPI", "Card", "COD"];
export const STATUSES = ["new", "packed", "shipped", "delivered", "cancelled"];
