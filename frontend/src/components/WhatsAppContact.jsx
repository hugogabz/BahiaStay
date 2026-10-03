import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { supportUrl } from '@/lib/whatsapp';
export default function WhatsAppContact() {
  const {
    pathname
  } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/pagamento')) return null;
  return <a className="whatsapp-contact" href={supportUrl()} target="_blank" rel="noopener noreferrer" aria-label="Suporte Bahia Stay pelo WhatsApp (abre em outra aba)" data-testid="whatsapp-contact">
    <MessageCircle size={22} aria-hidden="true" />
    <span>Suporte</span>
  </a>;
}
