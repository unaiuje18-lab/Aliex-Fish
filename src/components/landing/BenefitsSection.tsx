import * as LucideIcons from "lucide-react";
import { LucideIcon, Zap, Shield, Sparkles, Clock, Heart, Check } from "lucide-react";

interface BenefitFromDB {
  icon: string;
  title: string;
  description: string | null;
}

interface BenefitsSectionProps {
  benefits?: BenefitFromDB[];
}

const defaultBenefits: BenefitFromDB[] = [
  {
    icon: "Zap",
    title: "Alta Calidad",
    description: "Materiales premium que garantizan durabilidad y rendimiento excepcional.",
  },
  {
    icon: "Shield",
    title: "Garantía Total",
    description: "Protección completa con nuestra garantía de satisfacción.",
  },
  {
    icon: "Sparkles",
    title: "Diseño Innovador",
    description: "Tecnología de última generación en un diseño elegante y funcional.",
  },
  {
    icon: "Clock",
    title: "Envío Rápido",
    description: "Recíbelo en tu puerta en tiempo récord con seguimiento completo.",
  },
  {
    icon: "Heart",
    title: "Satisfacción Garantizada",
    description: "Miles de clientes satisfechos avalan la calidad de nuestros productos.",
  },
];

// Map icon string to Lucide component
const getIconComponent = (iconName: string): LucideIcon => {
  const icons: Record<string, LucideIcon> = {
    Zap,
    Shield,
    Sparkles,
    Clock,
    Heart,
    Check,
    Battery: (LucideIcons as any).Battery,
    Headphones: (LucideIcons as any).Headphones,
    Star: (LucideIcons as any).Star,
    Volume2: (LucideIcons as any).Volume2,
    Wifi: (LucideIcons as any).Wifi,
    Bluetooth: (LucideIcons as any).Bluetooth,
    Award: (LucideIcons as any).Award,
    ThumbsUp: (LucideIcons as any).ThumbsUp,
    Truck: (LucideIcons as any).Truck,
  };
  return icons[iconName] || Check;
};

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
            const Icon = getIconComponent(benefit.icon);
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
                  {benefit.description || ''}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
