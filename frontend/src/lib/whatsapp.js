import { toast } from "sonner";


export const WHATSAPP_PHONE = (process.env.REACT_APP_WHATSAPP_PHONE || '5511981389572').replace(/\D/g, '');

export function supportUrl(message = 'Olá! Vi o site da Bahia Stay e queria tirar dúvidas sobre as casas de temporada.') {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

const brl = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export function buildCheckoutMessage({
  property,
  checkIn,
  checkOut,
  guests,
  nights,
  nightlyTotal,
  weeklyPromoApplied,
  firstBookingApplied,
  firstBookingDiscount,
  finalTotal,
}) {
  const lines = [
    '*Reserva — Bahia Stay*',
    '',
    `*Casa:* ${property.title}`,
    `*Local:* ${property.neighborhood}`,
    `*Check-in:* ${checkIn || '— a combinar —'}`,
    `*Check-out:* ${checkOut || '— a combinar —'}`,
    `*Hóspedes:* ${guests}`,
    `*Noites:* ${nights}`,
    '',
    `*Diária:* ${brl(property.pricePerNight)}`,
    `*Subtotal:* ${brl(nightlyTotal)}`,
  ];

  if (weeklyPromoApplied) {
    lines.push(
      `*Pacote Semana aplicado:* ${brl(property.weeklyPrice)} → ${brl(property.weeklyPackagePromo)}`,
    );
  }
  if (firstBookingApplied) {
    lines.push(`*Desconto 1ª Reserva (10%):* -${brl(firstBookingDiscount)}`);
  }
  lines.push('', `*Total a pagar:* ${brl(finalTotal)}`, '', 'Olá! Gostaria de confirmar essa reserva. 🌴');
  return lines.join('\n');
}

export function openWhatsApp(message) {
  if (!WHATSAPP_PHONE) { toast.info("O atendimento por WhatsApp ainda não está configurado."); return false; }
  const url = supportUrl(message);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openSupportChat(presetText) {
  const text =
    presetText ||
    'Olá! Vi o site da Bahia Stay e queria tirar dúvidas sobre as casas de temporada.';
  openWhatsApp(text);
}
