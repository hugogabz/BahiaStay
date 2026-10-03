import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { DESTINATIONS } from '@/data/properties';
import { fileUrl } from '@/lib/api';
import { useFavorite } from '@/lib/favorites';
import { quoteStay } from '@/lib/stay';
const brl = v => Number(v || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
export default function PropertyCard({
  property,
  index = 0,
  search = ''
}) {
  const [idx, setIdx] = useState(0);
  const [broken, setBroken] = useState(false);
  const [liked, toggle] = useFavorite(property.id);
  const images = property.images || [];
  const destination = DESTINATIONS.find(d => d.id === property.destination)?.label || '';
  const url = `/casa/${property.id}${search ? '?' + search : ''}`;
  const dates = new URLSearchParams(search);
  const quote = quoteStay(property, dates.get('entrada'), dates.get('saida'));
  const hasPrice = Number.isFinite(Number(property.pricePerNight)) && Number(property.pricePerNight) > 0;
  const move = step => {
    setBroken(false);
    setIdx(i => (i + step + images.length) % images.length);
  };
  return <article className="property-card" data-testid={`property-card-${index + 1}`}>
    <div className="card-media">
      <Link to={url} aria-label={`Ver ${property.title}`} tabIndex={-1}>
        {images.length > 0 && !broken ? <img src={fileUrl(images[idx])} alt={property.title} loading="lazy" decoding="async" onError={() => setBroken(true)} data-testid={`property-card-image-carousel-${index + 1}`} /> : <div className="image-placeholder">Foto não disponível</div>}
      </Link>
      <button className="favorite-button" aria-pressed={liked} aria-label={`${liked ? 'Remover dos' : 'Adicionar aos'} favoritos: ${property.title}`} onClick={toggle} data-testid={`property-card-heart-btn-${index + 1}`}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /></button>
      {images.length > 1 && <><button className="carousel-nav previous" onClick={() => move(-1)} aria-label={`Foto anterior: ${property.title}`}><ChevronLeft size={20} /></button><button className="carousel-nav next" onClick={() => move(1)} aria-label={`Próxima foto: ${property.title}`}><ChevronRight size={20} /></button><span className="image-count">{idx + 1}/{images.length}</span></>}
    </div>
    <div className="card-location">{destination} · {property.neighborhood}</div>
    <h3><Link to={url}>{property.title}</Link></h3>
    <p className="card-capacity">Até {property.guests} hóspedes · {property.bedrooms === 0 ? 'Estúdio' : `${property.bedrooms} ${property.bedrooms === 1 ? 'quarto' : 'quartos'}`}</p>
    <p className="card-price">{hasPrice ? <><strong>{brl(quote.nights ? quote.total : property.pricePerNight)}</strong> {quote.nights ? `por ${quote.nights} noites` : '/ noite'}{quote.seasonalExtra > 0 && <small className="season-nights">Inclui ajuste de alta temporada</small>}</> : <strong>Consultar valor</strong>}</p>
  </article>;
}
