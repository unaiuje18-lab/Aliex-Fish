
-- site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id integer PRIMARY KEY DEFAULT 1,
  hero_title text NOT NULL DEFAULT 'Los mejores productos de pesca de todo AliExpress',
  hero_subtitle text NOT NULL DEFAULT 'Encuentra los mejores precios en artículos de pesca directamente desde AliExpress.',
  footer_text text NOT NULL DEFAULT '© 2025 AliexFISH. Todos los derechos reservados.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage site settings" ON public.site_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- site_social_links table
CREATE TABLE IF NOT EXISTS public.site_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  url text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view social links" ON public.site_social_links FOR SELECT USING (true);
CREATE POLICY "Admins can manage social links" ON public.site_social_links FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- analytics_events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  path text,
  product_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view analytics" ON public.analytics_events FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
