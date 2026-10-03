import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronDown, Heart, MapPin, Search, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { DESTINATIONS, AMENITY_META } from "@/data/properties";
import { api } from "@/lib/api";
import { dateError, localDate, overlapsStay } from "@/lib/stay";
import { useReveal } from '@/hooks/use-reveal';
import { useFavorites } from '@/lib/favorites';
const amenityKeys = ['pool', 'ac', 'wifi', 'bbq', 'parking', 'beach'];
const Home = () => {
  const howRef = useReveal();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const favoriteIds = useFavorites();
  const savedOnly = params.get('salvas') === '1';
  const destination = params.get('destino') || 'all';
  const guests = params.get('hospedes') || '';
  const checkIn = params.get('entrada') || '';
  const checkOut = params.get('saida') || '';
  const minPrice = params.get('min') || '';
  const maxPrice = params.get('max') || '';
  const selected = (params.get('comodidades') || '').split(',').filter(Boolean);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const datesError = dateError(checkIn, checkOut);
  const priceError = minPrice && Number(minPrice) < 0 || maxPrice && Number(maxPrice) < 0 || minPrice && maxPrice && Number(minPrice) > Number(maxPrice);
  const applyParams = next => navigate({ pathname: location.pathname, search: next.toString(), hash: location.hash }, { replace: true });
  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);else next.delete(key);
    applyParams(next);
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    api.get('/properties').then(({
      data
    }) => {
      if (active) setProperties([...data].sort((a, b) => Number(Boolean(b.demoReference)) - Number(Boolean(a.demoReference))));
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [retry]);
  const savedCount = properties.filter(p => favoriteIds.includes(p.id)).length;
  const filtered = properties.filter(p => (!savedOnly || favoriteIds.includes(p.id)) && (destination === 'all' || p.destination === destination) && (!guests || p.guests >= Number(guests)) && (!minPrice || p.pricePerNight >= Number(minPrice)) && (!maxPrice || p.pricePerNight > 0 && p.pricePerNight <= Number(maxPrice)) && selected.every(a => (p.amenities || []).includes(a)) && (datesError || !overlapsStay(checkIn, checkOut, [...(p.unavailableDates || []), ...(p.bookedDates || [])])));
  const clear = () => {
    applyParams(new URLSearchParams(savedOnly ? { salvas: '1' } : {}));
    setSubmitted(false);
  };
  const search = e => {
    e.preventDefault();
    setSubmitted(true);
    if (datesError || priceError) return;
    document.getElementById('destinos')?.scrollIntoView({
      block: 'start'
    });
  };
  const stayParams = new URLSearchParams();
  if (!datesError && checkIn && checkOut) {
    stayParams.set('entrada', checkIn);
    stayParams.set('saida', checkOut);
  }
  if (guests) stayParams.set('hospedes', guests);
  return <div data-testid="home-page">
    <Navbar />
    <main id="conteudo" tabIndex={-1}>
      <section className="stay-hero" data-testid="hero-section">
        <img className="hero-photo" src="https://images.unsplash.com/photo-1760067538263-fb7126fe748c?crop=entropy&cs=srgb&fm=jpg&w=2000&q=80" alt="Varanda de uma casa em uma paisagem tropical" fetchPriority="high" />
        <div className="hero-shade" />
        <div className="page-container hero-content">
          <p className="hero-eyebrow">Bahia Stay <span>Casas de temporada</span></p>
          <h1>Desfaça as malas.<br /> Fique à vontade.</h1>
          <p>Apartamentos, chalés e casas para passar uns dias no litoral.</p>
          <a className="hero-link" href="#destinos">Encontrar uma casa <span aria-hidden="true">→</span></a>
        </div>
      </section>
      <section className="search-intro page-container" aria-label="Buscar casas de temporada">
        <form className="search-form" onSubmit={search} noValidate data-testid="hero-search-container">
          <label className="search-field search-destination" htmlFor="hero-destination">
            <span className="search-field-label"><MapPin aria-hidden="true" />Destino</span>
            <span className="search-select-control">
              <select id="hero-destination" value={destination} onChange={e => update('destino', e.target.value === 'all' ? '' : e.target.value)} data-testid="hero-destination-select">
                <option value="all">Todos os destinos</option>
                {DESTINATIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <ChevronDown aria-hidden="true" />
            </span>
          </label>
          <label className="search-field search-arrival" htmlFor="hero-checkin">
            <span className="search-field-label"><CalendarDays aria-hidden="true" />Entrada</span>
            <input id="hero-checkin" type="date" min={localDate()} value={checkIn} onInput={e => update('entrada', e.target.value)} aria-invalid={submitted && Boolean(datesError)} aria-describedby="search-date-message" data-testid="hero-checkin-input" />
          </label>
          <label className="search-field search-departure" htmlFor="hero-checkout">
            <span className="search-field-label"><CalendarDays aria-hidden="true" />Saída</span>
            <input id="hero-checkout" type="date" min={checkIn || localDate()} value={checkOut} onInput={e => update('saida', e.target.value)} aria-invalid={submitted && Boolean(datesError)} aria-describedby="search-date-message" data-testid="hero-checkout-input" />
          </label>
          <label className="search-field search-guests" htmlFor="hero-guests">
            <span className="search-field-label"><Users aria-hidden="true" />Hóspedes</span>
            <span className="search-select-control">
              <select id="hero-guests" value={guests} onChange={e => update('hospedes', e.target.value)} data-testid="hero-guests-select">
                <option value="">Quantas pessoas?</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'hóspede' : 'hóspedes'}</option>)}
              </select>
              <ChevronDown aria-hidden="true" />
            </span>
          </label>
          <Button type="submit" className="primary-action search-submit" data-testid="hero-search-submit-btn"><Search aria-hidden="true" />Buscar casas</Button>
        </form>
        <p id="search-date-message" role={submitted && datesError ? 'alert' : undefined} className={submitted && datesError ? 'field-error' : 'helper-text'}>{submitted && datesError ? datesError : 'Escolha as datas para ver as casas disponíveis.'}</p>
      </section>
      <section id="destinos" className="page-container results-section">
        <div className="results-heading"><h2>{savedOnly ? 'Casas salvas' : 'Casas de temporada'}</h2><p aria-live="polite" data-testid="results-count">{loading ? 'Carregando imóveis…' : error ? 'Catálogo indisponível' : `${filtered.length} ${filtered.length === 1 ? 'casa encontrada' : 'casas encontradas'}`}</p></div>
        <div className="catalog-view-tabs" role="group" aria-label="Escolher lista de casas">
          <button type="button" aria-pressed={!savedOnly} onClick={() => update('salvas', '')}>Todas as casas</button>
          <button type="button" aria-pressed={savedOnly} onClick={() => update('salvas', '1')} data-testid="saved-houses-toggle"><Heart size={16} aria-hidden="true" fill={savedOnly ? 'currentColor' : 'none'} />Salvas <span className="saved-count">{savedCount}</span></button>
        </div>
        {savedOnly && <p className="helper-text saved-houses-note">Suas escolhas ficam salvas neste navegador. Use os filtros para comparar as casas.</p>}
        <div className="destination-tabs" aria-label="Filtrar por destino">
          <button aria-pressed={destination === 'all'} onClick={() => update('destino', '')} data-testid="filter-destination-all">Todos os destinos</button>
          {DESTINATIONS.map(d => <button key={d.id} aria-pressed={destination === d.id} onClick={() => update('destino', d.id)} data-testid={`filter-destination-${d.id}`}>{d.label}</button>)}
        </div>
        <Button variant="outline" className="filter-toggle" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(v => !v)}>{filtersOpen ? "Fechar filtros" : "Preço e comodidades"}{selected.length > 0 ? ` (${selected.length})` : ""}</Button>
        <div className="catalog-layout">
          <aside id="catalog-filters" className={`filters-panel ${filtersOpen ? "filters-open" : ""}`} data-testid="filters-panel">
            <h3>Filtros</h3>
            <fieldset><legend>Preço por noite (R$)</legend><div className="price-inputs"><label>Mínimo<input type="number" min="0" value={minPrice} onInput={e => update('min', e.target.value)} placeholder="Sem mínimo" aria-invalid={Boolean(priceError)} aria-describedby="price-error" /></label><label>Máximo<input type="number" min="0" value={maxPrice} onInput={e => update('max', e.target.value)} placeholder="Sem máximo" aria-invalid={Boolean(priceError)} aria-describedby="price-error" /></label></div>{priceError && <p className="field-error" role="alert" id="price-error">Informe valores positivos e um máximo maior ou igual ao mínimo.</p>}</fieldset>
            <fieldset><legend>Comodidades</legend>{amenityKeys.map(key => <label className="amenity-option" key={key}><input type="checkbox" checked={selected.includes(key)} onChange={() => update('comodidades', (selected.includes(key) ? selected.filter(a => a !== key) : [...selected, key]).join(','))} data-testid={`filter-amenity-${key}`} />{AMENITY_META[key].label}</label>)}</fieldset>
            <Button variant="outline" onClick={clear} data-testid="filter-clear-btn">Limpar filtros e datas</Button>
          </aside>
          <div className="property-grid" data-testid="property-grid" aria-busy={loading}>
            {loading && Array.from({
              length: 6
            }, (_, i) => <div key={i} className="property-skeleton" aria-hidden="true"><div /><p /><p /></div>)}
            {error && <div className="result-message" role="alert"><h3>Não foi possível carregar as casas</h3><p>Verifique sua conexão e tente novamente.</p><Button onClick={() => setRetry(v => v + 1)}>Tentar novamente</Button></div>}
            {!loading && !error && filtered.map((p, i) => <PropertyCard key={p.id} property={p} index={i} search={stayParams.toString()} />)}
            {!loading && !error && filtered.length === 0 && (savedOnly && savedCount === 0
              ? <div className="result-message" role="status"><Heart size={28} aria-hidden="true" className="empty-saved-heart" /><h3>Você ainda não salvou nenhuma casa</h3><p>Toque no coração de uma casa para encontrá-la aqui depois.</p><Button variant="outline" onClick={() => update('salvas', '')}>Ver todas as casas</Button></div>
              : <div className="result-message" role="status"><h3>{savedOnly ? 'Nenhuma casa salva atende à busca' : 'Nenhuma casa atende à busca'}</h3><p>Tente outro destino, quantidade de hóspedes ou faixa de preço.</p><Button variant="outline" onClick={clear}>Limpar filtros</Button></div>)}
          </div>
        </div>
      </section>
      <section id="como-funciona" ref={howRef} className="page-container how-section"><p className="eyebrow">Da escolha à chegada</p><h2>Vamos combinar sua estadia?</h2><div className="how-grid"><div><span className="how-step" aria-hidden="true">01</span><h3>Veja as casas</h3><p>Fotos, localização e o que cada espaço oferece.</p></div><div><span className="how-step" aria-hidden="true">02</span><h3>Marque os dias</h3><p>O calendário mostra a disponibilidade e o valor do período.</p></div><div><span className="how-step" aria-hidden="true">03</span><h3>Fale com a gente</h3><p>Pelo WhatsApp, acertamos a reserva e os detalhes da chegada.</p></div></div></section>
    </main>
    <Footer />
  </div>;
};
export default Home;
