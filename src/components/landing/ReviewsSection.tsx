import { Star, CheckCircle } from "lucide-react";

interface ReviewFromDB {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date_label: string;
  is_verified: boolean;
  avatar_url: string | null;
}

interface ReviewsSectionProps {
  reviews?: ReviewFromDB[];
}

const defaultReviews: ReviewFromDB[] = [
  {
    id: "1",
    name: "María García",
    rating: 5,
    comment: "¡Increíble calidad! Superó todas mis expectativas. El envío fue rapidísimo y el producto es exactamente como se muestra en las fotos. 100% recomendado.",
    date_label: "Hace 2 días",
    is_verified: true,
    avatar_url: null,
  },
  {
    id: "2",
    name: "Carlos Rodríguez",
    rating: 5,
    comment: "Excelente relación calidad-precio. Ya es mi tercera compra y siempre quedo satisfecho. El servicio al cliente es muy bueno.",
    date_label: "Hace 5 días",
    is_verified: true,
    avatar_url: null,
  },
  {
    id: "3",
    name: "Ana Martínez",
    rating: 4,
    comment: "Muy buen producto, llegó bien empaquetado y en perfectas condiciones. Lo uso todos los días y funciona perfecto.",
    date_label: "Hace 1 semana",
    is_verified: true,
    avatar_url: null,
  },
  {
    id: "4",
    name: "Pedro López",
    rating: 5,
    comment: "Fantástico. Compré uno para mí y otro de regalo. A todos les encantó. Sin duda volveré a comprar.",
    date_label: "Hace 2 semanas",
    is_verified: true,
    avatar_url: null,
  },
];

export const ReviewsSection = ({ reviews = defaultReviews }: ReviewsSectionProps) => {
  const averageRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

  return (
    <section className="py-16 lg:py-24 bg-secondary">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Lo que dicen nuestros clientes
          </h2>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-6 h-6 ${
                    i < Math.floor(averageRating)
                      ? "text-warning fill-warning"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
            <span className="text-lg font-bold text-foreground">
              {averageRating.toFixed(1)}
            </span>
          </div>
          <p className="text-muted-foreground">
            Basado en {reviews.length} opiniones verificadas
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-card rounded-2xl p-6 shadow-card"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                  {review.avatar_url ? (
                    <img
                      src={review.avatar_url}
                      alt={review.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    review.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">
                      {review.name}
                    </span>
                    {review.is_verified && (
                      <span className="flex items-center gap-1 text-xs text-success font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Verificado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating
                              ? "text-warning fill-warning"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    {review.date_label && (
                      <span className="text-xs text-muted-foreground">
                        {review.date_label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                "{review.comment}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
