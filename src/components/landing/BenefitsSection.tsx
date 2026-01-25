import { LucideIcon, Zap, Shield, Sparkles, Clock, Heart } from "lucide-react";

interface Benefit {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface BenefitsSectionProps {
  benefits?: Benefit[];
}

const defaultBenefits: Benefit[] = [
  {
    icon: Zap,
    title: "Alta Calidad",
    description: "Materiales premium que garantizan durabilidad y rendimiento excepcional.",
  },
  {
    icon: Shield,
    title: "Garantía Total",
    description: "Protección completa con nuestra garantía de satisfacción.",
  },
  {
    icon: Sparkles,
    title: "Diseño Innovador",
    description: "Tecnología de última generación en un diseño elegante y funcional.",
  },
  {
    icon: Clock,
    title: "Envío Rápido",
    description: "Recíbelo en tu puerta en tiempo récord con seguimiento completo.",
  },
  {
    icon: Heart,
    title: "Satisfacción Garantizada",
    description: "Miles de clientes satisfechos avalan la calidad de nuestros productos.",
  },
];

export const BenefitsSection = ({ benefits = defaultBenefits }: BenefitsSectionProps) => {
  return (
    <section className="py-16 lg:py-24 bg-card">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            ¿Por qué elegir este producto?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Descubre todas las ventajas que hacen de este producto la mejor elección
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {benefits.slice(0, 5).map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="group p-6 rounded-2xl bg-background shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
