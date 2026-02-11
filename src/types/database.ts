export type AppRole = 'admin' | 'miembro';

export interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  price: string;
  price_min: number | null;
  price_max: number | null;
  original_price: string | null;
  discount: string | null;
  affiliate_link: string;
  aliexpress_url: string | null;
  main_image_url: string | null;
  video_url: string | null;
  shipping_cost: string | null;
  delivery_time: string | null;
  sku: string | null;
  orders_count: number | null;
  rating: number;
  review_count: number;
  is_published: boolean;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  title: string | null;
  price: string | null;
  display_order: number;
  created_at: string;
}

export interface ProductBenefit {
  id: string;
  product_id: string;
  icon: string;
  title: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface ProductVideo {
  id: string;
  product_id: string;
  thumbnail_url: string | null;
  video_url: string;
  title: string | null;
  display_order: number;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  name: string;
  rating: number;
  comment: string;
  date_label: string;
  is_verified: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface ProductFAQ {
  id: string;
  product_id: string;
  question: string;
  answer: string;
  display_order: number;
  created_at: string;
}

export interface ProductOption {
  id: string;
  product_id: string;
  group_title: string;
  option_label: string;
  option_image_url: string | null;
  extra_text: string | null;
  display_order: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_label: string;
  price_modifier: string | null;
  display_order: number;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface SiteSettings {
  id: number;
  hero_title: string;
  hero_subtitle: string;
  footer_text: string;
  updated_at: string;
}

export interface SiteSocialLink {
  id: string;
  platform: string;
  url: string;
  is_enabled: boolean;
  display_order: number;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  event_type: string;
  path: string | null;
  product_id: string | null;
  created_at: string;
}

