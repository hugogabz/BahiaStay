import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from booking_price import price_booking


class BookingPrice(unittest.TestCase):
    def setUp(self):
        self.property = {'pricePerNight': 100, 'weeklyPackagePromo': 600, 'guests': 4}

    def test_crossing_new_year_season_prices_only_occupied_nights(self):
        self.assertEqual(price_booking(self.property, '2030-12-19', '2030-12-22', 2), 380)

    def test_july_weekly_discount_and_season_both_apply(self):
        self.assertEqual(price_booking(self.property, '2030-07-01', '2030-07-08', 2), 740)

    def test_reserved_checkout_date_can_be_next_arrival(self):
        self.property['unavailableDates'] = [{'check_in': '2030-06-01', 'check_out': '2030-06-03'}]
        self.assertEqual(price_booking(self.property, '2030-06-03', '2030-06-04', 1), 100)

    def test_unavailable_night_and_excess_guests_are_rejected(self):
        self.property['unavailableDates'] = [{'check_in': '2030-06-01', 'check_out': '2030-06-03'}]
        with self.assertRaises(ValueError):
            price_booking(self.property, '2030-06-02', '2030-06-04', 1)
        with self.assertRaises(ValueError):
            price_booking(self.property, '2030-06-04', '2030-06-05', 5)

    def test_invalid_dates_are_rejected(self):
        with self.assertRaises(ValueError):
            price_booking(self.property, '2030-02-30', '2030-03-02', 1)


if __name__ == '__main__':
    unittest.main()
