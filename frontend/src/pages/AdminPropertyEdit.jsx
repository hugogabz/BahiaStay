import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Trash2, UploadCloud, X, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const DESTINATIONS = [
  { id: "salvador", label: "Salvador · BA" },
  { id: "belmonte", label: "Belmonte · BA" },
  { id: "itacare", label: "Itacaré · BA" },
  { id: "porto-seguro", label: "Porto Seguro · BA" },
  { id: "ilheus", label: "Ilhéus · BA" },
  { id: "arraial-d-ajuda", label: "Arraial d'Ajuda · BA" },
  { id: "jericoacoara", label: "Jericoacoara · CE" },
  { id: "fernando-noronha", label: "Fernando de Noronha · PE" },
  { id: "buzios", label: "Búzios · RJ" },
  { id: "maragogi", label: "Maragogi · AL" },
  { id: "florianopolis", label: "Florianópolis · SC" },
];

const AMENITIES = [
  { key: "ac", label: "Ar-condicionado" }, { key: "tv", label: "TV" },
  { key: "stove", label: "Fogão" }, { key: "fridge", label: "Geladeira" },
  { key: "wifi", label: "Wi-Fi" }, { key: "pool", label: "Piscina" },
  { key: "bbq", label: "Churrasqueira" }, { key: "parking", label: "Estacionamento" },
  { key: "washer", label: "Máquina de lavar" }, { key: "kitchen", label: "Cozinha equipada" },
  { key: "ocean", label: "Vista para o mar" }, { key: "beach", label: "Pé na areia" },
];

