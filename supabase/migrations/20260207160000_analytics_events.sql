-- Simple analytics events
CREATE TABLE public.analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    path text,
    product_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon) to insert events
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events FOR INSERT
USING (true)
WITH CHECK (true);

-- Only admins can read analytics
CREATE POLICY "Admins can read analytics events"
ON public.analytics_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
