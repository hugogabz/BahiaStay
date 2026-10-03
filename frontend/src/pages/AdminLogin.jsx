import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogIn, Lock, UserRound } from "lucide-react";
import Brand from '@/components/Brand';
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function fmtError(detail) {
  if (!detail) return "Erro ao fazer login";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo de volta!");
      navigate("/admin");
    } catch (err) {
      toast.error(fmtError(err?.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] grid lg:grid-cols-2" data-testid="admin-login-page">
      <div className="hidden lg:block relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1760067538263-fb7126fe748c?crop=entropy&cs=srgb&fm=jpg&w=1600&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#123c3f]/70" />
        <div className="relative h-full flex flex-col justify-between p-10 text-white">
          <Brand inverse />
          <div>
            <h2 className="font-display font-extrabold text-3xl leading-tight max-w-sm">
              Gestão de imóveis e estadias.
            </h2>
            <p className="mt-3 text-white/80 max-w-sm text-sm">
              Atualize seu catálogo, organize as fotos e acompanhe os registros de reservas.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md bg-white border border-[#e6dfd5] rounded-2xl p-8 shadow-[0_12px_32px_rgba(28,28,30,0.08)]"
        >
          <p className="text-xs font-medium text-[#62625f]">Área administrativa · Acesso restrito</p>
          <h1 className="font-display font-extrabold text-2xl text-[#1c1c1e] mt-1">Entrar no painel</h1>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-semibold">Login</Label>
              <div className="relative mt-1.5">
                <UserRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A19585]" />
                <Input
                  id="email" type="text" autoComplete="username" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu login" className="pl-9 h-11"
                  data-testid="admin-login-email"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-semibold">Senha</Label>
              <div className="relative mt-1.5">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A19585]" />
                <Input
                  id="password" type="password" autoComplete="current-password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha" className="pl-9 h-11"
                  data-testid="admin-login-password"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit" disabled={submitting}
            className="w-full mt-6 h-11 bg-[#E05A36] hover:bg-[#C84927] text-white rounded-full font-semibold"
            data-testid="admin-login-submit"
          >
            <LogIn className="w-4 h-4 mr-2" />
            {submitting ? "Entrando…" : "Entrar"}
          </Button>

          <p className="text-xs text-[#A19585] text-center mt-6">
            Acesso restrito. Esqueceu a senha? Fale com o suporte.
          </p>
        </form>
      </div>
    </div>
  );
}
