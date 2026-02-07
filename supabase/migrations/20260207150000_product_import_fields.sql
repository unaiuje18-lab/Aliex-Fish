-- Add extra fields for imported product data
ALTER TABLE public.products
  ADD COLUMN description TEXT,
  ADD COLUMN shipping_cost TEXT,
  ADD COLUMN delivery_time TEXT,
  ADD COLUMN sku TEXT,
  ADD COLUMN orders_count INTEGER DEFAULT 0;
