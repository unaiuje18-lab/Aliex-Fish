-- Add miembro role, permissions table, and RLS policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'user'
  ) THEN
    ALTER TYPE public.app_role RENAME VALUE 'user' TO 'miembro';
  END IF;
END $$;

UPDATE public.user_roles
SET role = 'miembro'
WHERE role = 'user';

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  can_dashboard BOOLEAN NOT NULL DEFAULT false,
  can_products_view BOOLEAN NOT NULL DEFAULT false,
  can_products_create BOOLEAN NOT NULL DEFAULT false,
  can_products_edit BOOLEAN NOT NULL DEFAULT false,
  can_categories BOOLEAN NOT NULL DEFAULT false,
  can_content BOOLEAN NOT NULL DEFAULT false,
  can_analytics BOOLEAN NOT NULL DEFAULT false,
  can_alerts BOOLEAN NOT NULL DEFAULT false,
  can_users BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Only admins can manage permissions"
ON public.user_permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
