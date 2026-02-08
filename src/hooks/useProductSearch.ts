import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  slug: string;
  title: string;
  price: string;
  original_price: string | null;
  discount: string | null;
  main_image_url: string | null;
  rating: number;
  review_count: number;
  category: string | null;
  affiliate_link: string;
  rank_score: number;
}

interface UseProductSearchOptions {
  debounceMs?: number;
  limit?: number;
}

export function useProductSearch({ debounceMs = 200, limit = 8 }: UseProductSearchOptions = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number>(0);

  const search = useCallback(async (q: string, category?: string | null) => {
    if (abortRef.current) abortRef.current.abort();

    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data, error } = await (supabase as any).rpc('search_products', {
        q: trimmed,
        category: category || null,
        min_price: null,
        max_price: null,
        limit_count: limit,
      });

      if (controller.signal.aborted) return;
      if (!error && data) {
        setResults(data);
        setIsOpen(data.length > 0);
      }
    } catch {
      // aborted or network error
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, [limit]);

  useEffect(() => {
    window.clearTimeout(timeoutRef.current);

    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    timeoutRef.current = window.setTimeout(() => {
      search(query);
    }, debounceMs);

    return () => window.clearTimeout(timeoutRef.current);
  }, [query, debounceMs, search]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    isOpen,
    setIsOpen,
    clear,
  };
}
