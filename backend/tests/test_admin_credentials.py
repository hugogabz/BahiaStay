import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from admin_credentials import credentials_match


class AdminCredentialTests(unittest.TestCase):
    def test_current_deployment_password_is_authoritative(self):
        with patch.dict('os.environ', {'ADMIN_EMAIL': 'Admin', 'ADMIN_PASSWORD': 'new-test-password'}):
            self.assertTrue(credentials_match('admin', 'new-test-password'))
            self.assertFalse(credentials_match('admin', 'old-test-password'))
            self.assertFalse(credentials_match('other', 'new-test-password'))

    def test_missing_configuration_fails_closed(self):
        with patch.dict('os.environ', {}, clear=True):
            self.assertFalse(credentials_match('', ''))

    def test_password_is_not_trimmed(self):
        with patch.dict('os.environ', {'ADMIN_EMAIL': 'Admin', 'ADMIN_PASSWORD': 'test-password'}):
            self.assertFalse(credentials_match('Admin', 'test-password '))
