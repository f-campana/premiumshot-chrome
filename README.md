# PremiumShot for Chrome

Capture a visible Chrome tab, select a page element, or draw an area; apply a look and copy or download the finished image. Rendering and the temporary capture transfer stay on your device. This repository contains the standalone Chrome extension and its prepared Web Store listing.

The current candidate is **0.2.0**. It is a beta candidate; a public store listing is not established by this repository. The companion Mac app is maintained separately in [premiumshot-mac](https://github.com/f-campana/premiumshot-mac). Both are part of PremiumShot.

## Try it locally

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked** and select the `chrome-extension/` folder. Pin the extension, open a webpage and use its toolbar popup. The selection tools work on ordinary HTTP(S) pages; Chrome restricts scripting on certain internal and store pages.

## Development

Requires Node.js 24 and npm, plus Python 3.10 or later with Pillow installed from `requirements-dev.txt`.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
npm ci --prefix chrome-extension
make check PYTHON=python
```

`make check` runs the 29 Node tests, validates the store kit and builds `out/PremiumShot-Chrome-beta-0.2.0.zip`. It verifies the upload against the accepted 0.2.0 SHA-256. Generated artifacts live in ignored `out/`; a store-kit archive is also generated for review. No upload or publication is performed.

`make parity` independently builds the development-only Mac `pshot` CLI from the exact Git commit in `scripts/mac-core-revision.txt`, in a temporary directory, and compares 60 layout cases. It requires macOS, Xcode, Swift 6.2 or later, and a local Git checkout of premiumshot-mac containing that commit. By default it looks in the sibling `../premium-shot-mac` directory; set `PSHOT_MAC_DIR` to another checkout. It does not use uncommitted Mac changes or modify the Mac checkout.

The previous experimental browser harness requires extra tooling and is not part of the automated check. Browser and visual acceptance must be recorded against a loaded extension; see [acceptance scope](docs/acceptance-0.2.0.md).

GitHub Actions is configured to run unit/package and pinned Mac parity jobs on pull requests and pushes to main. A version tag runs the checks and prepares a draft GitHub release with the upload ZIP. This workflow is configuration until it has run successfully on GitHub; Chrome Web Store upload and submission remain manual.

## Layout

- `chrome-extension/`: Manifest V3 extension, tests, and runtime assets.
- `chrome-web-store/`: listing draft, artwork, policy drafts and packaging script.
- `fixtures/`: synthetic inputs for Mac/browser layout parity.
- `scripts/`: candidate and pinned-reference verification.
- `docs/`: candidate provenance and outstanding release evidence.

The extension uses `activeTab`, `scripting`, `storage` and `clipboardWrite`. It has no blanket host permission. Captures pass temporarily through extension-origin IndexedDB and are deleted on consumption or cleanup; screenshots and style settings are handled locally.

MIT licensed; see [LICENSE](LICENSE).
