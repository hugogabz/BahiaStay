import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Building2, CalendarCheck, Clock } from "lucide-react";
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const [props, setProps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const [{ data: p }, { data: b }] = await Promise.all([
          api.get("/properties"),
          api.get("/admin/bookings"),
        ]);
        if (active) { setProps(p); setBookings(b); }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [retry]);

  const stats = useMemo(() => ({
    properties: props.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    approved: bookings.filter((b) => b.status === "approved").length,
  }), [props, bookings]);

  return (
    <div data-testid="admin-dashboard">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#A19585]">Visão geral</p>
      <h1 className="font-display font-extrabold text-3xl text-[#1c1c1e] mt-1">Resumo do catálogo</h1>
      <p className="text-sm text-[#6E6E73] mt-1">Imóveis cadastrados e registros de reservas.</p>
      {error && <div role="alert" className="result-message mt-6"><p>Não foi possível carregar o resumo. Os números estão indisponíveis.</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button></div>}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4" aria-busy={loading}>
        <Card icon={Building2} label="Casas cadastradas" value={loading ? '…' : error ? '—' : stats.properties} tone="#1A5E63" />
        <Card icon={Clock} label="Pedidos pendentes" value={loading ? '…' : error ? '—' : stats.pending} tone="#1A5E63" />
        <Card icon={CalendarCheck} label="Reservas aprovadas" value={loading ? '…' : error ? '—' : stats.approved} tone="#1A5E63" />
      </div>

      <nav aria-label="Ações administrativas" className="mt-8 flex flex-wrap gap-3"><Button asChild className="primary-action"><Link to="/admin/casas">Gerenciar imóveis</Link></Button><Button asChild variant="outline"><Link to="/admin/reservas">Ver registros de reservas</Link></Button></nav>
    </div>
  );
}

function Card({ icon: Icon, label, value, tone }) {
  return (
    <div className="bg-white border border-[#e6dfd5] rounded-2xl p-5 flex items-center gap-4">
      <span className="w-11 h-11 rounded-xl grid place-items-center text-white" style={{ backgroundColor: tone }}>
        <Icon className="w-5 h-5" />
      </span>
      <div>
        <p className="text-xs font-medium text-[#62625f]">{label}</p>
        <p className="font-display font-extrabold text-2xl text-[#1c1c1e]">{value}</p>
      </div>
    </div>
  );
}
