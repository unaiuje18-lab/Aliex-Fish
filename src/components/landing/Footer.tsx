import { Shield, Mail } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSiteSocialLinks } from "@/hooks/useSiteSocialLinks";
import { SocialIcon } from "@/components/social/SocialIcon";

export const Footer = () => {
  const { data: siteSettings } = useSiteSettings();
  const { data: socialLinks } = useSiteSocialLinks();
  const footerText = siteSettings?.footer_text || `� ${new Date().getFullYear()} Todos los derechos reservados.`;
  const enabledSocials = (socialLinks || []).filter((s) => s.is_enabled && s.url);

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

        {enabledSocials.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-4">
            {enabledSocials.map((social) => (
              <a
                key={`${social.platform}-${social.url}`}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/70 hover:text-background transition-colors"
                aria-label={social.platform}
              >
                <SocialIcon platform={social.platform} className="w-5 h-5" />
              </a>
            ))}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-background/10 text-center">
          <p className="text-xs text-background/50">
            Este sitio contiene enlaces de afiliado. Al realizar una compra a través de estos enlaces,
            podemos recibir una comisión sin costo adicional para ti.
          </p>
          <p className="text-xs text-background/40 mt-2">
            {footerText}
          </p>
        </div>
      </div>
    </footer>
  );
};
