import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToPage from './ScrollToPage';

let container, root;
function Location() {
  const location = useLocation();
  return <output>{location.pathname}{location.search}{location.hash}</output>;
}
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  window.scrollTo = jest.fn();
  window.matchMedia = jest.fn(() => ({ matches: false }));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

test('home logo scrolls smoothly without clearing search filters', () => {
  act(() => root.render(<MemoryRouter initialEntries={['/?destino=salvador']}><Navbar /><Location /></MemoryRouter>));
  act(() => container.querySelector('[data-testid=navbar-brand-logo]').click());
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
  expect(container.querySelector('output').textContent).toBe('/?destino=salvador');
});

test('home logo respects the reduced-motion preference', () => {
  window.matchMedia.mockReturnValue({ matches: true });
  act(() => root.render(<MemoryRouter><Navbar /></MemoryRouter>));
  act(() => container.querySelector('[data-testid=navbar-brand-logo]').click());
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
});

test('logo on a property page opens the home page', () => {
  act(() => root.render(<MemoryRouter initialEntries={['/casa/test']}><Navbar /><Location /></MemoryRouter>));
  act(() => container.querySelector('[data-testid=navbar-brand-logo]').click());
  expect(container.querySelector('output').textContent).toBe('/');
});

test('logo clears the section anchor smoothly and keeps the selected destination', () => {
  act(() => root.render(<MemoryRouter initialEntries={['/?destino=salvador#como-funciona']}>
    <Navbar /><Location /><ScrollToPage />
  </MemoryRouter>));
  window.scrollTo.mockClear();
  act(() => container.querySelector('[data-testid=navbar-brand-logo]').click());
  expect(container.querySelector('output').textContent).toBe('/?destino=salvador');
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
});

test('footer logo also returns to the top', () => {
  act(() => root.render(<MemoryRouter><Footer /></MemoryRouter>));
  act(() => container.querySelector('[data-testid=footer-brand-logo]').click());
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
});

test('modified logo clicks retain native new-tab behavior', () => {
  act(() => root.render(<MemoryRouter initialEntries={['/?destino=salvador']}><Navbar /><Location /></MemoryRouter>));
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
  act(() => container.querySelector('[data-testid=navbar-brand-logo]').dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(container.querySelector('output').textContent).toBe('/?destino=salvador');
});
