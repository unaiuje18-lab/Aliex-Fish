
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.analytics_events;

CREATE POLICY "Authenticated users can insert analytics"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (true);
