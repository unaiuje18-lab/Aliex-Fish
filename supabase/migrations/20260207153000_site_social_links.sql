-- Social links for site footer
CREATE TABLE public.site_social_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    platform text NOT NULL,
    url text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site social links"
ON public.site_social_links FOR SELECT
USING (true);

CREATE POLICY "Admins can manage site social links"
ON public.site_social_links FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Seed common networks
INSERT INTO public.site_social_links (platform, url, is_enabled, display_order) VALUES
('instagram', 'https://instagram.com/', true, 1),
('facebook', 'https://facebook.com/', true, 2),
('twitter', 'https://x.com/', true, 3),
('youtube', 'https://youtube.com/', true, 4)
ON CONFLICT DO NOTHING;
