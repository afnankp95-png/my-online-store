CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'new',
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone2 TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  items JSONB NOT NULL,
  payment_method TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  coupon_discount INTEGER NOT NULL DEFAULT 0,
  payment_discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  paid_now INTEGER NOT NULL DEFAULT 0,
  due_on_delivery INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
CREATE INDEX orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX orders_status_idx ON orders (status);
