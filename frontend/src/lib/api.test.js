import { api } from './api';

afterEach(() => localStorage.clear());

test('legacy stored tokens are never sent as an Authorization header', () => {
  localStorage.setItem('bahiastay_token', 'legacy-token');
  const request = api.interceptors.request.handlers[0].fulfilled({ method: 'get', headers: {} });
  expect(request.headers.Authorization).toBeUndefined();
  expect(api.defaults.withCredentials).toBe(true);
});

test('write requests carry the custom CSRF protection header', () => {
  for (const method of ['post', 'put', 'patch', 'delete']) {
    const request = api.interceptors.request.handlers[0].fulfilled({ method, headers: {} });
    expect(request.headers['X-CSRF-Protection']).toBe('1');
  }
});
