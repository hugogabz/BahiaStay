import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, XCircle, Home as HomeIcon, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { openSupportChat } from "@/lib/whatsapp";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const MAX_POLLS = 15;
const brl = (v) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const navigate = useNavigate();
  const [state, setState] = useState({ phase: "polling", data: null, attempts: 0 });

  useEffect(() => {
    if (!sessionId) {
      setState({ phase: "error", data: null, attempts: 0 });
      return;
    }
    let cancelled = false;
    let timer;
    const poll = async (n = 0) => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid") {
          setState({ phase: "paid", data, attempts: n });
          toast.success("Pagamento confirmado!");
          return;
        }
        if (["failed", "expired"].includes(data.payment_status)) {
          setState({ phase: "failed", data, attempts: n });
          return;
        }
        if (n >= MAX_POLLS) {
          setState({ phase: "pending", data, attempts: n });
          return;
        }
        timer = setTimeout(() => {if (!cancelled) poll(n + 1);}, 2000);
      } catch (e) {
        if (!cancelled) setState({ phase: "error", data: null, attempts: n });
      }
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);

  return (
    <div data-testid="payment-success-page">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        {state.phase === "polling" && (
          <div className="text-center" data-testid="payment-polling">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#1A5E63]/10 grid place-items-center">
              <Clock className="w-8 h-8 text-[#1A5E63] animate-pulse" />
            </div>
            <h1 className="font-display font-extrabold text-2xl mt-5">Confirmando seu pagamento…</h1>
            <p className="text-sm text-[#6E6E73] mt-2">Isso leva alguns segundos. Não feche esta página.</p>
          </div>
        )}
        {state.phase === "paid" && (
          <div className="bg-white border border-[#e6dfd5] rounded-2xl p-8 text-center" data-testid="payment-paid">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#2E7D32]/15 grid place-items-center">
              <CheckCircle2 className="w-9 h-9 text-[#2E7D32]" />
            </div>
            <h1 className="font-display font-extrabold text-2xl mt-5">Pagamento de teste aprovado</h1>
            <p className="text-[#6E6E73] mt-2">
              O pagamento de <strong className="text-[#1c1c1e]">{brl(state.data?.amount)}</strong> foi registrado no ambiente de teste. Nenhuma cobrança real foi feita.
            </p>
            <p className="text-xs text-[#A19585] mt-3">ID da reserva: {state.data?.booking_id}</p>
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              <Button onClick={() => navigate("/")} className="rounded-full bg-[#1A5E63] hover:bg-[#124146] text-white" data-testid="payment-home-btn">
                <HomeIcon className="w-4 h-4 mr-2" /> Voltar para a Home
              </Button>
              <Button onClick={() => openSupportChat("Olá! Acabei de confirmar o pagamento da minha reserva.")} variant="outline" className="rounded-full border-[#e6dfd5]">
                <MessageCircle className="w-4 h-4 mr-2" /> Falar no WhatsApp
              </Button>
            </div>
          </div>
        )}
        {state.phase === "pending" && (
          <div className="bg-white border border-[#e6dfd5] rounded-2xl p-8 text-center">
            <Clock className="w-10 h-10 text-[#D4930D] mx-auto" />
            <h1 className="font-display font-extrabold text-2xl mt-5">Pagamento em processamento</h1>
            <p className="text-sm text-[#6E6E73] mt-2">
              O pagamento ainda não foi confirmado. Consulte o status junto ao responsável pelo imóvel antes de tentar novamente.
            </p>
            <Button onClick={() => openSupportChat()} className="mt-6 rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white">
              <MessageCircle className="w-4 h-4 mr-2" /> Falar no WhatsApp
            </Button>
          </div>
        )}
        {state.phase === "failed" && (
          <div className="bg-white border border-[#e6dfd5] rounded-2xl p-8 text-center">
            <XCircle className="w-10 h-10 text-[#C84927] mx-auto" />
            <h1 className="font-display font-extrabold text-2xl mt-5">Pagamento não concluído</h1>
            <p className="text-sm text-[#6E6E73] mt-2">O pagamento não foi confirmado. Consulte o status antes de tentar novamente.</p>
            <Link to="/" className="inline-block mt-6 text-sm font-semibold text-[#E05A36] hover:underline">Voltar para a Home</Link>
          </div>
        )}
        {state.phase === "error" && (
          <div className="bg-white border border-[#e6dfd5] rounded-2xl p-8 text-center">
            <XCircle className="w-10 h-10 text-[#C84927] mx-auto" />
            <h1 className="font-display font-extrabold text-2xl mt-5">Não encontramos esse pagamento</h1>
            <p className="text-sm text-[#6E6E73] mt-2">Verifique o link ou fale com o nosso time.</p>
            <Button onClick={() => openSupportChat()} className="mt-6 rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white">
              <MessageCircle className="w-4 h-4 mr-2" /> Falar no WhatsApp
            </Button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
