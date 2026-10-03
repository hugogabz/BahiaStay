import { Link, useLocation, useNavigate } from 'react-router-dom';

export function scrollHomeToTop() {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, left: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
}

export default function HomeLogoLink({ children, ...props }) {
  const location = useLocation();
  const navigate = useNavigate();
  const home = location.pathname === '/';
  function onClick(event) {
    if (!home || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash) {
      navigate({ pathname: '/', search: location.search, hash: '' }, {
        replace: true,
        state: { scrollHomeToTop: true },
      });
    } else scrollHomeToTop();
  }
  return <Link {...props} className="brand-link" to={home ? `/${location.search}` : '/'}
    aria-label={home ? 'Bahia Stay — voltar ao topo' : 'Bahia Stay — início'} onClick={onClick}>
    {children}
  </Link>;
}
