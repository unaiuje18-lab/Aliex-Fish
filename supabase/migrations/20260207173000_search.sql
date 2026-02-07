-- Enable extensions for search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Add numeric price range columns and search tsvector
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_min numeric,
  ADD COLUMN IF NOT EXISTS price_max numeric,
  ADD COLUMN IF NOT EXISTS search_tsv tsvector;

-- Search tsvector trigger
CREATE OR REPLACE FUNCTION public.update_products_search_tsv()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_tsv :=
    to_tsvector(
      'simple',
      unaccent(
        coalesce(NEW.title, '') || ' ' ||
        coalesce(NEW.subtitle, '') || ' ' ||
        coalesce(NEW.description, '') || ' ' ||
        coalesce(NEW.category, '')
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS products_search_tsv_trigger ON public.products;
CREATE TRIGGER products_search_tsv_trigger
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_products_search_tsv();

-- Indexes for search
CREATE INDEX IF NOT EXISTS products_search_tsv_idx ON public.products USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS products_title_trgm_idx ON public.products USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_price_min_idx ON public.products (price_min);
CREATE INDEX IF NOT EXISTS products_price_max_idx ON public.products (price_max);

-- Search function
CREATE OR REPLACE FUNCTION public.search_products(
  q text,
  category text DEFAULT NULL,
  min_price numeric DEFAULT NULL,
  max_price numeric DEFAULT NULL,
  limit_count integer DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  subtitle text,
  price text,
  original_price text,
  discount text,
  affiliate_link text,
  aliexpress_url text,
  main_image_url text,
  video_url text,
  rating numeric,
  review_count integer,
  is_published boolean,
  category text,
  created_at timestamptz,
  updated_at timestamptz,
  rank_score real
) AS $$
  WITH base AS (
    SELECT
      p.*,
      ts_rank(p.search_tsv, plainto_tsquery('simple', unaccent(coalesce(q, '')))) AS ts_rank,
      similarity(unaccent(p.title), unaccent(coalesce(q, ''))) AS trigram_rank
    FROM public.products p
    WHERE p.is_published = true
      AND (category IS NULL OR p.category = category)
      AND (min_price IS NULL OR p.price_max IS NULL OR p.price_max >= min_price OR p.price_min >= min_price)
      AND (max_price IS NULL OR p.price_min IS NULL OR p.price_min <= max_price OR p.price_max <= max_price)
      AND (
        q IS NULL OR q = '' OR
        p.search_tsv @@ plainto_tsquery('simple', unaccent(q)) OR
        similarity(unaccent(p.title), unaccent(q)) > 0.2
      )
  )
  SELECT
    id, slug, title, subtitle, price, original_price, discount, affiliate_link,
    aliexpress_url, main_image_url, video_url, rating, review_count, is_published,
    category, created_at, updated_at,
    (ts_rank * 0.7 + trigram_rank * 0.3) AS rank_score
  FROM base
  ORDER BY rank_score DESC NULLS LAST, review_count DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
