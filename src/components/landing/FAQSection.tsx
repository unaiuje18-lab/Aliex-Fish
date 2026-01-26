import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQFromDB {
  id?: string;
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs?: FAQFromDB[];
}

const defaultFAQs: FAQFromDB[] = [
  {
    question: "¿Cuánto tiempo tarda en llegar mi pedido?",
    answer: "El tiempo de envío es de 7 a 20 días hábiles dependiendo de tu ubicación. Recibirás un número de seguimiento para rastrear tu paquete en todo momento.",
  },
  {
    question: "¿El producto tiene garantía?",
    answer: "Sí, todos nuestros productos incluyen una garantía de satisfacción de 30 días. Si no estás conforme, te devolvemos tu dinero sin preguntas.",
  },
  {
    question: "¿Cómo realizo el pago?",
    answer: "Aceptamos todas las tarjetas de crédito y débito principales, así como PayPal. El pago se procesa de forma segura a través de AliExpress.",
  },
  {
    question: "¿El producto es original?",
    answer: "Sí, trabajamos directamente con proveedores verificados para garantizar la autenticidad y calidad de cada producto.",
  },
  {
    question: "¿Qué pasa si mi producto llega dañado?",
    answer: "En el caso poco probable de que tu producto llegue dañado, contáctanos inmediatamente con fotos del daño y te enviaremos un reemplazo sin costo adicional.",
  },
  {
    question: "¿Puedo cancelar mi pedido?",
    answer: "Puedes cancelar tu pedido dentro de las primeras 24 horas si aún no ha sido enviado. Después de ese tiempo, deberás esperar a recibirlo para solicitar una devolución.",
  },
];

export const FAQSection = ({ faqs = defaultFAQs }: FAQSectionProps) => {
  return (
    <section className="py-16 lg:py-24 bg-card">
      <div className="container max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Preguntas Frecuentes
          </h2>
          <p className="text-muted-foreground">
            Resolvemos todas tus dudas antes de comprar
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.id || index}
              value={`item-${faq.id || index}`}
              className="bg-background rounded-xl border-none shadow-card overflow-hidden"
            >
              <AccordionTrigger className="px-6 py-4 text-left font-semibold text-foreground hover:no-underline hover:bg-muted/50 transition-colors [&[data-state=open]]:bg-muted/30">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4 text-muted-foreground leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
