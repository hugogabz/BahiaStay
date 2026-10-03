import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import { api } from '../lib/api';

jest.mock('../lib/api', () => ({ api: { get: jest.fn() } }));

test('does not present a failed admin summary as zero bookings and allows recovery', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  document.body.appendChild(container);
  api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [] });
  try {
    await act(async () => root.render(<MemoryRouter><AdminDashboard /></MemoryRouter>));
    expect(container.querySelector('[role="alert"]').textContent).toContain('números estão indisponíveis');
    expect(container.querySelector('[aria-busy]').textContent).not.toContain('0');
    api.get.mockResolvedValueOnce({ data: [{ id: 'casa-1' }] }).mockResolvedValueOnce({ data: [{ status: 'approved' }] });
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Tentar novamente').click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[aria-busy]').textContent).toContain('Casas cadastradas1');
    expect(container.querySelector('[aria-busy]').textContent).toContain('Reservas aprovadas1');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
