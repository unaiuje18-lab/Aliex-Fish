ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS group_title TEXT;

UPDATE public.product_variants
SET group_title = 'General'
WHERE group_title IS NULL OR btrim(group_title) = '';