export default function AdminPropertyEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const [property, setProperty] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/properties/${id}`);
      setProperty(data);
    } catch {
      toast.error("Casa não encontrada");
      navigate("/admin/casas");
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const update = (patch) => setProperty((p) => ({ ...p, ...patch }));
  const toggleAmenity = (k) => {
    const curr = property.amenities || [];
    update({ amenities: curr.includes(k) ? curr.filter((x) => x !== k) : [...curr, k] });
  };

  const save = async () => {
    if (!property) return;
    if ((property.unavailableDates || []).some(p => !p.check_in || !p.check_out || p.check_out <= p.check_in)) {
      toast.error('Preencha os bloqueios com uma saída depois da entrada.');
      return;
    }
    const seasonalRates = [property.seasonalPricing?.newYearPercent ?? 40, property.seasonalPricing?.julyPercent ?? 20];
    if (seasonalRates.some(value => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 300)) {
      toast.error('Informe aumentos entre 0% e 300%.');
      return;
    }
    setSaving(true);
    try {
      const h = property.host || {};
      const payload = {
        title: property.title, destination: property.destination, neighborhood: property.neighborhood,
        tagline: property.tagline, description: property.description,
        pricePerNight: Number(property.pricePerNight), weeklyPrice: Number(property.weeklyPrice),
        weeklyPackagePromo: Number(property.weeklyPackagePromo),
        seasonalPricing: {newYearPercent: Number(property.seasonalPricing?.newYearPercent ?? 40), julyPercent: Number(property.seasonalPricing?.julyPercent ?? 20)},
        unavailableDates: property.unavailableDates || [],
        rating: Number(property.rating || 4.9), reviews: Number(property.reviews || 0),
        guests: Number(property.guests), bedrooms: Number(property.bedrooms),
        beds: Number(property.beds), baths: Number(property.baths),
        coords: { lat: Number(property.coords.lat), lng: Number(property.coords.lng) },
        amenities: property.amenities || [],
        images: (property.photos || []).map((p) => p.url),
        host: {
          name: h.name || "Família Fonseca",
          bio: h.bio || "",
          photo: h.photo || null,
          photo_storage_path: h.photo_storage_path || null,
          since: h.since ? Number(h.since) : (property.demoReference ? null : 2019),
          languages: typeof h.languages === "string"
            ? h.languages.split(",").map((s) => s.trim()).filter(Boolean)
            : (h.languages || []),
          response_time: h.response_time || (property.demoReference ? "" : "em até 1 hora"),
        },
      };
      const { data } = await api.put(`/properties/${id}`, payload);
      setProperty(data);
      toast.success("Alterações salvas");
    } catch (e) {
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const updateHost = (patch) => setProperty((p) => ({ ...p, host: { ...(p.host || {}), ...patch } }));

  const uploadHostPhoto = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post(`/properties/${id}/host-photo`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateHost({ photo: data.url, photo_storage_path: data.storage_path });
      toast.success("Foto do anfitrião atualizada");
    } catch {
      toast.error("Erro ao enviar foto do anfitrião");
    } finally {
      ev.target.value = "";
    }
  };

  const removeHostPhoto = async () => {
    try {
      await api.delete(`/properties/${id}/host-photo`);
      updateHost({ photo: null, photo_storage_path: null });
      toast.success("Foto removida");
    } catch {
      toast.error("Erro ao remover foto");
    }
  };

  const onFile = async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const form = new FormData();
        form.append("file", f);
        const { data } = await api.post(`/properties/${id}/photos`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setProperty((p) => ({ ...p, photos: [...(p.photos || []), data] }));
      }
      toast.success(`${files.length} foto${files.length === 1 ? "" : "s"} enviada${files.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error("Erro no upload. Verifique o formato (JPG/PNG) e tente novamente.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removePhoto = async (photoId) => {
    try {
      await api.delete(`/properties/${id}/photos/${photoId}`);
      setProperty((p) => ({ ...p, photos: (p.photos || []).filter((ph) => ph.id !== photoId) }));
      toast.success("Foto removida");
    } catch {
      toast.error("Erro ao remover foto");
    }
  };

  if (!property) {
    return <div className="text-sm text-[#6E6E73]">Carregando…</div>;
  }

  return (
    <div className="max-w-5xl" data-testid="admin-property-edit-page">
      <Link to="/admin/casas" className="inline-flex items-center gap-1.5 text-sm text-[#6E6E73] hover:text-[#1c1c1e]">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="mt-4 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#A19585]">Editando</p>
          <h1 className="font-display font-extrabold text-3xl text-[#1c1c1e] mt-1">{property.title}</h1>
        </div>
        <Button onClick={save} disabled={saving} className="rounded-full bg-[#1A5E63] hover:bg-[#124146] text-white" data-testid="admin-save-property">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>

      <section className="mt-8 bg-white border border-[#e6dfd5] rounded-2xl p-6">
        <h3 className="font-display font-bold text-lg text-[#1c1c1e]">Fotos da casa</h3>
        <p className="text-sm text-[#6E6E73] mt-1">A primeira foto é usada como capa. Formatos aceitos: JPG, PNG, WEBP.</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(property.photos || []).map((ph) => (
            <div key={ph.id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#f4efea] group" data-testid={`admin-photo-${ph.id}`}>
              <img src={fileUrl(ph.url)} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(ph.id)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 hover:bg-white text-[#C84927] grid place-items-center shadow"
                aria-label="Remover foto"
                data-testid={`admin-photo-remove-${ph.id}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-[#d1c7b8] grid place-items-center cursor-pointer hover:bg-[#faf7f2]" data-testid="admin-photo-upload">
            <div className="text-center">
              <UploadCloud className="w-6 h-6 mx-auto text-[#1A5E63]" />
              <p className="text-xs font-semibold mt-1 text-[#1c1c1e]">{uploading ? "Enviando…" : "Enviar fotos"}</p>
              <p className="text-[10px] text-[#A19585]">até 10 MB cada</p>
            </div>
            <input ref={fileInput} type="file" multiple accept="image/*" onChange={onFile} className="hidden" />
          </label>
        </div>
      </section>

      <section className="mt-8 bg-white border border-[#e6dfd5] rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Título</Label>
          <Input value={property.title} onChange={(e) => update({ title: e.target.value })} className="h-11 mt-1.5" data-testid="edit-title" />
        </div>
        <div>
          <Label>Destino</Label>
          <Select value={property.destination} onValueChange={(v) => update({ destination: v })}>
            <SelectTrigger className="h-11 mt-1.5" data-testid="edit-destination"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DESTINATIONS.map((d) => (<SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Bairro / referência</Label>
          <Input value={property.neighborhood} onChange={(e) => update({ neighborhood: e.target.value })} className="h-11 mt-1.5" data-testid="edit-neighborhood" />
        </div>
        <div className="sm:col-span-2">
          <Label>Frase curta (tagline)</Label>
          <Input value={property.tagline} onChange={(e) => update({ tagline: e.target.value })} className="h-11 mt-1.5" />
        </div>
        <div className="sm:col-span-2">
          <Label>Descrição completa</Label>
          <Textarea value={property.description} onChange={(e) => update({ description: e.target.value })} rows={4} className="mt-1.5" />
        </div>
      </section>

      <section className="mt-8 bg-white border border-[#e6dfd5] rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Temporada e disponibilidade</h2>
        <div className="reservation-dates">
          <label>Réveillon e verão — aumento (%)<Input type="number" min="0" max="300" value={property.seasonalPricing?.newYearPercent ?? 40} onChange={e => update({seasonalPricing: {...{newYearPercent:40,julyPercent:20}, ...property.seasonalPricing, newYearPercent:e.target.value}})} /><small>20 de dezembro a 10 de janeiro</small></label>
          <label>Férias de julho — aumento (%)<Input type="number" min="0" max="300" value={property.seasonalPricing?.julyPercent ?? 20} onChange={e => update({seasonalPricing: {...{newYearPercent:40,julyPercent:20}, ...property.seasonalPricing, julyPercent:e.target.value}})} /><small>1 a 31 de julho</small></label>
        </div>
        <h3 className="font-medium mt-5">Períodos indisponíveis</h3><p className="helper-text">A saída libera o imóvel para uma nova entrada no mesmo dia.</p>
        {(property.unavailableDates || []).map((period, index) => <div className="blocked-period-row" key={index}><label>Entrada<input aria-label={`Entrada do bloqueio ${index + 1}`} type="date" value={period.check_in} onChange={e => update({unavailableDates:property.unavailableDates.map((p,i) => i === index ? {...p,check_in:e.target.value} : p)})} /></label><label>Saída<input aria-label={`Saída do bloqueio ${index + 1}`} type="date" value={period.check_out} onChange={e => update({unavailableDates:property.unavailableDates.map((p,i) => i === index ? {...p,check_out:e.target.value} : p)})} /></label><Button variant="outline" aria-label={`Remover bloqueio ${index + 1}`} onClick={() => update({unavailableDates:property.unavailableDates.filter((_,i) => i !== index)})}><X size={16}/></Button></div>)}
        <Button variant="outline" className="mt-4" onClick={() => update({unavailableDates:[...(property.unavailableDates || []), {check_in:'',check_out:''}]})}>Adicionar período</Button>
      </section>
      <section className="mt-8 bg-white border border-[#e6dfd5] rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <Label>Diária (R$)</Label>
          <Input type="number" value={property.pricePerNight} onChange={(e) => update({ pricePerNight: e.target.value })} className="h-11 mt-1.5" data-testid="edit-price" />
        </div>
        <div>
          <Label>7 noites — cheio (R$)</Label>
          <Input type="number" value={property.weeklyPrice} onChange={(e) => update({ weeklyPrice: e.target.value })} className="h-11 mt-1.5" />
        </div>
        <div>
          <Label>7 noites — promo (R$)</Label>
          <Input type="number" value={property.weeklyPackagePromo} onChange={(e) => update({ weeklyPackagePromo: e.target.value })} className="h-11 mt-1.5" data-testid="edit-weekly-promo" />
        </div>
        <div>
          <Label>Avaliação</Label>
          <Input type="number" step="0.01" value={property.rating} onChange={(e) => update({ rating: e.target.value })} className="h-11 mt-1.5" />
        </div>
        <div>
          <Label>Hóspedes</Label>
          <Input type="number" value={property.guests} onChange={(e) => update({ guests: e.target.value })} className="h-11 mt-1.5" />
        </div>
        <div>
          <Label>Quartos</Label>
          <Input type="number" value={property.bedrooms} onChange={(e) => update({ bedrooms: e.target.value })} className="h-11 mt-1.5" />
        </div>
        <div>
          <Label>Camas</Label>
          <Input type="number" value={property.beds} onChange={(e) => update({ beds: e.target.value })} className="h-11 mt-1.5" />
        </div>
        <div>
          <Label>Banheiros</Label>
          <Input type="number" step="0.5" value={property.baths} onChange={(e) => update({ baths: e.target.value })} className="h-11 mt-1.5" />
        </div>
      </section>

      <section className="mt-8 bg-white border border-[#e6dfd5] rounded-2xl p-6">
        <h3 className="font-display font-bold text-lg text-[#1c1c1e]">Localização no mapa</h3>
        <p className="text-xs text-[#6E6E73] mt-1">Latitude e longitude usadas para exibir o mapa na página da casa.</p>
        <div className="mt-4 grid grid-cols-2 gap-4 max-w-md">
          <div>
            <Label>Latitude</Label>
            <Input type="number" step="0.0001" value={property.coords.lat} onChange={(e) => update({ coords: { ...property.coords, lat: e.target.value } })} className="h-11 mt-1.5" />
          </div>
          <div>
            <Label>Longitude</Label>
            <Input type="number" step="0.0001" value={property.coords.lng} onChange={(e) => update({ coords: { ...property.coords, lng: e.target.value } })} className="h-11 mt-1.5" />
          </div>
        </div>
      </section>

      <section className="mt-8 bg-white border border-[#e6dfd5] rounded-2xl p-6" data-testid="admin-host-section">
        <h3 className="font-display font-bold text-lg text-[#1c1c1e]">Anfitrião</h3>
        <p className="text-xs text-[#6E6E73] mt-1">Essas informações aparecem na página pública da casa para gerar confiança.</p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-5">
          <div className="flex flex-col items-center sm:items-start">
            {property.host?.photo ? (
              <img src={fileUrl(property.host.photo)} alt="" className="w-32 h-32 rounded-full object-cover ring-4 ring-[#faf7f2]" data-testid="admin-host-photo" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-[#1A5E63] text-white grid place-items-center">
                <UserCircle2 className="w-14 h-14" />
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#e6dfd5] cursor-pointer hover:bg-[#f4efea]" data-testid="admin-host-upload">
                <UploadCloud className="w-3.5 h-3.5" /> {property.host?.photo ? "Trocar foto" : "Enviar foto"}
                <input type="file" accept="image/*" className="hidden" onChange={uploadHostPhoto} />
              </label>
              {property.host?.photo && (
                <button type="button" onClick={removeHostPhoto} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#e6dfd5] text-[#C84927] hover:bg-[#f4efea]" data-testid="admin-host-remove">
                  <Trash2 className="w-3.5 h-3.5" /> Remover
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nome do anfitrião</Label>
              <Input value={property.host?.name || ""} onChange={(e) => updateHost({ name: e.target.value })} className="h-11 mt-1.5" data-testid="admin-host-name" />
            </div>
            <div className="sm:col-span-2">
              <Label>Bio curta</Label>
              <Textarea rows={3} value={property.host?.bio || ""} onChange={(e) => updateHost({ bio: e.target.value })} className="mt-1.5" data-testid="admin-host-bio" placeholder="Conte quem recebe os hóspedes: 'Família que vive em Porto Seguro há 15 anos…'" />
            </div>
            <div>
              <Label>Anfitrião desde (ano)</Label>
              <Input type="number" value={property.host?.since ?? ""} onChange={(e) => updateHost({ since: e.target.value })} className="h-11 mt-1.5" />
            </div>
            <div>
              <Label>Tempo de resposta</Label>
              <Input value={property.host?.response_time || ""} onChange={(e) => updateHost({ response_time: e.target.value })} placeholder="em até 1 hora" className="h-11 mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label>Idiomas (separe por vírgula)</Label>
              <Input
                value={Array.isArray(property.host?.languages) ? property.host.languages.join(", ") : (property.host?.languages || "")}
                onChange={(e) => updateHost({ languages: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="Português, Inglês, Espanhol"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 bg-white border border-[#e6dfd5] rounded-2xl p-6">
        <h3 className="font-display font-bold text-lg text-[#1c1c1e]">Comodidades</h3>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {AMENITIES.map((a) => (
            <label key={a.key} className="flex items-center gap-2.5 cursor-pointer" data-testid={`edit-amenity-${a.key}`}>
              <Checkbox checked={(property.amenities || []).includes(a.key)} onCheckedChange={() => toggleAmenity(a.key)} />
              <span className="text-sm">{a.label}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <Button onClick={save} disabled={saving} className="rounded-full bg-[#1A5E63] hover:bg-[#124146] text-white">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
