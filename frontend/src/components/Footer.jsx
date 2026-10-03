import { Link } from 'react-router-dom';
import Brand from '@/components/Brand';
import HomeLogoLink from '@/components/HomeLogoLink';
import { supportUrl } from '@/lib/whatsapp';
export default function Footer() {
  return <footer className="site-footer" data-testid="site-footer"><div className="page-container footer-inner"><div><HomeLogoLink data-testid="footer-brand-logo"><Brand inverse /></HomeLogoLink><p>Encontre seu próximo destino.</p></div><nav aria-label="Links do rodapé"><Link to="/#destinos" onClick={() => { if (window.location.pathname === '/') document.getElementById('destinos')?.scrollIntoView({block: 'start'}); }}>Encontrar casas</Link><Link to="/#como-funciona" onClick={() => { if (window.location.pathname === '/') document.getElementById('como-funciona')?.scrollIntoView({block: 'start'}); }}>Como funciona</Link><a href={supportUrl()} target="_blank" rel="noopener noreferrer">Contato pelo WhatsApp</a></nav></div><div className="page-container footer-note">© {new Date().getFullYear()} Bahia Stay · Casas de temporada. Todos os direitos reservados.</div></footer>;
}
