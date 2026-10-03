import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function TestCheckout({ propertyId, start, end, guests, valid }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('');
  const [pix, setPix] = useState(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const booking = useRef(null);
  useEffect(() => {
    let active = true;
    api.get('/payments/config').then(({ data }) => {
      if (active) { setEnabled(data.enabled && data.test_mode); setProvider(data.provider); }
    }).catch(() => {});
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
    setBusy(true);
    setError('');
    const selection = JSON.stringify([propertyId, start, end, guests]);
    try {
      if (booking.current?.selection !== selection) {
        const { data } = await api.post('/bookings', { property_id: propertyId, check_in: start, check_out: end, guests: Number(guests) });
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
  if (!enabled) return null;
  return <div className="test-checkout">
    {!pix && <Button type="button" variant="outline" className="test-checkout-button" disabled={!valid || busy} onClick={checkout}>
      {busy ? 'Preparando pagamento…' : provider === 'coldpay' ? 'Testar pagamento com PIX' : 'Testar pagamento com cartão'}
    </Button>}
    <p className="helper-text">Ambiente de teste. Sem cobrança real.</p>
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
