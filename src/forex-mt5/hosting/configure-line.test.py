import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('line_config', Path(__file__).with_name('configure-line.py'))
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
class ConfigurationTest(unittest.TestCase):
    def test_atomic_update_preserves_other_secrets_and_refuses_public_or_injected_input(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'pilot.env'
            original = 'APP_ORIGIN=https://example.com\nLINE_CHANNEL_ID=\nLINE_CHANNEL_SECRET=\nSESSION_SECRET=keep-fixture\n'
            path.write_text(original); path.chmod(0o600)
            for key, secret in [('12345\nOTHER=1','s'*32),('12345','s'*32+'\n')]:
                with self.assertRaises(ValueError): module.update_line_config(path,key,secret)
                self.assertEqual(path.read_text(),original)
            module.update_line_config(path,'1234567','s'*32)
            self.assertIn('SESSION_SECRET=keep-fixture',path.read_text())
            self.assertIn('LINE_CHANNEL_ID="1234567"',path.read_text())
            self.assertEqual(path.stat().st_mode & 0o777,0o600)
            before = path.read_text(); path.chmod(0o644)
            with self.assertRaises(ValueError): module.update_line_config(path,'1234567','n'*32)
            self.assertEqual(path.read_text(),before)
            alias = Path(directory)/'alias.env'; alias.symlink_to(path)
            with self.assertRaises(ValueError): module.update_line_config(alias,'1234567','n'*32)
if __name__ == '__main__': unittest.main()
