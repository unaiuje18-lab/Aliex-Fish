import { Truck, Shield, RotateCcw, CreditCard, Headphones, Lock } from "lucide-react";

interface TrustItem {
  icon: React.ElementType;
  title: string;
  description: string;
}

interface TrustSectionProps {
  items?: TrustItem[];
}

const defaultItems: TrustItem[] = [
  {
    icon: Truck,
    title: "Envío Mundial",
    description: "Enviamos a más de 200 países con seguimiento completo de tu paquete.",
  },
  {
    icon: Shield,
    title: "Garantía de 30 Días",
    description: "Si no estás satisfecho, te devolvemos el 100% de tu dinero.",
  },
  {
    icon: RotateCcw,
    title: "Devolución Fácil",
    description: "Proceso de devolución sencillo y sin complicaciones.",
  },
  {
    icon: CreditCard,
    title: "Pago Seguro",
    description: "Transacciones protegidas con encriptación SSL de nivel bancario.",
  },
  {
    icon: Headphones,
    title: "Soporte 24/7",
    description: "Nuestro equipo está disponible para ayudarte en cualquier momento.",
  },
  {
    icon: Lock,
    title: "Compra Protegida",
    description: "Tu compra está protegida por la garantía del comprador de AliExpress.",
  },
];

export const TrustSection = ({ items = defaultItems }: TrustSectionProps) => {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Compra con Total Confianza
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tu satisfacción es nuestra prioridad. Garantizamos una experiencia de compra segura y confiable.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="text-center p-6 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors duration-300"
              >
                <div className="w-16 h-16 rounded-full bg-trust/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-8 h-8 text-trust" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
