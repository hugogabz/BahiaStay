import { useEffect, useState } from 'react';
import { toast } from 'sonner';
const key='bahiastay_favorites';
function readFavorites() {
  try {
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(items) ? [...new Set(items.filter(id => typeof id === 'string'))] : [];
  } catch { return []; }
}
export function useFavorites() {
  const [ids, setIds] = useState(readFavorites);
  useEffect(() => {
    const sync = () => setIds(readFavorites());
    sync();
    window.addEventListener('favorites-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('favorites-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return ids;
}
export function useFavorite(id) {
  const ids = useFavorites();
  const toggle = () => {
    try {
      const items = readFavorites();
      localStorage.setItem(key, JSON.stringify(items.includes(id) ? items.filter(v => v !== id) : [...items, id]));
      window.dispatchEvent(new Event('favorites-change'));
    } catch { toast.error('Não foi possível salvar neste navegador.'); }
  };
  return [ids.includes(id), toggle];
}
