-- Create site_settings table for global copy
CREATE TABLE public.site_settings (
    id integer PRIMARY KEY,
    hero_title text NOT NULL,
    hero_subtitle text NOT NULL,
    footer_text text NOT NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view site settings
CREATE POLICY "Anyone can view site settings"
ON public.site_settings FOR SELECT
USING (true);

-- Only admins can manage site settings
CREATE POLICY "Admins can manage site settings"
ON public.site_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Seed default row
INSERT INTO public.site_settings (id, hero_title, hero_subtitle, footer_text)
VALUES (
  1,
  'Los mejores productos de pesca de todo AliExpress',
  'Encuentra los mejores precios en artículos de pesca directamente desde AliExpress. ¡Equípate como un profesional sin gastar de más!',
  '© 2026 MiTienda. Todos los derechos reservados.'
)
ON CONFLICT (id) DO NOTHING;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_site_settings_updated_at();
