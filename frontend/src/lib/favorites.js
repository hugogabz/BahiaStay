import { useEffect, useState } from 'react';
import { toast } from 'sonner';
const key='bahiastay_favorites';
function read(id) {try {return JSON.parse(localStorage.getItem(key)||'[]').includes(id);} catch {return false;}}
export function useFavorite(id) {
  const [liked,setLiked]=useState(()=>read(id));
  useEffect(()=>{const sync=()=>setLiked(read(id));sync();window.addEventListener('favorites-change',sync);window.addEventListener('storage',sync);return ()=>{window.removeEventListener('favorites-change',sync);window.removeEventListener('storage',sync);};},[id]);
  const toggle=()=>{try {const items=JSON.parse(localStorage.getItem(key)||'[]');localStorage.setItem(key,JSON.stringify(items.includes(id)?items.filter(v=>v!==id):[...items,id]));window.dispatchEvent(new Event('favorites-change'));} catch {toast.error('Não foi possível salvar neste navegador.');}};
  return [liked,toggle];
}
