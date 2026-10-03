from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP


def price_booking(property, check_in, check_out, guests, reservations=()):
    start, end = date.fromisoformat(check_in), date.fromisoformat(check_out)
    nights = (end - start).days
    if start < date.today() or not 1 <= nights <= 365:
        raise ValueError('Escolha uma estadia futura entre 1 e 365 noites.')
    if not 1 <= guests <= int(property['guests']):
        raise ValueError('Quantidade de hóspedes inválida.')
    blocked = [*(property.get('unavailableDates') or []), *reservations]
    if any(check_in < period['check_out'] and check_out > period['check_in'] for period in blocked):
        raise ValueError('Este período já está reservado.')
    nightly = Decimal(str(property['pricePerNight']))
    weekly = Decimal(str(property.get('weeklyPackagePromo') or 0))
    if not nightly.is_finite() or nightly <= 0:
        raise ValueError('Diária inválida.')
    rates = {'newYearPercent': 40, 'julyPercent': 20, **(property.get('seasonalPricing') or {})}
    total = weekly + nightly * (nights - 7) if nights >= 7 and 0 < weekly < nightly * 7 else nightly * nights
    for offset in range(nights):
        month_day = (start + timedelta(days=offset)).strftime('%m-%d')
        percent = rates['newYearPercent'] if month_day >= '12-20' or month_day <= '01-10' else rates['julyPercent'] if month_day.startswith('07-') else 0
        total += (nightly * Decimal(str(percent)) / 100).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
    return float(total.quantize(Decimal('.01'), rounding=ROUND_HALF_UP))
