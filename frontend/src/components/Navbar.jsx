import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu } from 'lucide-react';
import Brand from '@/components/Brand';
import HomeLogoLink from '@/components/HomeLogoLink';
import { supportUrl } from '@/lib/whatsapp';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
const links = [{
  hash: 'destinos',
  label: 'Encontrar casas'
}, {
  hash: 'como-funciona',
  label: 'Como funciona'
}];
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const href = hash => `/${location.pathname === '/' ? location.search : ''}#${hash}`;
  const scroll = hash => {
    if (location.pathname === '/' && location.hash === `#${hash}`) document.getElementById(hash)?.scrollIntoView({ block: 'start' });
  };
  return <header className="site-header" data-testid="site-navbar">
    <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
    <div className="page-container header-inner">
      <HomeLogoLink data-testid="navbar-brand-logo"><Brand /></HomeLogoLink>
      <nav className="desktop-nav" aria-label="Navegação principal">{links.map(l => <Link key={l.hash} to={href(l.hash)} onClick={() => scroll(l.hash)} data-testid={`navbar-link-${l.hash}`}>{l.label}</Link>)}<Link className="saved-nav-link" to="/?salvas=1#destinos" onClick={() => scroll('destinos')} data-testid="navbar-saved-houses"><Heart size={16} aria-hidden="true" />Casas salvas</Link><a href={supportUrl()} target="_blank" rel="noopener noreferrer">Contato</a></nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild><Button variant="outline" size="icon" className="mobile-menu-toggle" aria-label="Abrir menu" data-testid="navbar-mobile-toggle"><Menu size={22} /></Button></SheetTrigger>
        <SheetContent className="mobile-menu" side="right">
          <SheetHeader><SheetTitle><Brand /></SheetTitle><SheetDescription>Encontre uma casa e confira os detalhes da sua estadia.</SheetDescription></SheetHeader>
          <nav aria-label="Navegação do celular" className="mobile-nav">{links.map(l => <Link key={l.hash} to={href(l.hash)} onClick={() => {setOpen(false);scroll(l.hash);}} data-testid={`navbar-mobile-link-${l.hash}`}>{l.label}<span aria-hidden="true">→</span></Link>)}<Link className="mobile-saved-link" to="/?salvas=1#destinos" onClick={() => { setOpen(false); scroll('destinos'); }} data-testid="navbar-mobile-saved-houses"><Heart size={18} aria-hidden="true" />Casas salvas<span aria-hidden="true">→</span></Link><a href={supportUrl()} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Suporte pelo WhatsApp<span aria-hidden="true">↗</span></a></nav>
          <div className="mobile-menu-bottom"><p className="helper-text">Escolha uma casa e fale conosco para esclarecer suas dúvidas.</p></div>
        </SheetContent>
      </Sheet>
    </div>
  </header>;
}
