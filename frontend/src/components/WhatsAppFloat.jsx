import { MessageCircle } from "lucide-react";
import { openSupportChat } from "@/lib/whatsapp";

export const WhatsAppFloat = () => {
  return (
    <button
      type="button"
      onClick={() => openSupportChat()}
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128C7E] text-white px-4 py-3 sm:px-5 sm:py-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 flex items-center gap-2 font-semibold"
      data-testid="floating-whatsapp-btn"
      aria-label="Falar com atendente no WhatsApp"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="hidden sm:inline">Reservar via WhatsApp</span>
    </button>
  );
};

export default WhatsAppFloat;
