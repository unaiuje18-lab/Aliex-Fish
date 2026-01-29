import { Link } from 'react-router-dom';
import { usePublishedProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, ShoppingCart, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { data: products, isLoading } = usePublishedProducts();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { isAdmin, user } = useAuth();

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-xl text-primary">
            🎣 AliexFISH
          </Link>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">{user ? 'Mi Cuenta' : 'Iniciar Sesión'}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 md:py-16 text-center px-4">
        <div className="container max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Los mejores productos de pesca de todo AliExpress
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Encuentra los mejores precios en artículos de pesca directamente desde AliExpress. 
            ¡Equípate como un profesional sin gastar de más!
          </p>
        </div>
      </section>

      {/* Categories Navigation */}
      <section className="pb-8 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {categoriesLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-24 rounded-full" />
              ))
            ) : categories && categories.length > 0 ? (
              categories.map((category) => (
                <Button
                  key={category.id}
                  variant="outline"
                  size="sm"
                  className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  asChild
                >
                  <Link to={`/?categoria=${category.slug}`}>
                    <span className="mr-1">{category.icon}</span>
                    {category.name}
                  </Link>
                </Button>
              ))
            ) : null}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="pb-24 px-4">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
            Productos Destacados
          </h2>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-square w-full" />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <Link 
                  key={product.id} 
                  to={`/producto/${product.slug}`}
                  className="group"
                >
                  <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                    <div className="aspect-square relative overflow-hidden bg-muted">
                      {product.main_image_url ? (
                        <img
                          src={product.main_image_url}
                          alt={product.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingCart className="h-16 w-16 text-muted-foreground/50" />
                        </div>
                      )}
                      {product.discount && (
                        <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-sm font-bold px-2 py-1 rounded">
                          -{product.discount}
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                        {product.title}
                      </h3>
                      
                      <div className="flex items-center gap-1 mb-3">
                        <div className="flex items-center text-yellow-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < Math.floor(product.rating) ? 'fill-current' : ''}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          ({product.review_count})
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">
                          {product.price}
                        </span>
                        {product.original_price && (
                          <span className="text-sm text-muted-foreground line-through">
                            {product.original_price}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No hay productos todavía</h3>
              <p className="text-muted-foreground mb-6">
                Los productos aparecerán aquí cuando sean publicados.
              </p>
              {isAdmin && (
                <Button asChild>
                  <Link to="/admin/productos/nuevo">Crear tu primer producto</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="container max-w-6xl mx-auto px-4">
          <p>© {new Date().getFullYear()} MiTienda. Todos los derechos reservados.</p>
        </div>
      </footer>
    </main>
  );
};

export default Index;
