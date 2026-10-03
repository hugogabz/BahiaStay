import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function TestCheckout({ propertyId, start, end, guests, valid }) {
  const [enabled, setEnabled] = useState(false);
  const [configState, setConfigState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('');
  const [pix, setPix] = useState(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const contactValid = guestName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const booking = useRef(null);
  useEffect(() => {
    let active = true;
    api.get('/payments/config').then(({ data }) => {
      if (active) { setEnabled(data.enabled && data.test_mode); setProvider(data.provider); setConfigState('ready'); }
    }).catch(() => { if (active) setConfigState('error'); });
    return () => { active = false; };
  }, []);
  useEffect(() => { setPix(null); setPaid(false); setCopied(false); }, [propertyId, start, end, guests]);
  useEffect(() => {
    if (!pix || paid) return;
    let active = true;
    let timer;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${encodeURIComponent(pix.session_id)}`);
        if (active && data.payment_status === 'paid') { setPaid(true); setError(''); return; }
      } catch { if (active) setError('Não foi possível consultar o PIX. Vamos tentar novamente.'); }
      if (active) timer = setTimeout(poll, 15000);
    };
    timer = setTimeout(poll, 15000);
    return () => { active = false; clearTimeout(timer); };
  }, [pix, paid]);
  const checkout = async () => {
    if (!enabled || !valid || !contactValid || busy) return;
    setBusy(true);
    setError('');
    const selection = JSON.stringify([propertyId, start, end, guests, guestName.trim(), guestEmail.trim()]);
    try {
      if (booking.current?.selection !== selection) {
        const { data } = await api.post('/bookings', { property_id: propertyId, check_in: start, check_out: end, guests: Number(guests), guest_name: guestName.trim(), guest_contact: guestEmail.trim() });
        booking.current = { selection, id: data.id };
      }
      const { data } = await api.post('/payments/checkout', { booking_id: booking.current.id, origin_url: window.location.origin });
      if (data.provider === 'coldpay' && data.test_mode === true) {
        if (!data.qr_code?.startsWith('data:image/png;base64,') || !data.copy_paste || !data.session_id) throw new Error('Resposta PIX inválida.');
        setPix(data); setBusy(false); return;
      }
      const url = new URL(data.checkout_url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Endereço de pagamento inválido.');
      window.location.assign(url.href);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Não foi possível iniciar o pagamento. Tente novamente.');
      setBusy(false);
    }
  };
  return <div className="test-checkout">
    {enabled && !pix && <div className="checkout-guest-fields"><h3>Quem vai se hospedar?</h3><label htmlFor="checkout-name">Nome completo<input id="checkout-name" autoComplete="name" maxLength={120} value={guestName} onInput={event => setGuestName(event.target.value)} disabled={busy} /></label><label htmlFor="checkout-email">E-mail<input id="checkout-email" type="email" autoComplete="email" maxLength={254} value={guestEmail} onInput={event => setGuestEmail(event.target.value)} disabled={busy} /></label><p className="helper-text">Usaremos esses dados para identificar sua reserva.</p></div>}
    {!pix && <Button type="button" className="primary-action test-checkout-button" disabled={!enabled || !valid || !contactValid || busy} onClick={checkout}>
      {configState === 'loading' ? 'Carregando pagamento…' : busy ? 'Preparando pagamento…' : !enabled ? 'Pagamento indisponível' : provider === 'coldpay' ? 'Continuar com PIX' : 'Continuar para pagamento'}
    </Button>}
    <p className="helper-text" role={!enabled ? 'status' : undefined}>{configState === 'loading' ? 'Consultando as opções de pagamento.' : configState === 'error' ? 'Não foi possível carregar o pagamento. Atualize a página para tentar novamente.' : !enabled ? 'O pagamento online ainda não está disponível. Nenhuma reserva ou cobrança será criada.' : 'Ambiente de teste. Sem cobrança real. A reserva é confirmada após a aprovação do pagamento.'}</p>
    {pix && !paid && <div className="pix-checkout">
      <img src={pix.qr_code} alt="QR Code PIX do ambiente de teste" width="200" height="200" />
      <label htmlFor="pix-code">PIX copia e cola</label>
      <textarea id="pix-code" value={pix.copy_paste} readOnly rows="3" />
      <Button type="button" variant="outline" onClick={async () => {
        try { await navigator.clipboard.writeText(pix.copy_paste); setCopied(true); }
        catch { setError('Selecione e copie o código no campo acima.'); }
      }}>{copied ? 'Código copiado' : 'Copiar código PIX'}</Button>
      <p className="helper-text" role="status">Aguardando confirmação do pagamento de teste.</p>
      {pix.expires_at && Number.isFinite(Date.parse(pix.expires_at)) && <p className="helper-text">Válido até {new Date(pix.expires_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}.</p>}
    </div>}
    {paid && <p role="status">Pagamento de teste confirmado. Reserva aprovada.</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
