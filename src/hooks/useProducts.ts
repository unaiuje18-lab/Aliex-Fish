import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product, ProductBenefit, ProductVideo, ProductReview, ProductFAQ } from '@/types/database';

// Fetch all products (for admin)
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
  });
}

// Fetch published products only (for public)
export function usePublishedProducts() {
  return useQuery({
    queryKey: ['products', 'published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
  });
}

// Fetch single product by slug with all related data
export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) throw error;
      if (!product) return null;

      // Fetch related data in parallel
      const [benefits, videos, reviews, faqs] = await Promise.all([
        supabase
          .from('product_benefits')
          .select('*')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true }),
        supabase
          .from('product_videos')
          .select('*')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true }),
        supabase
          .from('product_reviews')
          .select('*')
          .eq('product_id', product.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('product_faqs')
          .select('*')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true }),
      ]);

      return {
        ...product,
        benefits: (benefits.data || []) as ProductBenefit[],
        videos: (videos.data || []) as ProductVideo[],
        reviews: (reviews.data || []) as ProductReview[],
        faqs: (faqs.data || []) as ProductFAQ[],
      };
    },
    enabled: !!slug,
  });
}

// Fetch single product by ID (for admin edit)
export function useProductById(id: string) {
  return useQuery({
    queryKey: ['product', 'id', id],
    queryFn: async () => {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!product) return null;

      // Fetch related data in parallel
      const [benefits, videos, reviews, faqs] = await Promise.all([
        supabase
          .from('product_benefits')
          .select('*')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true }),
        supabase
          .from('product_videos')
          .select('*')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true }),
        supabase
          .from('product_reviews')
          .select('*')
          .eq('product_id', product.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('product_faqs')
          .select('*')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true }),
      ]);

      return {
        ...product,
        benefits: (benefits.data || []) as ProductBenefit[],
        videos: (videos.data || []) as ProductVideo[],
        reviews: (reviews.data || []) as ProductReview[],
        faqs: (faqs.data || []) as ProductFAQ[],
      };
    },
    enabled: !!id,
  });
}

// Create product
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Update product
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Product;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', data.slug] });
      queryClient.invalidateQueries({ queryKey: ['product', 'id', data.id] });
    },
  });
}

// Delete product
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Benefits mutations
export function useUpdateProductBenefits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, benefits }: { productId: string; benefits: Omit<ProductBenefit, 'id' | 'product_id' | 'created_at'>[] }) => {
      // Delete existing benefits
      await supabase.from('product_benefits').delete().eq('product_id', productId);

      // Insert new benefits
      if (benefits.length > 0) {
        const { error } = await supabase
          .from('product_benefits')
          .insert(benefits.map((b, i) => ({ ...b, product_id: productId, display_order: i })));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

// Videos mutations
export function useUpdateProductVideos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, videos }: { productId: string; videos: Omit<ProductVideo, 'id' | 'product_id' | 'created_at'>[] }) => {
      await supabase.from('product_videos').delete().eq('product_id', productId);

      if (videos.length > 0) {
        const { error } = await supabase
          .from('product_videos')
          .insert(videos.map((v, i) => ({ ...v, product_id: productId, display_order: i })));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

// Reviews mutations
export function useUpdateProductReviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, reviews }: { productId: string; reviews: Omit<ProductReview, 'id' | 'product_id' | 'created_at'>[] }) => {
      await supabase.from('product_reviews').delete().eq('product_id', productId);

      if (reviews.length > 0) {
        const { error } = await supabase
          .from('product_reviews')
          .insert(reviews.map(r => ({ ...r, product_id: productId })));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

// FAQs mutations
export function useUpdateProductFAQs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, faqs }: { productId: string; faqs: Omit<ProductFAQ, 'id' | 'product_id' | 'created_at'>[] }) => {
      await supabase.from('product_faqs').delete().eq('product_id', productId);

      if (faqs.length > 0) {
        const { error } = await supabase
          .from('product_faqs')
          .insert(faqs.map((f, i) => ({ ...f, product_id: productId, display_order: i })));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product'] });
    },
  });
}
