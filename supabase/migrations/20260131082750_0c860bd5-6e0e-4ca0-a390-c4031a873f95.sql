-- Create product_options table (for color, model, version options with images)
CREATE TABLE public.product_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_title TEXT NOT NULL DEFAULT 'Color', -- e.g., "Color", "Modelo", "Versión"
  option_label TEXT NOT NULL, -- e.g., "Rojo", "Azul", "Grande"
  option_image_url TEXT,
  extra_text TEXT, -- e.g., "7g", "4.3cm", weight, size info
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_variants table (for size variants like "7g 4.3cm", "15g 5.3cm")
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL, -- e.g., "7g 4.3cm", "15g 5.3cm"
  price_modifier TEXT, -- optional price adjustment
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Policies for product_options
CREATE POLICY "Admins can manage options"
ON public.product_options FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all options"
ON public.product_options FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view options of published products"
ON public.product_options FOR SELECT
USING (EXISTS (
  SELECT 1 FROM products
  WHERE products.id = product_options.product_id
  AND products.is_published = true
));

-- Policies for product_variants
CREATE POLICY "Admins can manage variants"
ON public.product_variants FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all variants"
ON public.product_variants FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view variants of published products"
ON public.product_variants FOR SELECT
USING (EXISTS (
  SELECT 1 FROM products
  WHERE products.id = product_variants.product_id
  AND products.is_published = true
));