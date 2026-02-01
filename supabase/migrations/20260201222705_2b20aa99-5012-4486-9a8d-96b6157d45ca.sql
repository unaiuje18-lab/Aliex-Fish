-- Add title column to product_images for optional image titles
ALTER TABLE public.product_images 
ADD COLUMN title TEXT;