import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home as HomeIcon, Building2, CalendarCheck, LogOut, Palmtree, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Brand from '@/components/Brand';

const NAV = [
  { to: "/admin", label: "Visão geral", icon: HomeIcon, exact: true, testid: "admin-nav-home" },
  { to: "/admin/casas", label: "Casas", icon: Building2, testid: "admin-nav-properties" },
  { to: "/admin/reservas", label: "Reservas", icon: CalendarCheck, testid: "admin-nav-bookings" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const onLogout = async () => {
    try {
      await logout();
      toast.success("Até logo!");
      navigate("/admin/login");
    } catch {
      toast.error("Não foi possível encerrar a sessão. Verifique a conexão e tente novamente.");
    }
  };

  const isActive = (to, exact) => (exact ? location.pathname === to : location.pathname.startsWith(to));

  return (
    <div className="admin-workspace min-h-screen bg-[#faf7f2] grid lg:grid-cols-[260px_1fr]" data-testid="admin-layout">
      <aside className="hidden lg:flex flex-col border-r border-[#e6dfd5] bg-white">
        <div className="p-6 border-b border-[#e6dfd5]">
          <Link to="/admin" aria-label="Bahia Stay — administração"><Brand /></Link>
          <p className="mt-4 text-xs font-medium text-[#62625f]">Área administrativa</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? 'page' : undefined}
                data-testid={n.testid}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${active ? "bg-[#f4efea] text-[#1c1c1e]" : "text-[#6E6E73] hover:bg-[#f4efea] hover:text-[#1c1c1e]"}`}
              >
                <Icon className="w-4 h-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#e6dfd5]">
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-[#6E6E73] hover:text-[#1c1c1e]">
            <ExternalLink className="w-3.5 h-3.5" /> Ver site público
          </a>
          <div className="mt-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1A5E63] text-white grid place-items-center text-sm font-bold">
              {(user?.name || user?.email || "A").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name || "Admin"}</p>
              <p className="text-xs text-[#6E6E73] truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            onClick={onLogout}
            variant="outline"
            className="w-full mt-3 rounded-full border-[#e6dfd5]"
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-[#e6dfd5] flex items-center justify-between px-4 h-14">
        <Link to="/admin" className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#E05A36] text-white grid place-items-center">
            <Palmtree className="w-4 h-4" />
          </span>
          <p className="font-display font-extrabold text-sm">Painel</p>
        </Link>
        <Button variant="outline" size="sm" onClick={onLogout} className="rounded-full">
          <LogOut className="w-4 h-4 mr-1.5" /> Sair
        </Button>
      </header>

      <main className="p-5 sm:p-8 lg:p-10">

        <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-thin mb-6 -mx-5 px-5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border ${active ? "bg-[#1c1c1e] text-white border-[#1c1c1e]" : "bg-white text-[#1c1c1e] border-[#e6dfd5]"}`}
              >
                <Icon className="w-3.5 h-3.5" /> {n.label}
              </Link>
            );
          })}
        </div>
        <Outlet />
      </main>
    </div>
  );
}
