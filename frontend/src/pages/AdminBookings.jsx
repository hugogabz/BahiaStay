import { useEffect, useMemo, useState } from "react";
import { Check, X, CalendarCheck, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const brl = (v) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("pt-BR");
};

const statusMeta = {
  pending: { label: "Pendente", color: "bg-[#D4930D]/15 text-[#8E6005]" },
  approved: { label: "Aprovada", color: "bg-[#2E7D32]/15 text-[#1B5E20]" },
  rejected: { label: "Rejeitada", color: "bg-[#C84927]/15 text-[#8E2A14]" },
};

export default function AdminBookings() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/bookings");
      setList(data);
    } catch {
      toast.error("Erro ao carregar reservas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/bookings/${id}`, { status });
      setList((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
      toast.success(status === "approved" ? "Reserva aprovada e datas bloqueadas" : status === "rejected" ? "Reserva rejeitada" : "Reserva atualizada");
    } catch {
      toast.error("Erro ao atualizar reserva");
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/admin/bookings/${id}`);
      setList((prev) => prev.filter((b) => b.id !== id));
      toast.success("Reserva removida");
    } catch {
      toast.error("Erro ao remover reserva");
    }
  };

  const groups = useMemo(() => ({
    pending: list.filter((b) => b.status === "pending"),
    approved: list.filter((b) => b.status === "approved"),
    rejected: list.filter((b) => b.status === "rejected"),
  }), [list]);

  const current = groups[tab] || [];

  return (
    <div data-testid="admin-bookings-page">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#A19585]">Painel</p>
      <h1 className="font-display font-extrabold text-3xl text-[#1c1c1e] mt-1">Reservas</h1>
      <p className="text-sm text-[#6E6E73] mt-1">
        As reservas iniciadas pelo checkout do site aparecem aqui.
        Aprove para bloquear as datas no calendário público.
      </p>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="bg-[#f4efea]">
          <TabsTrigger value="pending" data-testid="bookings-tab-pending">
            Pendentes <Badge variant="secondary" className="ml-2">{groups.pending.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="bookings-tab-approved">
            Aprovadas <Badge variant="secondary" className="ml-2">{groups.approved.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="bookings-tab-rejected">
            Rejeitadas <Badge variant="secondary" className="ml-2">{groups.rejected.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-5">
          <div className="bg-white border border-[#e6dfd5] rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-[#6E6E73] text-sm">Carregando…</div>
            ) : current.length === 0 ? (
              <div className="p-10 text-center text-[#6E6E73] text-sm">
                Nenhuma reserva nesta aba.
              </div>
            ) : (
              <ul className="divide-y divide-[#e6dfd5]">
                {current.map((b) => {
                  const meta = statusMeta[b.status];
                  return (
                    <li key={b.id} className="p-5 flex items-center gap-4 flex-wrap" data-testid={`booking-row-${b.id}`}>
                      <div className="w-10 h-10 rounded-full bg-[#1A5E63] text-white grid place-items-center">
                        <CalendarCheck className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-bold text-[#1c1c1e]">{b.property_title || b.property_id}</h3>
                          <span className={`text-[10px] font-semibold uppercase tracking-widest rounded-full px-2 py-0.5 ${meta.color}`}>{meta.label}</span>
                        </div>
                        <p className="text-sm text-[#6E6E73] mt-0.5">
                          {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.guests} hóspede{b.guests > 1 ? "s" : ""}
                          {b.total ? ` · ${brl(b.total)}` : ""}
                        </p>
                        <p className="text-xs text-[#A19585] mt-0.5">Pedido em {fmtDate(b.created_at?.slice(0, 10))}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {b.status !== "approved" && (
                          <Button size="sm" onClick={() => updateStatus(b.id, "approved")} className="rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white" data-testid={`booking-approve-${b.id}`}>
                            <Check className="w-3.5 h-3.5 mr-1.5" /> Aprovar
                          </Button>
                        )}
                        {b.status !== "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "rejected")} className="rounded-full border-[#e6dfd5]" data-testid={`booking-reject-${b.id}`}>
                            <X className="w-3.5 h-3.5 mr-1.5" /> Rejeitar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => remove(b.id)} className="rounded-full border-[#e6dfd5] text-[#C84927]">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex items-center gap-2 text-xs text-[#6E6E73]">
        <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
        Dica: aprovar bloqueia as datas no calendário público da casa.
      </div>
    </div>
  );
}
