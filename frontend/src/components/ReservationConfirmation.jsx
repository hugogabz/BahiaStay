import { Link } from 'react-router-dom';
import { Check, Mail, Printer, ArrowUpRight } from 'lucide-react';
import { AMENITY_META, DESTINATIONS } from '@/data/properties';
import { fileUrl } from '@/lib/api';

const formatDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : '—';
const money = value => Number(value || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});

export default function ReservationConfirmation({confirmation}) {
  if (!confirmation) return <section className="reservation-confirmation" role="status"><h1>Pagamento confirmado</h1><p>O resumo da reserva ainda não está disponível. Guarde a referência do pagamento e fale com o suporte.</p></section>;
  const {property: house, email_status: emailStatus} = confirmation;
  const destination = DESTINATIONS.find(item => item.id === house.destination)?.label || house.destination;
  const emailText = emailStatus === 'sent'
    ? `Enviamos o resumo da reserva para ${confirmation.email_address}. Confira também a pasta de spam.`
    : emailStatus === 'pending' ? 'Estamos preparando o envio do seu resumo por e-mail. Você já pode salvar uma cópia abaixo.'
    : 'O resumo está disponível nesta página. O envio por e-mail não foi concluído; salve uma cópia ou fale com o suporte.';
  return <section className="reservation-confirmation" data-testid="reservation-confirmation">
    <header className="confirmation-heading"><span className="confirmation-check" aria-hidden="true"><Check size={28}/></span><div><p className="eyebrow">Tudo certo com sua estadia</p><h1>Reserva confirmada</h1><p>Guarde os detalhes e comece a planejar seus dias na Bahia.</p></div></header>
    <div className="confirmation-email" role="status"><Mail size={20} aria-hidden="true"/><p>{emailText}</p></div>
    <div className="confirmation-layout">
      <article className="confirmation-house">
        {house.photo && <img src={fileUrl(house.photo)} alt={house.title} className="confirmation-photo"/>}
        <div className="confirmation-house-body"><p className="eyebrow">Sua casa na Bahia</p><h2>{house.title}</h2><p className="confirmation-location">{house.neighborhood}{destination ? ` · ${destination}` : ''}</p>
          <p className="confirmation-capacity">{[house.bedrooms && `${house.bedrooms} quartos`,house.beds && `${house.beds} camas`,house.baths && `${house.baths} banheiros`].filter(Boolean).join(' · ')}</p>
          {house.host && <p>Anfitrião: <strong>{house.host}</strong></p>}
          <details className="confirmation-house-details"><summary>Sobre a casa e comodidades</summary>
            {house.description && <p className="confirmation-description">{house.description}</p>}
            <ul className="confirmation-amenities">{(house.amenities || []).filter(id=>AMENITY_META[id]).map(id=><li key={id}>{AMENITY_META[id].label}</li>)}</ul>
          </details>
          <Link to={`/casa/${encodeURIComponent(house.id)}`} className="confirmation-house-link">Ver detalhes da casa <ArrowUpRight size={16} aria-hidden="true"/></Link>
        </div>
      </article>
      <aside className="confirmation-summary" aria-labelledby="confirmation-summary-title"><p className="eyebrow">Detalhes da reserva</p><h2 id="confirmation-summary-title">Sua estadia</h2>
        <dl><div><dt>Entrada</dt><dd>{formatDate(confirmation.check_in)}</dd></div><div><dt>Saída</dt><dd>{formatDate(confirmation.check_out)}</dd></div><div><dt>Período</dt><dd>{confirmation.nights} {confirmation.nights === 1 ? 'noite' : 'noites'}</dd></div><div><dt>Pessoas</dt><dd>{confirmation.guests} {confirmation.guests === 1 ? 'hóspede' : 'hóspedes'}</dd></div><div className="confirmation-total"><dt>Valor confirmado</dt><dd>{money(confirmation.amount)}</dd></div><div className="confirmation-reference"><dt>Referência da reserva</dt><dd>{confirmation.booking_id}</dd></div></dl>
        <button type="button" onClick={()=>window.print()} className="primary-action confirmation-print"><Printer size={17} aria-hidden="true"/> Imprimir ou salvar resumo</button>
        <div className="confirmation-arrival"><h3>Antes de chegar</h3><p>Confirme os horários de entrada e saída, a entrega das chaves e o endereço completo com o atendimento.</p></div>
        {confirmation.test_mode && <p className="confirmation-footnote">Pagamento em ambiente de teste, sem cobrança real.</p>}
      </aside>
    </div>
  </section>;
}
