import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { api } from '../lib/api';
jest.mock('../lib/api',()=>({api:{get:jest.fn()},fileUrl:v=>v}));
let container,root;
beforeEach(()=>{container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);jest.clearAllMocks();});
afterEach(()=>{act(()=>root.unmount());container.remove();});
test('catalog load failure is distinct from empty results, and retry recovers',async()=>{
 api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({data:[]});
 await act(async()=>root.render(<MemoryRouter><Home/></MemoryRouter>));
 expect(Array.from(container.querySelectorAll('a')).some(link=>link.getAttribute('href')?.startsWith('/admin'))).toBe(false);
 expect(container.querySelector('[role=alert]').textContent).toContain('Não foi possível carregar as casas');
 expect(container.textContent).not.toContain('Nenhuma casa atende');
 await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Tentar novamente').click());
 expect(container.querySelector('[role=status]').textContent).toContain('Nenhuma casa atende');
 expect(container.querySelector('[role=alert]')).toBeNull();
});

test('date search excludes occupied nights and keeps checkout-day arrivals', async () => {
 const base={title:'Casa teste',destination:'salvador',neighborhood:'Praia',guests:4,bedrooms:2,pricePerNight:300,images:[]};
 api.get.mockResolvedValue({data:[{...base,id:'occupied',unavailableDates:[{check_in:'2030-10-15',check_out:'2030-10-19'}]},{...base,id:'released',bookedDates:[{check_in:'2030-10-10',check_out:'2030-10-14'}]}]});
 await act(async()=>root.render(<MemoryRouter initialEntries={['/?entrada=2030-10-14&saida=2030-10-20']}><Home/></MemoryRouter>));
 expect(container.querySelector('[data-testid=results-count]').textContent).toBe('1 casa encontrada');
 expect(container.querySelector('.property-card h3 a').href).toContain('/casa/released');
});

test('a maximum-price filter does not treat an unconfirmed rate as free', async () => {
 const base={title:'Casa real',destination:'salvador',neighborhood:'Praia',guests:4,bedrooms:2,images:[]};
 api.get.mockResolvedValue({data:[{...base,id:'unknown',pricePerNight:0},{...base,id:'priced',pricePerNight:300}]});
 await act(async()=>root.render(<MemoryRouter initialEntries={['/?max=400']}><Home/></MemoryRouter>));
 expect(container.querySelector('[data-testid=results-count]').textContent).toBe('1 casa encontrada');
 expect(container.querySelector('.property-card h3 a').href).toContain('/casa/priced');
});
