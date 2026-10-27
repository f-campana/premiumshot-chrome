#!/usr/bin/env python3
"""Validate local listing material and build distinct upload/submission archives."""

import hashlib
import json
import posixpath
from datetime import date
from pathlib import Path
import re
import zipfile

from PIL import Image

KIT = Path(__file__).resolve().parent
REPO = KIT.parent
EXT = REPO / "chrome-extension"
OUT = REPO / "out"
RUNTIME = [
    "manifest.json", "background.js", "picker.js", "popup.html", "popup.js",
    "editor.html", "editor.js", "render-worker.js", "styles.css", "README.md",
    "lib/appearance.js", "lib/capture.js", "lib/capture-store.js", "lib/inspect.js", "lib/renderer.js",
    "lib/zoom.js", "assets/example.png", "assets/icon-16.png",
    "assets/icon-48.png", "assets/icon-128.png",
]
DOCUMENTS = [
    "README.md", "listing.json", "listing-description.txt", "privacy-practices.md",
    "privacy-policy.md", "support.md", "reviewer-notes.txt", "submission-checklist.md", "validation.json",
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def archive(path, files):
    # Fixed timestamps/permissions produce the same archive from the same inputs.
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for name, source in sorted(files):
            entry = zipfile.ZipInfo(name, date_time=(2026, 10, 11, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            output.writestr(entry, source.read_bytes(), compresslevel=9)
    with zipfile.ZipFile(path) as output:
        assert output.testzip() is None, f"CRC failure: {path}"


def main():
    listing = json.loads((KIT / "listing.json").read_text())
    manifest = json.loads((EXT / "manifest.json").read_text())
    package = json.loads((EXT / "package.json").read_text())
    assert listing["name"] == manifest["name"]
    assert listing["short_description"] == manifest["description"]
    assert len(manifest["description"]) <= 132
    assert listing["version"] == manifest["version"] == package["version"]
    assert manifest["manifest_version"] == 3
    assert manifest["permissions"] == ["activeTab", "scripting", "storage", "clipboardWrite"]
    assert not manifest.get("host_permissions") and not manifest.get("optional_host_permissions")
    assert not manifest.get("commands")
    assert manifest["content_security_policy"]["extension_pages"] == "script-src 'self'; object-src 'none'; connect-src 'none'"
    assert 1 <= len(listing["screenshots"]) <= 5
    assert listing["whats_new"]

    validation = json.loads((KIT / "validation.json").read_text())
    assert validation["candidate"] == manifest["version"]
    assert validation["unit_tests"]["passed"] == 29
    assert validation["native_geometry"]["passed"] == 60
    assert validation["native_storage"]["pendingRecords"] == 0
    assert validation["large_image"]["pendingRecords"] == 0
    assert validation["large_image"]["bitmap"] == {"width": 10240, "height": 5760, "megapixels": 58.9824}
    assert validation["large_image"]["pngBytes"] > 8 * 1024 * 1024
    assert len(validation["exports"]) == 5
    assert all(item["changed_channels"] == 0 and item["byte_identical"] for item in validation["exports"])
    assert set(validation["source_sha256"]) == set(RUNTIME)
    for name in RUNTIME:
        assert validation["source_sha256"][name] == digest(EXT / name), f"Source changed since validation: {name}"
    assert (KIT / "source/fixture.html").read_bytes() == (EXT / "tests/fixture.html").read_bytes()

    references = []
    for name in RUNTIME:
        path = EXT / name
        if path.suffix not in {".js", ".html"}:
            continue
        source = path.read_text()
        relative = re.findall(r"from\s+['\"](\.[^'\"]+)['\"]", source)
        relative += re.findall(r"new URL\(['\"](\.[^'\"]+)['\"]", source)
        if path.suffix == ".html":
            relative += [ref for ref in re.findall(r'(?:src|href)=[\'"]([^\'"]+)[\'"]', source) if not ref.startswith("#")]
        for ref in relative:
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), ref))
            assert target in RUNTIME, f"Missing runtime reference: {name} -> {ref}"
            references.append({"from": name, "to": target})

    assets = [(entry["file"], (1280, 800)) for entry in listing["screenshots"]]
    assets += [(listing["small_promo"], (440, 280)), (listing["marquee_promo"], (1400, 560)), (listing["store_icon"], (128, 128))]
    image_checks = []
    for name, expected in assets:
        path = KIT / name
        with Image.open(path) as image:
            image.load()
            assert image.size == expected, f"Wrong dimensions: {name} {image.size}"
            assert image.format in {"JPEG", "PNG"}, f"Wrong encoding: {name}"
            assert (path.suffix == ".jpg" and image.format == "JPEG") or (path.suffix == ".png" and image.format == "PNG")
            check = {"file": name, "size": list(image.size), "format": image.format, "mode": image.mode, "bytes": path.stat().st_size, "sha256": digest(path)}
            if name == listing["store_icon"]:
                assert image.mode == "RGBA"
                check["alpha_bounds"] = list(image.getchannel("A").getbbox())
                assert check["alpha_bounds"] == [16, 16, 112, 112]
                assert path.read_bytes() == (EXT / "assets/icon-128.png").read_bytes()
            image_checks.append(check)

    OUT.mkdir(exist_ok=True)
    upload = OUT / f"PremiumShot-Chrome-beta-{manifest['version']}.zip"
    archive(upload, [(name, EXT / name) for name in RUNTIME])
    with zipfile.ZipFile(upload) as zipped:
        assert set(zipped.namelist()) == set(RUNTIME)
        assert json.loads(zipped.read("manifest.json")) == manifest
        for name in RUNTIME:
            assert zipped.read(name) == (EXT / name).read_bytes()
        for path in [manifest["background"]["service_worker"], manifest["action"]["default_popup"], *manifest["icons"].values()]:
            assert path in zipped.namelist(), f"Missing manifest asset: {path}"

    prior = OUT / "PremiumShot-Chrome-beta-0.1.4.zip"
    unchanged = None
    if prior.exists():
        with zipfile.ZipFile(prior) as zipped:
            changed = [name for name in RUNTIME if name not in zipped.namelist() or zipped.read(name) != (EXT / name).read_bytes()]
        assert set(changed) == {"manifest.json", "background.js", "editor.js", "lib/capture-store.js", "README.md"}, changed
        unchanged = {"baseline": prior.name, "changed_files": changed, "runtime_code_unchanged": False, "composition_picker_popup_and_appearance_unchanged": True}

    checks = {
        "candidate": manifest["version"], "checked_on": date.today().isoformat(),
        "short_description_characters": len(manifest["description"]),
        "assets": image_checks, "baseline_comparison": unchanged, "module_and_page_references": references,
        "upload": {"file": upload.name, "bytes": upload.stat().st_size, "sha256": digest(upload), "files": RUNTIME, "file_count": len(RUNTIME), "root_manifest": True, "crc": "pass"},
        "live_store_status": "Not created, uploaded or submitted.",
        "public_urls_status": listing["urls_status"],
        "validation": "validation.json",
        "verification_limits": ["Native 0.2.0 acceptance was partially recorded on 20 October; restart and final console cases remained open in the last detailed handoff. Physical 5K coverage is synthetic.", "The store picker screenshot is the packaged frontend over a synthetic page with an artwork-only messaging adapter.", "The recorded validation data is historical; this packaging run does not repeat native-browser or physical-display acceptance.", "Publisher privacy certifications and live category wording are pending.", "Privacy/support copy needs confirmed contact, publisher and effective date before publication."],
    }
    (KIT / "checks.json").write_text(json.dumps(checks, indent=2) + "\n")
    sums = [(digest(upload), f"upload/{upload.name}"), *[(digest(KIT / name), name) for name, _ in assets]]
    (KIT / "SHA256SUMS").write_text("".join(f"{value}  {name}\n" for value, name in sums))
    bundle = OUT / f"PremiumShot-Chrome-store-kit-{manifest['version']}.zip"
    files = [(name, KIT / name) for name in DOCUMENTS + ["checks.json", "SHA256SUMS", "prepare.py"]]
    files += [(name, KIT / name) for name, _ in assets]
    files += [("source/promo.html", KIT / "source/promo.html"), ("source/dawn.png", KIT / "source/dawn.png"), ("source/icon-artwork.png", KIT / "source/icon-artwork.png")]
    files += [(f"source/{name}", KIT / f"source/{name}") for name in ["capture-popup.html", "capture-picker.html", "capture-picker.js", "fixture.html"]]
    files += [(f"upload/{upload.name}", upload)]
    archive(bundle, files)
    print(json.dumps({"upload": str(upload), "upload_sha256": digest(upload), "kit": str(bundle), "kit_sha256": digest(bundle), "asset_count": len(assets), "runtime_files": len(RUNTIME), "checks": str(KIT / "checks.json")}, indent=2))


if __name__ == "__main__":
    main()
