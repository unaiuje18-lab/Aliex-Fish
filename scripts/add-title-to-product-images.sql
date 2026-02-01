-- Add title column to product_images table
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS title TEXT DEFAULT NULL;
