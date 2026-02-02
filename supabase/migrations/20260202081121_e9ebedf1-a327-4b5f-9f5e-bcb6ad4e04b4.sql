-- Add price column to product_images for per-image pricing
ALTER TABLE public.product_images 
ADD COLUMN price text NULL;