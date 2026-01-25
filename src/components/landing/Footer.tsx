import { Shield, Mail } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="py-8 bg-foreground text-background">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm text-background/80">
              Sitio protegido • Compra 100% segura
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm text-background/70">
            <a href="#" className="hover:text-background transition-colors">
              Política de Privacidad
            </a>
            <a href="#" className="hover:text-background transition-colors">
              Términos y Condiciones
            </a>
            <a
              href="mailto:soporte@ejemplo.com"
              className="flex items-center gap-1 hover:text-background transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contacto
            </a>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-background/10 text-center">
          <p className="text-xs text-background/50">
            Este sitio contiene enlaces de afiliado. Al realizar una compra a través de estos enlaces,
            podemos recibir una comisión sin costo adicional para ti.
          </p>
          <p className="text-xs text-background/40 mt-2">
            © {new Date().getFullYear()} Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
