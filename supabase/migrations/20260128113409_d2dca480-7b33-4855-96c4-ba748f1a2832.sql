-- Create categories table
CREATE TABLE public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    icon text DEFAULT '📦',
    display_order integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view categories
CREATE POLICY "Anyone can view categories"
ON public.categories FOR SELECT
USING (true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default fishing categories
INSERT INTO public.categories (name, slug, icon, display_order) VALUES
('Cañas', 'canas', '🎣', 1),
('Carretes', 'carretes', '🔄', 2),
('Boyas', 'boyas', '🔴', 3),
('Señuelos', 'sensuelos', '🐟', 4),
('Anzuelos', 'anzuelos', '🪝', 5),
('Líneas', 'lineas', '🧵', 6),
('Accesorios', 'accesorios', '🎒', 7),
('Ropa', 'ropa', '👕', 8),
('Otros', 'otros', '📦', 9);

-- Create index for ordering
CREATE INDEX idx_categories_display_order ON public.categories(display_order);