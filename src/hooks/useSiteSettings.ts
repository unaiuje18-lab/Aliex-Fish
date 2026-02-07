import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SiteSettings } from '@/types/database';

const SETTINGS_ID = 1;

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', SETTINGS_ID)
        .maybeSingle();

      if (error) throw error;
      return data as SiteSettings | null;
    },
  });
}

export function useUpdateSiteSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Omit<SiteSettings, 'updated_at'>) => {
      const { data, error } = await supabase
        .from('site_settings')
        .upsert({ ...updates, id: SETTINGS_ID })
        .select()
        .single();

      if (error) throw error;
      return data as SiteSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    },
  });
}
