import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, MapPin, Star, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { api, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function AdminProperties() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: props }, { data: bks }] = await Promise.all([
        api.get("/properties"),
        api.get("/admin/bookings"),
      ]);
      setList(props);
      setBookings(bks);
    } catch (e) {
      toast.error("Erro ao carregar casas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((p) =>
      (p.title + " " + p.destination + " " + p.neighborhood).toLowerCase().includes(t),
    );
  }, [list, q]);

  const pendingCount = (pid) => bookings.filter((b) => b.property_id === pid && b.status === "pending").length;

  const createNew = async () => {
    try {
      const payload = {
        title: "Nova casa",
        destination: "porto-seguro",
        neighborhood: "Novo bairro",
        tagline: "Descreva a casa em uma frase",
        description: "Descrição completa da casa.",
        pricePerNight: 500, weeklyPrice: 2500, weeklyPackagePromo: 1800,
        rating: 4.9, reviews: 0, guests: 4, bedrooms: 2, beds: 3, baths: 1,
        coords: { lat: -16.418, lng: -39.059 },
        amenities: ["wifi", "tv", "fridge"],
        images: [],
      };
      const { data } = await api.post("/properties", payload);
      toast.success("Casa criada! Agora é só editar.");
      window.location.href = `/admin/casas/${data.id}`;
    } catch (e) {
      toast.error("Erro ao criar casa");
    }
  };

  const remove = async (pid) => {
    try {
      await api.delete(`/properties/${pid}`);
      setList((prev) => prev.filter((p) => p.id !== pid));
      toast.success("Casa excluída");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <div data-testid="admin-properties-page">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#A19585]">Painel</p>
          <h1 className="font-display font-extrabold text-3xl text-[#1c1c1e] mt-1">Minhas casas</h1>
          <p className="text-sm text-[#6E6E73] mt-1">
            {list.length} casa{list.length === 1 ? "" : "s"} cadastrada{list.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Button
          onClick={createNew}
          className="rounded-full bg-[#E05A36] hover:bg-[#C84927] text-white"
          data-testid="admin-create-property-btn"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova casa
        </Button>
      </div>

      <div className="mt-6 max-w-md">
        <Input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, destino ou bairro…"
          className="h-11"
          data-testid="admin-properties-search"
        />
      </div>

      <div className="mt-6 bg-white border border-[#e6dfd5] rounded-2xl overflow-hidden" data-testid="admin-properties-table">
        {loading ? (
          <div className="p-10 text-center text-[#6E6E73] text-sm">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[#6E6E73] text-sm">Nenhuma casa encontrada.</div>
        ) : (
          <ul className="divide-y divide-[#e6dfd5]">
            {filtered.map((p) => {
              const cover = p.photos?.[0]?.url;
              const pending = pendingCount(p.id);
              return (
                <li key={p.id} className="p-4 sm:p-5 flex items-center gap-4 hover:bg-[#faf7f2]">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#f4efea] shrink-0 grid place-items-center">
                    {cover ? (
                      <img src={fileUrl(cover)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-[#A19585]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-[#1c1c1e] truncate">{p.title}</h3>
                      {pending > 0 && (
                        <span className="text-[10px] font-semibold uppercase tracking-widest bg-[#E05A36]/10 text-[#E05A36] rounded-full px-2 py-0.5">
                          {pending} pedido{pending > 1 ? "s" : ""} pendente{pending > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#6E6E73] truncate">
                      <MapPin className="w-3.5 h-3.5 inline-block mr-1" />
                      {p.neighborhood} · {p.destination}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-[#6E6E73]">
                      <span className="font-semibold text-[#1c1c1e]">{brl(p.pricePerNight)}</span>
                      <span>/ noite</span>
                      <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-[#1c1c1e] text-[#1c1c1e]" /> {p.rating?.toFixed?.(2) ?? p.rating}</span>
                      <span>{p.photos?.length || 0} foto{(p.photos?.length || 0) === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/admin/casas/${p.id}`} data-testid={`admin-property-edit-${p.id}`}>
                      <Button variant="outline" size="sm" className="rounded-full border-[#e6dfd5]">
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-full border-[#e6dfd5] text-[#C84927]" data-testid={`admin-property-delete-${p.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir "{p.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação remove a casa e todas as reservas vinculadas. Não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(p.id)} className="bg-[#C84927] hover:bg-[#A6391F]">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
