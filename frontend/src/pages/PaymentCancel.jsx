import { Link } from "react-router-dom";
import { XCircle, MessageCircle, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { openSupportChat } from "@/lib/whatsapp";

export default function PaymentCancel() {
  return (
    <div data-testid="payment-cancel-page">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-white border border-[#e6dfd5] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#C84927]/10 grid place-items-center">
            <XCircle className="w-9 h-9 text-[#C84927]" />
          </div>
          <h1 className="font-display font-extrabold text-2xl mt-5">Pagamento cancelado</h1>
          <p className="text-sm text-[#6E6E73] mt-2">
            O checkout não foi concluído. Consulte o status do pagamento antes de tentar novamente; esta página não confirma uma cobrança nem uma reserva.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1c1c1e] hover:text-[#E05A36]">
              <ArrowLeft className="w-4 h-4" /> Voltar para a Home
            </Link>
            <Button onClick={() => openSupportChat()} className="rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white">
              <MessageCircle className="w-4 h-4 mr-2" /> Suporte pelo WhatsApp
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
