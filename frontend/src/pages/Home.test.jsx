import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Home from './Home';
import { api } from '../lib/api';
jest.mock('../lib/api',()=>({api:{get:jest.fn()},fileUrl:v=>v}));
let container,root;
beforeEach(()=>{localStorage.clear();container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);jest.clearAllMocks();});
afterEach(()=>{act(()=>root.unmount());container.remove();localStorage.clear();});

test('catalogue reveals more houses without losing filters or duplicating results', async () => {
 const base={title:'Casa teste',destination:'salvador',neighborhood:'Praia',guests:4,bedrooms:2,pricePerNight:300,images:[]};
 api.get.mockResolvedValue({data:Array.from({length:25},(_,i)=>({...base,id:`home-${i}`}))});
 await act(async()=>root.render(<MemoryRouter><Home/></MemoryRouter>));
 expect(container.querySelectorAll('.property-card')).toHaveLength(12);
 await act(async()=>container.querySelector('[data-testid=show-more-houses]').click());
 expect(container.querySelectorAll('.property-card')).toHaveLength(24);
 await act(async()=>container.querySelector('[data-testid=show-more-houses]').click());
 expect(container.querySelectorAll('.property-card')).toHaveLength(25);
 expect(container.querySelector('[data-testid=show-more-houses]')).toBeNull();
});
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

test('saved houses view lists favorites and immediately removes unliked houses', async () => {
 const base={title:'Casa teste',destination:'salvador',neighborhood:'Praia',guests:4,bedrooms:2,pricePerNight:300,images:[]};
 localStorage.setItem('bahiastay_favorites',JSON.stringify(['saved']));
 api.get.mockResolvedValue({data:[{...base,id:'saved'},{...base,id:'other'}]});
 await act(async()=>root.render(<MemoryRouter initialEntries={['/?salvas=1']}><Home/></MemoryRouter>));
 expect(container.querySelectorAll('.property-card')).toHaveLength(1);
 expect(container.querySelector('.property-card h3 a').href).toContain('/casa/saved');
 await act(async()=>container.querySelector('.favorite-button').click());
 expect(container.querySelectorAll('.property-card')).toHaveLength(0);
 expect(container.textContent).toContain('Você ainda não salvou nenhuma casa');
 expect(JSON.parse(localStorage.getItem('bahiastay_favorites'))).toEqual([]);
});

test('clearing filters keeps the saved view and restores other saved matches', async () => {
 const base={title:'Casa teste',neighborhood:'Praia',guests:4,bedrooms:2,pricePerNight:300,images:[]};
 localStorage.setItem('bahiastay_favorites',JSON.stringify(['one','two']));
 api.get.mockResolvedValue({data:[{...base,id:'one',destination:'salvador'},{...base,id:'two',destination:'ilheus'},{...base,id:'other',destination:'salvador'}]});
 await act(async()=>root.render(<MemoryRouter initialEntries={['/?salvas=1&destino=salvador']}><Home/></MemoryRouter>));
 expect(container.querySelectorAll('.property-card')).toHaveLength(1);
 await act(async()=>container.querySelector('[data-testid=filter-clear-btn]').click());
 expect(container.querySelectorAll('.property-card')).toHaveLength(2);
 expect(container.querySelector('[data-testid=saved-houses-toggle]').getAttribute('aria-pressed')).toBe('true');
});

test('saved control updates as houses are liked and works without a login', async () => {
 api.get.mockResolvedValue({data:[{id:'one',title:'Casa teste',destination:'salvador',guests:4,bedrooms:2,pricePerNight:300,images:[]}]});
 await act(async()=>root.render(<MemoryRouter><Home/></MemoryRouter>));
 expect(container.querySelector('[data-testid=saved-houses-toggle]').textContent).toContain('0');
 await act(async()=>container.querySelector('.favorite-button').click());
 expect(container.querySelector('[data-testid=saved-houses-toggle]').textContent).toContain('1');
 await act(async()=>container.querySelector('[data-testid=saved-houses-toggle]').click());
 expect(container.querySelector('[data-testid=saved-houses-toggle]').getAttribute('aria-pressed')).toBe('true');
 expect(container.querySelectorAll('.property-card')).toHaveLength(1);
});

test('switching catalogue views preserves the section anchor and active filters', async () => {
 function LocationProbe() { const location=useLocation();return <output data-testid="location">{location.search}{location.hash}</output>; }
 api.get.mockResolvedValue({data:[]});
 await act(async()=>root.render(<MemoryRouter initialEntries={['/?destino=salvador#destinos']}><Home/><LocationProbe/></MemoryRouter>));
 await act(async()=>container.querySelector('[data-testid=saved-houses-toggle]').click());
 expect(container.querySelector('[data-testid=location]').textContent).toBe('?destino=salvador&salvas=1#destinos');
});
