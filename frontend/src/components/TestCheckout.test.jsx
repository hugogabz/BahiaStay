import { act } from 'react';
import { createRoot } from 'react-dom/client';
import TestCheckout from './TestCheckout';
import { api } from '../lib/api';
jest.mock('../lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

let container, root;
beforeEach(() => {
  api.get.mockResolvedValue({ data: { enabled: true, provider: 'coldpay', test_mode: true } });
  api.post.mockImplementation(path => Promise.resolve({ data: path === '/bookings'
    ? { id: 'example' } : { provider: 'coldpay', test_mode: true, session_id: 'cp_example', copy_paste: 'PIX-EXEMPLO', qr_code: 'data:image/png;base64,ZXhhbXBsZQ==' } }));
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.useRealTimers(); });
const render = async (withContact = true) => {
  await act(async () => root.render(<TestCheckout propertyId="example" start="2030-11-20" end="2030-11-22" guests={2} valid />));
  if (withContact) for (const [id, value] of [['checkout-name', 'Pessoa de teste'], ['checkout-email', 'teste@example.com']]) {
    const input = container.querySelector('#' + id);
    if (input) await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
};

test('checkout needs guest identification and attaches it to the reservation', async () => {
  await render(false);
  expect(container.querySelector('button').disabled).toBe(true);
  await render();
  await act(async () => container.querySelector('button').click());
  expect(api.post.mock.calls.find(([path]) => path === '/bookings')[1]).toMatchObject({guest_name:'Pessoa de teste',guest_contact:'teste@example.com'});
});

test('unconfigured checkout stays visible and disabled without creating a booking', async () => {
  api.get.mockResolvedValue({ data: { enabled: false, provider: 'coldpay', test_mode: true } });
  await render();
  expect(container.querySelector('button').disabled).toBe(true);
  expect(container.textContent).toContain('O pagamento online ainda não está disponível');
  await act(async () => container.querySelector('button').click());
  expect(api.post).not.toHaveBeenCalled();
});

test('PIX renders QR and code, then waits for paid status before confirmation', async () => {
  jest.useFakeTimers();
  await render();
  await act(async () => container.querySelector('button').click());
  expect(container.querySelector('textarea').value).toBe('PIX-EXEMPLO');
  expect(container.querySelector('img').alt).toContain('teste');
  expect(container.querySelector('[role=status]').textContent).toContain('Aguardando');
  api.get.mockResolvedValue({ data: { payment_status: 'paid' } });
  await act(async () => jest.advanceTimersByTime(15000));
  expect(container.querySelector('[role=status]').textContent).toContain('confirmado');
  expect(container.querySelector('img')).toBeNull();
});

test('failed checkout retry reuses the reservation', async () => {
  api.post.mockResolvedValueOnce({ data: { id: 'example' } }).mockRejectedValueOnce(new Error('timeout'));
  await render();
  await act(async () => container.querySelector('button').click());
  expect(container.querySelector('[role=alert]')).not.toBeNull();
  await act(async () => container.querySelector('button').click());
  expect(api.post.mock.calls.filter(([path]) => path === '/bookings')).toHaveLength(1);
});
