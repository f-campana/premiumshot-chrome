#!/usr/bin/env python3
"""Verify that extraction reproduces the accepted 0.2.0 upload exactly."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
version = json.loads((root / "chrome-extension/manifest.json").read_text())["version"]
if version != "0.2.0":
    raise SystemExit("Update the candidate checksum and validation for the new version.")
archive = root / "out" / f"PremiumShot-Chrome-beta-{version}.zip"
actual = hashlib.sha256(archive.read_bytes()).hexdigest()
expected = "7e1c2f4bb9c7223cb7f677dc5a683a69dcd6e40ac2a9796314133dc4afa9b5ae"
if actual != expected:
    raise SystemExit(f"Candidate ZIP differs from the accepted 0.2.0 artifact: {actual}")
print(f"PASS unchanged 0.2.0 upload ZIP SHA-256 {actual}")
