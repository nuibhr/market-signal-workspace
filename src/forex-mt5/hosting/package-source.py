#!/usr/bin/env python3
"""Package tracked application source for a Hostinger Next.js preview, without local state."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[3]
TOP_FILES = {"package.json", "package-lock.json", "next.config.mjs"}
SOURCE_DIRS = {"src", "public", "scripts", "deploy"}
FORBIDDEN = {".git", ".wrangler", "node_modules", "data", "__pycache__", ".next", ".next-review"}
EXAMPLES = {
    "src/forex-mt5/hosting/customer.env.example",
    "src/forex-mt5/hosting/hostinger-preview.env.example",
}

def allowed(name):
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or any(part in FORBIDDEN for part in path.parts):
        return False
    if name not in TOP_FILES and path.parts[0] not in SOURCE_DIRS:
        return False
    base = path.name.lower()
    if name in EXAMPLES:
        return True
    return not (base.startswith(".env") or ".env" in base or
                base.endswith((".set", ".credentials.json")) or
                re.search(r"\.(?:sqlite3?|db)(?:-(?:wal|shm|journal))?$", base) or base.startswith("tunnel-token"))

def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 src/forex-mt5/hosting/package-source.py /absolute/output.zip")
    archive = Path(sys.argv[1])
    if not archive.is_absolute() or archive.suffix != ".zip" or ROOT in archive.parents:
        raise SystemExit("Choose an absolute .zip output path outside the checkout")
    names = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    dirty = subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT).strip()
    if dirty:
        raise SystemExit("Commit reviewed source before packaging")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip()
    paths = sorted(name for name in names if name and allowed(name))
    if any((ROOT / name).is_symlink() for name in paths):
        raise SystemExit("Refusing symlink source entries")
    archive.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(archive, "w", ZIP_DEFLATED) as output:
        for name in paths:
            output.write(ROOT / name, name)
    with ZipFile(archive) as output:
        if output.testzip() is not None or set(output.namelist()) != set(paths):
            raise SystemExit("Archive verification failed")
    print(json.dumps({"archive": str(archive), "commit": commit, "files": len(paths),
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "profile": "hostinger-node-preview", "contains_local_env_or_databases": False}))

if __name__ == "__main__":
    main()
