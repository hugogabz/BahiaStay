import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import ReservationEstimate from './ReservationEstimate';
import { api } from '../lib/api';
jest.mock('react-day-picker', () => ({DayPicker: ({onSelect}) => <div data-testid="stay-calendar-control"><button onClick={() => onSelect({from:new Date('2030-10-20T00:00:00')},new Date('2030-10-20T00:00:00'))}>Selecionar entrada</button><button onClick={() => onSelect({from:new Date('2030-10-20T00:00:00'),to:new Date('2030-10-22T00:00:00')},new Date('2030-10-22T00:00:00'))}>Selecionar saída</button></div>}));
jest.mock('date-fns/locale', () => ({ptBR:{}}));
jest.mock('../lib/api', () => ({api: {get: jest.fn().mockResolvedValue({data: {enabled: false, test_mode: true}})}}));

let container, root;
const property = {title:'Casa teste', guests:4, pricePerNight:300, unavailableDates:[{check_in:'2030-10-15',check_out:'2030-10-19'}]};
beforeEach(() => {api.get.mockResolvedValue({data: {enabled: false, test_mode: true}});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(() => {act(() => root.unmount());container.remove();});
const renderStay = async search => act(async () => root.render(<MemoryRouter initialEntries={['/casa/teste?'+search]}><ReservationEstimate property={property}/></MemoryRouter>));

test('an unconfirmed nightly rate shows consultation instead of a zero-price reservation', async () => {
  await act(async () => root.render(<MemoryRouter initialEntries={['/casa/teste?entrada=2030-10-20&saida=2030-10-22']}><ReservationEstimate property={{...property, pricePerNight:0}}/></MemoryRouter>));
  expect(container.querySelector('.reservation-price').textContent).toContain('Consultar valor');
  expect(container.querySelector('[data-testid=booking-total]')).toBeNull();
  expect(container.querySelector('.estimate-breakdown').textContent).toContain('Confirme o valor');
});

test('a range spanning occupied nights has no price or reserved dates in its contact link', async () => {
  await renderStay('entrada=2030-10-14&saida=2030-10-20');
  expect(container.querySelector('[role=alert]').textContent).toContain('já reservadas');
  expect(container.querySelector('[data-testid=booking-total]')).toBeNull();
  expect(container.querySelector('.reservation-contact').href).not.toContain('Per%C3%ADodo');
});

test('arrival on a previous reservation checkout is allowed', async () => {
  await renderStay('entrada=2030-10-19&saida=2030-10-21');
  expect(container.querySelector('[role=alert]')).toBeNull();
  expect(container.querySelector('[data-testid=booking-total]').textContent).toContain('600,00');
});

test('a mixed season stay shows the surcharge separately and the correct total', async () => {
  await renderStay('entrada=2030-12-19&saida=2030-12-22');
  expect(container.querySelector('[data-testid=booking-total]').textContent).toContain('1.140,00');
  expect(container.querySelector('.estimate-breakdown').textContent).toContain('Réveillon e verão +40%2 noites');
  expect(container.querySelector('.estimate-breakdown').textContent).toContain('240,00');
});

test('one calendar handles entry, checkout and clearing without duplicate date inputs', async () => {
  await renderStay('');
  expect(container.querySelectorAll('input[type=date]')).toHaveLength(0);
  expect(container.querySelectorAll('[data-testid=stay-calendar-control]')).toHaveLength(1);
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Selecionar entrada').click());
  expect(container.querySelector('[role=alert]')).toBeNull();
  expect(container.textContent).toContain('Agora selecione a saída');
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Selecionar saída').click());
  expect(container.querySelector('[data-testid=booking-total]').textContent).toContain('600,00');
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Limpar datas').click());
  expect(container.querySelector('[data-testid=booking-total]')).toBeNull();
});
