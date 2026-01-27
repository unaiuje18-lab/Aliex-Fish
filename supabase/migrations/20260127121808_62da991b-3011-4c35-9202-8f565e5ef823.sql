-- Add category column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);