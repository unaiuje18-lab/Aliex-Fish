-- Create table for product images (multiple images per product)
CREATE TABLE public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Admins can manage images
CREATE POLICY "Admins can manage images"
ON public.product_images
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all images
CREATE POLICY "Admins can view all images"
ON public.product_images
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view images of published products
CREATE POLICY "Anyone can view images of published products"
ON public.product_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND products.is_published = true
  )
);