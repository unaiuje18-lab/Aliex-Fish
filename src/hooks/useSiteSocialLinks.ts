import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SiteSocialLink } from '@/types/database';

export function useSiteSocialLinks() {
  return useQuery({
    queryKey: ['site-social-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_social_links')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as SiteSocialLink[];
    },
  });
}

export function useUpdateSiteSocialLinks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (links: Omit<SiteSocialLink, 'id' | 'created_at'>[]) => {
      await supabase.from('site_social_links').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      if (links.length > 0) {
        const { error } = await supabase
          .from('site_social_links')
          .insert(links.map((link, i) => ({ ...link, display_order: i + 1 })));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-social-links'] });
    },
  });
}
