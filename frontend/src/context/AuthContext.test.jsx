import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '../lib/api';
jest.mock('../lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

let root, container, auth;
function Probe() { auth = useAuth(); return <output>{auth.user?.email || 'guest'}</output>; }
beforeEach(() => {
  localStorage.clear();
  api.get.mockResolvedValue({ data: { email: 'admin' } });
  api.post.mockResolvedValue({ data: { user: { email: 'admin' } } });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); });

test('restores a cookie session without any token in localStorage', async () => {
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
  expect(api.get).toHaveBeenCalledWith('/auth/me');
  expect(auth.user.email).toBe('admin');
});

test('removes legacy tokens and never stores login credentials', async () => {
  localStorage.setItem('bahiastay_token', 'old-token');
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
  api.post.mockResolvedValueOnce({ data: { user: { email: 'admin' }, access_token: 'must-not-be-stored' } });
  await act(async () => auth.login('admin', 'example'));
  expect(localStorage.getItem('bahiastay_token')).toBeNull();
});

test('does not pretend to log out if the server cannot clear the session', async () => {
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
  api.post.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await expect(auth.logout()).rejects.toThrow('offline'); });
  expect(auth.user.email).toBe('admin');
  api.post.mockResolvedValueOnce({ data: { ok: true } });
  await act(async () => auth.logout());
  expect(auth.user).toBeNull();
});
