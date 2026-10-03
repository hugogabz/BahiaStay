import { Sparkles, Gift, ChevronRight } from "lucide-react";

export const PromoBanner = () => {
  return (
    <section id="ofertas" className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className="relative overflow-hidden rounded-3xl p-7 sm:p-9 text-white bg-[#E05A36]"
          data-testid="promo-weekly-package-card"
        >
          <div className="absolute -right-10 -top-10 w-56 h-56 bg-[#D4930D]/40 rounded-full blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] bg-white/20 rounded-full px-3 py-1 backdrop-blur">
              <Sparkles className="w-3.5 h-3.5" /> Pacote Semana
            </div>
            <h3 className="font-display font-extrabold text-2xl sm:text-3xl mt-4 leading-tight">
              7 noites por R$ 1.000 em casas selecionadas
            </h3>
            <p className="mt-3 text-white/90 text-sm sm:text-base max-w-md">
              Fique uma semana inteira pagando o que você pagaria por uma estadia curta.
              Economize até 33% nos chalés mais procurados da Bahia.
            </p>
            <a
              href="#destinos"
              className="mt-5 inline-flex items-center gap-1.5 bg-white text-[#E05A36] rounded-full px-4 py-2 text-sm font-semibold hover:scale-105"
            >
              Ver casas da promoção <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-3xl p-7 sm:p-9 text-white bg-[#1A5E63]"
          id="primeira-reserva"
          data-testid="promo-first-booking-card"
        >
          <div className="absolute -left-10 -bottom-10 w-56 h-56 bg-[#D4930D]/30 rounded-full blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] bg-white/15 rounded-full px-3 py-1 backdrop-blur">
              <Gift className="w-3.5 h-3.5" /> 1ª Reserva
            </div>
            <h3 className="font-display font-extrabold text-2xl sm:text-3xl mt-4 leading-tight">
              Ganhe 10% extra na sua primeira estadia
            </h3>
            <p className="mt-3 text-white/85 text-sm sm:text-base max-w-md">
              Nunca ficou com a gente? Marque &quot;1ª reserva&quot; na página da casa e abata mais
              10% sobre o total final — direto no WhatsApp.
            </p>
            <a
              href="#destinos"
              className="mt-5 inline-flex items-center gap-1.5 bg-white text-[#1A5E63] rounded-full px-4 py-2 text-sm font-semibold hover:scale-105"
            >
              Escolher minha primeira casa <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
