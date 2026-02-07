import { Facebook, Instagram, Twitter, Youtube, Globe } from 'lucide-react';

export function SocialIcon({ platform, className }: { platform: string; className?: string }) {
  const key = platform.toLowerCase();
  switch (key) {
    case 'instagram':
      return <Instagram className={className} />;
    case 'facebook':
      return <Facebook className={className} />;
    case 'twitter':
    case 'x':
      return <Twitter className={className} />;
    case 'youtube':
      return <Youtube className={className} />;
    default:
      return <Globe className={className} />;
  }
}
