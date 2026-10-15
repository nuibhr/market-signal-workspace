#!/usr/bin/env python3
"""Enter LINE configuration privately in the Hostinger VPS web console, never in chat."""
import getpass
import json
import os
import re
import sys
import tempfile
from pathlib import Path

CONFIG = Path('/etc/nugaom-forex/pilot.env')

def update_line_config(path, channel_id, channel_secret):
    if not re.fullmatch(r'[0-9]{4,30}', channel_id):
        raise ValueError('INVALID_CHANNEL_ID')
    if not re.fullmatch(r'[A-Za-z0-9_-]{16,200}', channel_secret):
        raise ValueError('INVALID_CHANNEL_SECRET')
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError('PRIVATE_ENV_REQUIRED')
    stat = path.stat()
    if stat.st_uid != os.geteuid() or stat.st_mode & 0o077:
        raise ValueError('PRIVATE_ENV_PERMISSIONS_REQUIRED')
    text = path.read_text()
    changes = {'LINE_CHANNEL_ID': channel_id, 'LINE_CHANNEL_SECRET': channel_secret}
    for key, value in changes.items():
        pattern = re.compile(r'^' + key + r'=.*$', re.M)
        if len(pattern.findall(text)) != 1:
            raise ValueError('ENV_FIELD_REQUIRES_REVIEW')
        text = pattern.sub(lambda _: key + '=' + json.dumps(value), text)
    fd, temporary = tempfile.mkstemp(prefix='.line-config-', dir=str(path.parent))
    try:
        with os.fdopen(fd, 'w') as target:
            target.write(text); target.flush(); os.fsync(target.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def main():
    if not sys.stdin.isatty():
        raise ValueError('USE_INTERACTIVE_VPS_WEB_CONSOLE')
    channel_id = input('LINE Login Channel ID: ').strip()
    secret = getpass.getpass('LINE Login Channel Secret (hidden): ').strip()
    confirmation = getpass.getpass('Confirm Channel Secret (hidden): ').strip()
    if secret != confirmation:
        raise ValueError('SECRET_CONFIRMATION_MISMATCH')
    update_line_config(CONFIG, channel_id, secret)
    print('LINE configuration saved privately. Tell Codex to restart the test website.')

if __name__ == '__main__':
    try: main()
    except (ValueError, OSError) as error:
        code = str(error) if isinstance(error, ValueError) else 'PRIVATE_CONFIG_UNAVAILABLE'
        print(code, file=sys.stderr); sys.exit(1)
