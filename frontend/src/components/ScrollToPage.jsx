import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollHomeToTop } from './HomeLogoLink';

export default function ScrollToPage() {
  const location = useLocation();
  const previous = useRef(null);
  useEffect(() => {
    const last = previous.current;
    previous.current = location;
    if (last?.pathname === location.pathname && last?.hash === location.hash) return;
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
    } else if (location.state?.scrollHomeToTop && last?.pathname === '/') {
      scrollHomeToTop();
    } else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location]);
  return null;
}
