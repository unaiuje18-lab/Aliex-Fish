import { useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Star, TrendingUp } from 'lucide-react';
import { useProductSearch } from '@/hooks/useProductSearch';
import { cn } from '@/lib/utils';

export function SmartSearch() {
  const navigate = useNavigate();
  const {
    query,
    setQuery,
    results,
    isSearching,
    isOpen,
    setIsOpen,
    clear,
  } = useProductSearch({ debounceMs: 250, limit: 6 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setIsOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Enter' && results.length > 0) {
      navigate(`/producto/${results[0].slug}`);
      setIsOpen(false);
    }
  }, [results, navigate, setIsOpen]);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className={cn(
        "relative flex items-center rounded-2xl border-2 bg-card transition-all duration-300",
        isOpen && results.length > 0
          ? "border-primary shadow-lg rounded-b-none"
          : "border-border hover:border-primary/50 focus-within:border-primary focus-within:shadow-lg"
      )}>
        <Search className="absolute left-4 h-5 w-5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="¿Qué estás buscando? Señuelos, cañas, anzuelos..."
          className="w-full bg-transparent py-3.5 pl-12 pr-12 text-base outline-none placeholder:text-muted-foreground/60"
          autoComplete="off"
        />
        {isSearching && (
          <Loader2 className="absolute right-12 h-5 w-5 text-muted-foreground animate-spin" />
        )}
        {query && (
          <button
            onClick={clear}
            className="absolute right-4 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full bg-card border-2 border-t-0 border-primary rounded-b-2xl shadow-xl overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" />
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ul className="max-h-[400px] overflow-y-auto">
            {results.map((product, index) => (
              <li key={product.id}>
                <Link
                  to={`/producto/${product.slug}`}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 hover:bg-muted/80 transition-colors",
                    index === 0 && "bg-muted/40"
                  )}
                >
                  {/* Product Image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {product.main_image_url ? (
                      <img
                        src={product.main_image_url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                        <Search className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1 text-foreground">
                      {highlightMatch(product.title, query)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-primary">{product.price}</span>
                      {product.original_price && (
                        <span className="text-xs text-muted-foreground line-through">{product.original_price}</span>
                      )}
                      {product.discount && (
                        <span className="text-xs font-semibold text-destructive">-{product.discount}</span>
                      )}
                    </div>
                  </div>

                  {/* Rating */}
                  {product.review_count > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      <span className="text-xs text-muted-foreground">{product.review_count}</span>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No results message */}
      {isOpen && query.trim() && !isSearching && results.length === 0 && (
        <div className="absolute z-50 w-full bg-card border-2 border-t-0 border-primary rounded-b-2xl shadow-xl overflow-hidden animate-fade-in">
          <div className="px-4 py-8 text-center">
            <Search className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No se encontraron productos para "<span className="font-medium text-foreground">{query}</span>"
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Prueba con otros términos de búsqueda
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Highlight matching text segments */
function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;

  const words = query.trim().split(/\s+/).filter(Boolean);
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <span key={i} className="text-primary font-semibold">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
