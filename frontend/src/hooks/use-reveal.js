import { useEffect, useRef } from 'react';

export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.IntersectionObserver || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    element.classList.add('reveal-ready');
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        element.classList.add('reveal-visible');
        observer.disconnect();
      }
    }, { threshold: 0.08 });
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.classList.remove('reveal-ready', 'reveal-visible');
    };
  }, []);
  return ref;
}
