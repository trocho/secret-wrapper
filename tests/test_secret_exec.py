import importlib.util
from pathlib import Path
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).parents[1] / "skills/secret-process-wrapper/scripts/secret_exec.py"
SPEC = importlib.util.spec_from_file_location("secret_exec", SCRIPT)
secret_exec = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(secret_exec)


class SecretProviderTests(unittest.TestCase):
    def test_macos_keychain_uses_service_and_account(self):
        args = SimpleNamespace(service="service", account="account")
        with patch.object(secret_exec.subprocess, "check_output", return_value="token\n") as call:
            self.assertEqual(secret_exec.secret_from_macos_keychain(args), "token")
        self.assertEqual(call.call_args.args[0][-5:], ["-s", "service", "-a", "account", "-w"])

    def test_bitwarden_requires_item(self):
        with self.assertRaisesRegex(ValueError, "requires --item"):
            secret_exec.secret_from_bitwarden(SimpleNamespace(item=None))

    def test_windows_target_is_escaped(self):
        args = SimpleNamespace(target="a'b")
        with patch.object(secret_exec.subprocess, "check_output", return_value="token\r\n") as call:
            self.assertEqual(secret_exec.secret_from_windows_credential_manager(args), "token")
        self.assertIn("a''b", call.call_args.args[0][-1])

    def test_provider_failure_maps_to_exit_78(self):
        args = SimpleNamespace(service="s", account="a")
        with patch.object(secret_exec.subprocess, "check_output", side_effect=subprocess.CalledProcessError(1, "security")):
            with self.assertRaises(subprocess.CalledProcessError):
                secret_exec.secret_from_macos_keychain(args)


if __name__ == "__main__":
    unittest.main()
