import { dateError, quoteStay, overlapsStay, seasonForDate } from './stay';

test('rejects partial, same-day, reversed and past stays', () => {
  expect(dateError('2026-10-10', '', '2026-10-02')).toBeTruthy();
  expect(dateError('2026-10-10', '2026-10-10', '2026-10-02')).toBeTruthy();
  expect(dateError('2026-10-12', '2026-10-10', '2026-10-02')).toBeTruthy();
  expect(dateError('2026-10-01', '2026-10-10', '2026-10-02')).toBeTruthy();
  expect(dateError('', '', '2026-10-02')).toBe('');
  expect(dateError('2026-10-10', '2026-10-12', '2026-10-02')).toBe('');
});
test('counts nights across months and uses only a configured cheaper weekly rate', () => {
  expect(quoteStay({pricePerNight: 300}, '2026-10-30', '2026-11-02')).toMatchObject({nights:3, nightlyTotal:900, total:900, weeklyApplied:false});
  expect(quoteStay({pricePerNight:300,weeklyPackagePromo:1800}, '2026-10-10', '2026-10-18').total).toBe(2100);
  expect(quoteStay({pricePerNight:300,weeklyPackagePromo:2500}, '2026-10-10', '2026-10-17').total).toBe(2100);
  expect(quoteStay({pricePerNight:300}, '', '').total).toBe(0);
});

test('charges only occupied peak-season nights and excludes checkout', () => {
  expect(quoteStay({pricePerNight:300}, '2026-12-19', '2026-12-22')).toMatchObject({nights:3, baseTotal:900, seasonalExtra:240, total:1140});
  expect(quoteStay({pricePerNight:300}, '2027-01-10', '2027-01-12')).toMatchObject({seasonalExtra:120, total:720});
  expect(quoteStay({pricePerNight:300}, '2027-07-01', '2027-07-03').total).toBe(720);
});

test('weekly discounts retain all peak-season surcharges', () => {
  expect(quoteStay({pricePerNight:300,weeklyPackagePromo:1800}, '2026-12-28', '2027-01-04')).toMatchObject({nightlyTotal:2940, seasonalExtra:840, total:2640, weeklyApplied:true});
});

test('supports per-property percentages, explicit zero, and seasonal boundaries', () => {
  expect(quoteStay({pricePerNight:300,seasonalPricing:{newYearPercent:50,julyPercent:0}},'2026-12-31','2027-01-02').total).toBe(900);
  expect(seasonForDate('2027-07-04',{julyPercent:0})).toBeNull();
  expect(seasonForDate('2026-12-20').percent).toBe(40);
  expect(seasonForDate('2027-01-11')).toBeNull();
});
test('blocks nights inside a reservation but allows checkout on its arrival day', () => {
  const booked = [{check_in:'2026-10-12',check_out:'2026-10-15'}];
  expect(overlapsStay('2026-10-10','2026-10-12',booked)).toBe(false);
  expect(overlapsStay('2026-10-10','2026-10-16',booked)).toBe(true);
  expect(overlapsStay('2026-10-15','2026-10-17',booked)).toBe(false);
});
