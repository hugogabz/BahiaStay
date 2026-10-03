import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  MapPin, Users, BedDouble, Bath, ArrowLeft,
  Share2, Heart, Wind, Tv, Flame, Refrigerator, Wifi,
  Waves, Car, UtensilsCrossed, Palmtree, WashingMachine, Check,
  Languages, Clock, UserCircle2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import ReservationEstimate from "@/components/ReservationEstimate";
import IllustrativeReviews from "@/components/IllustrativeReviews";
import { useFavorite } from "@/lib/favorites";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyMap from "@/components/PropertyMap";
import { Button } from "@/components/ui/button";
import { AMENITY_META, DESTINATIONS } from "@/data/properties";
import { api, fileUrl } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const ICON_MAP = { Wind, Tv, Flame, Refrigerator, Wifi, Waves, Car, UtensilsCrossed, Palmtree, WashingMachine };

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [property, setProperty] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [liked, toggleFavorite] = useFavorite(id);

  useEffect(() => {
    let active = true;
    setProperty(null); setNotFound(false); setLoadError(false); setGalleryIndex(null);
    api.get(`/properties/${id}`).then(({data}) => {if(active) setProperty(data);})
      .catch(error => {if(active) {if(error.response?.status===404) setNotFound(true);else setLoadError(true);}});
    return () => {active=false;};
  }, [id,retry]);

  const destLabel = useMemo(
    () => DESTINATIONS.find((d) => d.id === property?.destination)?.label ?? "",
    [property],
  );
  const destState = useMemo(
    () => DESTINATIONS.find((d) => d.id === property?.destination)?.state ?? "",
    [property],
  );

  if (notFound || loadError) {
    return (
      <div className="min-h-screen bg-[#faf7f2]">
        <Navbar />
        <main id="conteudo" className="max-w-3xl mx-auto px-6 py-24 text-center" role="alert">
          <h1 className="font-display font-bold text-2xl">{notFound ? "Casa não encontrada" : "Não foi possível carregar o imóvel"}</h1>
          {loadError && <Button onClick={() => setRetry(v => v+1)} className="mt-4">Tentar novamente</Button>}
          <Button className="mt-6 rounded-full" onClick={() => navigate("/")}>Ver catálogo</Button>
        </main>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[#faf7f2]">
        <Navbar />
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="space-y-4" role="status" aria-label="Carregando imóvel" aria-busy="true">
            <div className="h-6 w-1/3 bg-[#f4efea] rounded" />
            <div className="h-80 bg-[#f4efea] rounded-2xl" />
            <div className="h-4 w-1/2 bg-[#f4efea] rounded" />
            <div className="h-4 w-1/3 bg-[#f4efea] rounded" />
          </div>
        </div>
      </div>
    );
  }

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: property.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch (error) { if(error.name !== "AbortError") toast.error("Não foi possível compartilhar. Copie o endereço da página."); }
  };

  const images = (property.images && property.images.length) ? property.images : (property.photos || []).map((p) => p.url);

  return (
    <div data-testid="property-detail-page">
      <Navbar />

      <main id="conteudo" tabIndex={-1} className="page-container detail-content">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-[#6E6E73] hover:text-[#1c1c1e]"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-[#1c1c1e]" data-testid="property-modal-title">
              {property.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#6E6E73]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-4 h-4 text-[#E05A36]" /> {destLabel} · {property.neighborhood}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full border-[#e6dfd5]" onClick={handleShare} data-testid="property-share-btn">
              <Share2 className="w-4 h-4 mr-2" /> Compartilhar
            </Button>
            <Button variant="outline" className="rounded-full border-[#e6dfd5]" onClick={toggleFavorite} aria-pressed={liked} data-testid="property-fav-btn">
              <Heart className="w-4 h-4 mr-2" fill={liked ? "currentColor" : "none"} /> {liked ? "Salvo" : "Salvar"}
            </Button>
          </div>
        </div>


        {images.length > 0 ? (
          <div className="relative mt-6 grid grid-cols-4 grid-rows-2 gap-2 sm:gap-3 rounded-2xl overflow-hidden h-[320px] sm:h-[460px]" data-testid="property-gallery" data-photo-count={Math.min(images.length, 5)}>
            {images[0] && (
              <button className="col-span-4 sm:col-span-2 row-span-2 w-full h-full" aria-label="Abrir galeria de fotos" onClick={() => setGalleryIndex(0)}>
                <img src={fileUrl(images[0])} alt={property.title} className="w-full h-full object-cover" />
              </button>
            )}
            {images.slice(1, 5).map((src, i) => (
              <button key={i} className="hidden sm:block w-full h-full" aria-label={`Abrir foto ${i + 2}`} onClick={() => setGalleryIndex(i + 1)}>
                <img src={fileUrl(src)} alt={`${property.title} ${i + 2}`} className="w-full h-full object-cover" />
              </button>
            ))}
            <Button variant="outline" className="absolute bottom-4 right-4 bg-white rounded-full" onClick={() => setGalleryIndex(0)}>Ver todas as fotos ({images.length})</Button>
          </div>
        ) : (
          <div
            className="mt-6 rounded-2xl border border-dashed border-[#d1c7b8] bg-[#f4efea] grid place-items-center h-[260px] sm:h-[360px]"
            data-testid="property-gallery-empty"
          >
            <div className="text-center px-6 max-w-sm">
              <div className="w-14 h-14 mx-auto rounded-full bg-white grid place-items-center text-[#1A5E63]">
                <Palmtree className="w-7 h-7" />
              </div>
              <p className="font-display font-bold text-[#1c1c1e] mt-4">Fotos não disponíveis</p>
              <p className="text-sm text-[#6E6E73] mt-1">
                Não há fotos disponíveis para este imóvel.
              </p>
            </div>
          </div>
        )}

        <Dialog open={galleryIndex !== null} onOpenChange={(open) => { if (!open) setGalleryIndex(null); }}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-[#faf7f2]">
            <DialogTitle>{property.title}</DialogTitle>
            <DialogDescription>Foto {(galleryIndex ?? 0) + 1} de {images.length}</DialogDescription>
            <div className="relative">
              {galleryIndex !== null && <img className="w-full max-h-[65vh] object-contain rounded-xl" src={fileUrl(images[galleryIndex])} alt={`${property.title} — foto ${galleryIndex + 1}`} />}
              <Button variant="outline" aria-label="Foto anterior" className="absolute left-2 top-1/2 rounded-full bg-white" onClick={() => setGalleryIndex((i) => (i - 1 + images.length) % images.length)}><ChevronLeft className="w-5 h-5" /></Button>
              <Button variant="outline" aria-label="Próxima foto" className="absolute right-2 top-1/2 rounded-full bg-white" onClick={() => setGalleryIndex((i) => (i + 1) % images.length)}><ChevronRight className="w-5 h-5" /></Button>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {images.map((src, i) => <button key={src} aria-label={`Ver foto ${i + 1}`} onClick={() => setGalleryIndex(i)} className={`shrink-0 rounded-lg overflow-hidden border-2 ${i === galleryIndex ? "border-[#E05A36]" : "border-transparent"}`}><img src={fileUrl(src)} alt={`Miniatura ${i + 1}`} className="w-24 h-16 object-cover" /></button>)}
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 mt-10">

          <div>
            <div className="mt-6 border-b border-[#e6dfd5] pb-6">
              <h2 className="font-display font-bold text-xl text-[#1c1c1e]">{property.tagline}</h2>
              <div className="mt-3 flex flex-wrap gap-5 text-sm text-[#6E6E73]">
                <span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4" /> {property.guests} hóspedes</span>
                <span className="inline-flex items-center gap-1.5"><BedDouble className="w-4 h-4" /> {property.bedrooms === 0 ? "Estúdio" : `${property.bedrooms} ${property.bedrooms === 1 ? "quarto" : "quartos"}`} · {property.beds} {property.beds === 1 ? "cama" : "camas"}</span>
                <span className="inline-flex items-center gap-1.5"><Bath className="w-4 h-4" /> {property.baths} {property.baths === 1 ? "banheiro" : "banheiros"}</span>
              </div>
            </div>

            <div className="mt-6 border-b border-[#e6dfd5] pb-6">
              <h3 className="font-display font-bold text-lg text-[#1c1c1e]">Sobre a casa</h3>
              <p className="mt-2 text-[#1c1c1e]/85 leading-relaxed whitespace-pre-line">{property.description}</p>
              {property.sourceUrl?.startsWith('https://www.airbnb.com.br/rooms/') && <a href={property.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-[#1A5E63] underline">Ver imóvel no Airbnb</a>}
            </div>

            {property.host && !property.demoReference && (
              <div className="mt-6 border-b border-[#e6dfd5] pb-6" data-testid="host-card">
                <h3 className="font-display font-bold text-lg text-[#1c1c1e]">Conheça o anfitrião</h3>
                <div className="mt-4 flex items-start gap-4 bg-white border border-[#e6dfd5] rounded-2xl p-5">
                  <div className="shrink-0">
                    {property.host.photo ? (
                      <img
                        src={fileUrl(property.host.photo)}
                        alt={property.host.name}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-[#faf7f2]"
                        data-testid="host-photo"
                      />
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#1A5E63] text-white grid place-items-center ring-4 ring-[#faf7f2]">
                        <UserCircle2 className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-display font-bold text-base text-[#1c1c1e]" data-testid="host-name">
                        {property.host.name}
                      </h4>
                    </div>
                    <p className="text-xs text-[#A19585] mt-0.5">
                      {property.host.since ? `Anfitrião desde ${property.host.since}` : "Ano de início não informado"}
                    </p>
                    {property.host.bio && (
                      <p className="text-sm text-[#1c1c1e]/85 mt-3 leading-relaxed">
                        {property.host.bio}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[#6E6E73]">
                      {property.host.response_time && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#E05A36]" /> Responde {property.host.response_time}
                        </span>
                      )}
                      {Array.isArray(property.host.languages) && property.host.languages.length > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Languages className="w-3.5 h-3.5 text-[#1A5E63]" />
                          {property.host.languages.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 border-b border-[#e6dfd5] pb-6">
              <h3 className="font-display font-bold text-lg text-[#1c1c1e]">O que esta casa oferece</h3>
              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="property-modal-amenities-list">
                {(property.amenities || []).map((a) => {
                  const meta = AMENITY_META[a];
                  if (!meta) return null;
                  const Icon = ICON_MAP[meta.icon] || Check;
                  return (
                    <li key={a} className="flex items-center gap-3 text-sm text-[#1c1c1e]" data-testid={`amenity-${a}`}>
                      <span className="w-9 h-9 grid place-items-center rounded-xl bg-[#f4efea] text-[#1A5E63]">
                        <Icon className="w-4 h-4" />
                      </span>
                      {meta.label}
                    </li>
                  );
                })}
              </ul>
            </div>


            <IllustrativeReviews reviews={property.sampleReviews} />

            <div className="mt-6">
              <h3 className="font-display font-bold text-lg text-[#1c1c1e]">Onde você vai estar</h3>
              <p className="text-sm text-[#6E6E73] mt-1">{property.neighborhood} · {destLabel}{destState ? `, ${destState}` : ""}</p>
              <p className="mt-2 text-sm text-[#6E6E73]">Localização aproximada. Confirme o endereço com o atendimento.</p>
              <div className="mt-4">
                <PropertyMap coords={property.coords} title={property.title} neighborhood={property.neighborhood} />
              </div>
            </div>
          </div>

          <div><ReservationEstimate key={id} property={property}/><Link to="/#destinos" className="mt-4 block text-center text-sm text-[#1A5E63] underline">Ver outras casas</Link></div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PropertyDetail;
