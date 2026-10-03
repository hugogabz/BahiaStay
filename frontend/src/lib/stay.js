export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export function dateError(start, end, today = localDate()) {
  if (!start && !end) return '';
  if (!start || !end) return 'Informe a entrada e a saída.';
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!valid(start) || !valid(end)) return 'Informe datas válidas.';
  if (start < today) return 'A entrada não pode ser no passado.';
  if (end <= start) return 'A saída deve ser depois da entrada.';
  return '';
}

export const DEFAULT_SEASONAL_PRICING = {newYearPercent:40, julyPercent:20};

export function seasonForDate(date, pricing = {}) {
  const monthDay = date.slice(5);
  const rates = {...DEFAULT_SEASONAL_PRICING, ...pricing};
  const rule = monthDay >= '12-20' || monthDay <= '01-10'
    ? {label:'Réveillon e verão', percent:Number(rates.newYearPercent)}
    : monthDay >= '07-01' && monthDay <= '07-31'
      ? {label:'Férias de julho', percent:Number(rates.julyPercent)} : null;
  return rule && rule.percent > 0 ? rule : null;
}

export function quoteStay(property, start, end) {
  const nights = start && end ? Math.max(0, Math.round((Date.parse(end)-Date.parse(start))/86400000)) || 0 : 0;
  const price = Number(property.pricePerNight) || 0;
  const baseTotal = nights * price;
  const seasonalPeriods = [];
  const round = value => Math.round(value * 100) / 100;
  for (let i = 0; i < nights; i++) {
    const date = new Date(Date.parse(start) + i * 86400000).toISOString().slice(0,10);
    const season = seasonForDate(date, property.seasonalPricing);
    if (!season) continue;
    let period = seasonalPeriods.find(p => p.label === season.label);
    if (!period) {period = {...season, nights:0, extra:0}; seasonalPeriods.push(period);}
    period.nights++;
    period.extra = round(period.extra + round(price * season.percent / 100));
  }
  const seasonalExtra = round(seasonalPeriods.reduce((sum, p) => sum + p.extra, 0));
  const nightlyTotal = round(baseTotal + seasonalExtra);
  const weekly = Number(property.weeklyPackagePromo);
  const weeklyApplied = nights >= 7 && weekly > 0 && weekly < price * 7;
  const total = round((weeklyApplied ? weekly + (nights-7)*price : baseTotal) + seasonalExtra);
  return {nights, baseTotal, nightlyTotal, seasonalExtra, seasonalPeriods, total, weeklyApplied};
}

export const overlapsStay = (start, end, bookings) => Boolean(start && end && bookings.some(b => start < b.check_out && end > b.check_in));
