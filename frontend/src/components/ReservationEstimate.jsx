import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';
import { dateError, localDate, quoteStay, overlapsStay, seasonForDate, DEFAULT_SEASONAL_PRICING } from '@/lib/stay';
import { supportUrl } from '@/lib/whatsapp';
import TestCheckout from '@/components/TestCheckout';
const brl = v => Number(v || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
const displayDate = value => {
  const date = new Date(value + 'T00:00:00');
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('pt-BR', {day:'2-digit', month:'short', year:'numeric'}) : 'Selecione';
};
export default function ReservationEstimate({
  property
}) {
  const [params, setParams] = useSearchParams();
  const start = params.get('entrada') || '',
    end = params.get('saida') || '',
    guests = params.get('hospedes') || '1';
  const [touched, setTouched] = useState(Boolean(start || end));
  const blocked = [...(property.unavailableDates || []), ...(property.bookedDates || [])];
  const error = dateError(start, end) || (overlapsStay(start, end, blocked) ? 'Este período inclui noites já reservadas. Escolha outras datas.' : '');
  const rates = {...DEFAULT_SEASONAL_PRICING, ...property.seasonalPricing};
  const capacityError = !/^\d+$/.test(guests) || Number(guests) < 1 || Number(guests) > Number(property.guests);
  const hasPrice = Number.isFinite(Number(property.pricePerNight)) && Number(property.pricePerNight) > 0;
  const quote = quoteStay(property, error ? '' : start, error ? '' : end);
  const update = (key, value) => {
    setTouched(true);
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);else next.delete(key);
    setParams(next, {
      replace: true
    });
  };
  return <aside className="reservation-panel" data-testid="booking-widget">
    <h2>Planeje sua estadia</h2><p className="reservation-price">{hasPrice ? <><strong>{brl(property.pricePerNight)}</strong> / noite</> : <strong>Consultar valor</strong>}</p>
  <div className="stay-calendar"><h3>Escolha seu período</h3>
    <dl className="selected-stay-dates" aria-live="polite"><div><dt>Entrada</dt><dd>{displayDate(start)}</dd></div><div><dt>Saída</dt><dd>{displayDate(end)}</dd></div></dl>
    <p className="helper-text">{start && !end ? 'Agora selecione a saída no calendário.' : start && end ? 'Para mudar o período, selecione uma nova entrada.' : 'Selecione a entrada e depois a saída.'}</p>
    <DayPicker modifiersClassNames={{season:'rdp-day_season', reserved:'rdp-day_reserved'}} labels={{
        labelNext: () => "Próximo mês",
        labelPrevious: () => "Mês anterior",
        labelDay: (date, modifiers) => `${date.toLocaleDateString('pt-BR', {dateStyle:'full'})}${modifiers.reserved ? ', reservado ou indisponível' : ''}${modifiers.selected ? ', selecionado' : ''}`
      }} mode="range" locale={ptBR} selected={{
        from: start ? new Date(start + 'T00:00:00') : undefined,
        to: end ? new Date(end + 'T00:00:00') : undefined
      }} defaultMonth={start ? new Date(start + 'T00:00:00') : new Date()} disabled={[{
        before: new Date(localDate() + 'T00:00:00')
      }, date => blocked.some(b => localDate(date) >= b.check_in && localDate(date) < b.check_out && !(!end && start && start < b.check_in && localDate(date) === b.check_in))]} modifiers={{season: date => Boolean(seasonForDate(localDate(date), rates)), reserved: date => blocked.some(b => localDate(date) >= b.check_in && localDate(date) < b.check_out)}} onSelect={(range, selectedDay) => {
        setTouched(true);
        const next = new URLSearchParams(params);
        const from = start && end ? selectedDay : range?.from;
        const to = start && end || !range?.to || !from || localDate(range.to) <= localDate(from) ? undefined : range.to;
        if (from) next.set('entrada', localDate(from));else next.delete('entrada');
        if (to) next.set('saida', localDate(to));else next.delete('saida');
        setParams(next, {
          replace: true
        });
      }} />
    <div className="calendar-legend"><span><i className="legend-selected" />Sua estadia</span><span><i className="legend-reserved" />Reservado / indisponível</span><span><i className="legend-season" />Alta temporada</span></div>
    <div className="season-note">{rates.newYearPercent > 0 && <p>20 dez – 10 jan · +{rates.newYearPercent}%</p>}{rates.julyPercent > 0 && <p>Férias de julho · +{rates.julyPercent}%</p>}</div>
  </div>
  {touched && error && (!start || end) && <p id="booking-date-error" className="field-error" role="alert">{error}</p>}
  <label className="guest-field">Hóspedes<select value={guests} onChange={e => update('hospedes', e.target.value)} aria-invalid={capacityError} aria-describedby="guest-capacity" data-testid="booking-guests">{capacityError && <option value={guests}>{guests} hóspedes</option>}{Array.from({
          length: Number(property.guests) || 1
        }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} {n === 1 ? 'hóspede' : 'hóspedes'}</option>)}</select></label><p id="guest-capacity" className={capacityError ? 'field-error' : 'helper-text'} role={capacityError ? 'alert' : undefined}>{capacityError ? 'A quantidade supera a capacidade. Escolha menos hóspedes.' : `Capacidade máxima: ${property.guests} hóspedes.`}</p>
  {(start || end) && <button className="text-action" onClick={() => {
      const next = new URLSearchParams(params);
      next.delete('entrada');
      next.delete('saida');
      setParams(next, {
        replace: true
      });
      setTouched(false);
    }}>Limpar datas</button>}
  <div className="estimate-breakdown" aria-live="polite" data-testid="property-modal-price-breakdown">{hasPrice && quote.nights > 0 && !capacityError ? <><p><span>{brl(property.pricePerNight)} × {quote.nights} {quote.nights === 1 ? 'noite' : 'noites'}</span><span>{brl(quote.baseTotal)}</span></p>{quote.seasonalPeriods.map(period => <p key={period.label}><span>{period.label} +{period.percent}%<small className="season-nights">{period.nights} {period.nights === 1 ? 'noite' : 'noites'}</small></span><span>+{brl(period.extra)}</span></p>)}{quote.weeklyApplied && <p><span>Ajuste do pacote de 7 noites</span><span>-{brl(quote.nightlyTotal - quote.total)}</span></p>}<p className="estimate-total"><span>Total estimado</span><strong data-testid="booking-total">{brl(quote.total)}</strong></p><p className="helper-text">Taxas adicionais e condições finais devem ser confirmadas com o atendimento.</p></> : <p className="helper-text">{hasPrice ? 'Selecione datas disponíveis e a quantidade de hóspedes para calcular a estadia.' : 'Confirme o valor do período com o atendimento.'}</p>}</div>
  <Button asChild className="primary-action reservation-contact"><a href={supportUrl(`Olá! Gostaria de saber mais sobre ${property.title}.${!error && !capacityError && start && end ? ` Período: ${start} a ${end}, ${guests} hóspede(s).` : ''}`)} target="_blank" rel="noopener noreferrer">Combinar reserva pelo WhatsApp</a></Button><p className="helper-text">A reserva é confirmada com o atendimento pelo WhatsApp.</p>
  <TestCheckout propertyId={property.id} start={start} end={end} guests={guests} valid={Boolean(hasPrice && start && end && !error && !capacityError)} />
 </aside>;
}
