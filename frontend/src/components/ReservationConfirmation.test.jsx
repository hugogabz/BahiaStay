import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import ReservationConfirmation from './ReservationConfirmation';

const summary={booking_id:'reserva-123',check_in:'2030-12-21',check_out:'2030-12-25',nights:4,guests:2,amount:1848,email_address:'m***@example.com',email_status:'sent',property:{id:'casa-1',title:'Casa do Mar',description:'Casa perto da praia.',neighborhood:'Centro',destination:'arraial',bedrooms:2,beds:3,baths:2,amenities:['wifi'],photo:'https://example.com/casa.jpg'}};
let root,container;
beforeEach(()=>{container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
const render=(data)=>act(()=>root.render(<MemoryRouter><ReservationConfirmation confirmation={data}/></MemoryRouter>));

test('confirmed summary includes house, stay, amount and verified email status',()=>{
  render(summary);
  for(const value of ['Casa do Mar','21/12/2030','25/12/2030','4 noites','2 hóspedes','reserva-123','m***@example.com']) expect(container.textContent).toContain(value);
  expect(container.textContent).toContain('Enviamos');
  expect(container.querySelector('a[href="/casa/casa-1"]')).not.toBeNull();
});
test('unconfigured and failed email never claim a message was sent',()=>{
  for(const email_status of ['not_configured','failed','pending']){
    render({...summary,email_status});
    expect(container.textContent).not.toContain('Enviamos');
    expect(container.textContent).toContain('reserva-123');
  }
});
test('missing confirmation does not claim a reservation is approved',()=>{
  render(null);
  expect(container.textContent).not.toContain('Reserva confirmada');
  expect(container.textContent).toContain('Pagamento confirmado');
});
