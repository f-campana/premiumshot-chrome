# PremiumShot for Chrome — beta candidate 0.2.0

A standalone Manifest V3 extension. Capture a visible tab, pick a visible DOM element, or draw an area; choose a look; copy or download a polished PNG. The Mac app is not required.

## Try it

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Click **Load unpacked** and select this `chrome-extension` folder (the folder containing `manifest.json`). If using the ZIP, extract it first and select the extracted folder containing `manifest.json`.
3. Pin **PremiumShot for Chrome** in Chrome's extension menu.
4. Open a normal webpage and click the extension. Choose **Select an element**, **Capture visible tab**, or **Select an area**.
5. In the element picker, hover, click to capture, or use **↑** to select a parent and **↓** to return to the child. **Enter** captures the highlighted element; **Esc** cancels. The area picker captures when you finish dragging.
6. The editor opens in a new tab. Choose Dawn, Tide, Paper, Graphite, or Clear; adjust Shape, Space, Corners, and Shadow; then **Copy image** or **Download PNG**.

Use **Back to page** to return to the source. Invoke the extension again for another capture. The editor also accepts pasted images, dropped PNG/JPEG/WebP files, or **Choose an image**. **Try an example** loads the repository's synthetic dashboard.

After source changes, click the extension's **Reload** button in `chrome://extensions` and refresh the source webpage. Existing editor tabs should be reopened.

## Inspect and keyboard controls

Click **Inspect**, or focus the preview and press **Space**, to inspect the completed output. **Fit** shows the whole image; **Actual size** maps one export pixel to one display pixel, accounting for the display scale and browser zoom. Inspect changes the viewing size, not the exported PNG.

- Scroll to zoom around the pointer; drag or use arrow keys to pan. Shift + arrow moves farther. Shift + scroll pans horizontally.
- **F** or **0** fits and recenters; **Z** or **1** selects Actual size; **+** / **−** zooms, up to 400%.
- **Done** or **Esc** returns to the editor and focuses Inspect. The modal keeps keyboard focus within its controls.
- In the empty editor, Tab reaches **Choose an image**; Enter or Space opens the file picker. In the loaded preview, Delete or Backspace removes the screenshot while keeping the style.

The loaded editor fits the available window height. Copy and Download stay visible while style controls scroll on smaller windows. Shape order and guidance follow Mac: Fit, 16:9, 4:5, 1:1, then 1.91:1 (Link previews).

## Appearance

Choose **System**, **Light**, or **Dark** from the appearance icon in the editor header. System follows the browser's reported system appearance and updates while the editor is open. Explicit Light/Dark choices stay fixed until you select System again.

The preference is saved locally and applies to the capture popup and open editor tabs. New installations default to System; existing saved Light/Dark choices carry over. Appearance changes the interface only, leaving the screenshot's look and exported pixels unchanged.

## Scope and limits

- **Visible tab** captures page content, excluding Chrome's tabs, toolbar, and address bar. It does not scroll or capture the full document.
- Element capture crops Chrome's actual rendered pixels. It preserves text, CSS, SVG, and canvas as displayed; it does not reconstruct hidden content or remove overlapping UI.
- An element must fit entirely in the viewport. Partially visible elements are marked as invalid; choose a smaller element or use an area.
- Open shadow roots support element picking. Closed shadow roots and cross-origin iframe interiors are not traversed; select their outer container or draw an area.
- Chrome internal pages and the Web Store restrict injected selectors. Visible-tab capture may still work on restricted pages when explicitly invoked. Local `file:` URLs require Chrome's **Allow access to file URLs** setting for visible capture.
- Browser zoom is handled by the ratio of actual capture pixels to viewport dimensions. Reset pinch zoom before selecting. Page movement, viewport changes, and tab switches during selection invalidate the capture.
- Export's longest edge is capped at 4096 pixels. Source images are never enlarged. Source images are limited to 64 megapixels; imported files are also limited to 32 MB. Captures move as PNG blobs through local IndexedDB, removing the previous 8 MB base64 transfer limit. Chrome's disk quota still applies.
- The Chrome beta has five built-in looks and output inspection. Custom gradients, undo, annotations, full-page capture, browser-window capture, accounts, billing, and native handoff are outside this pass.
- The editor keeps each source in memory. Closing or reloading the tab discards it; capture again or import a file to continue. **Remove screenshot** releases it while keeping your style.

## Local processing and permissions

There is no application networking, telemetry, backend, or remote dependency. The manifest blocks connections from extension pages. No host permissions, all-sites access, debugger access, or clipboard-read permission are requested.

- `activeTab`: temporary access to the page after clicking the extension; also authorizes Chrome's screenshot API.
- `scripting`: installs the isolated, top-frame selector on demand.
- `storage`: last style and appearance are saved in chrome.storage.local. Session storage contains only selection tokens and a browser-session identifier. PNG blobs temporarily use the extension's local IndexedDB database; reading and deleting share one transaction. Pixels are never placed in chrome.storage.local/sync or synced. Unconsumed records are invalid after ten minutes and cleaned on worker startup/next capture, source-tab close or failed editor creation. Restart/reload clears the session identifier, so old records cannot open and are removed on the next worker startup. IndexedDB can remain on disk until cleanup if Chrome stops; it does not automatically vanish at shutdown.
- `clipboardWrite`: writes a PNG after **Copy image**. Image paste uses the user's paste event, not programmatic clipboard reading.

Download uses Chrome's normal file-download flow and needs no `downloads` permission. Website HTML and pixels are never sent to a server. Only the selected rectangle, viewport measurements, source tab ID, and hostname accompany a transient capture.

## Relationship to the Mac core

`lib/renderer.js` ports the five look palettes, blob positions, default controls, shape canvases, Space solver, content centering/lift, rounded corners, shadow rules, deterministic grain, and 4096-pixel cap from `PremiumShotCore`. Recipe fields use v2 naming, with Custom deliberately omitted. UI follows the Mac docs' neutral controls, recessed well, and trash removal control.

Canvas gradients, shadow kernels, colour handling, and resampling differ from CoreGraphics. This is a browser implementation of the same composition rules, not a pixel-identical Swift binary. Sixty fixture/shape/Space comparisons verify geometry against the native CLI. Interior source pixels remain exact at 1:1.

Rendering and PNG encoding run in a module worker using OffscreenCanvas. The displayed canvas and both exports come from one completed render. Session and recipe revision checks discard stale work; changing the source or style invalidates a pending export.

Inspect ports `PremiumShotCore.Zoom`'s display-scale mapping, pointer anchor, magnification limits, and bounded pan. It uses a copy of the completed preview canvas and releases that copy on close.

## Checks

No build or dependency installation is needed to load the extension. The distributable ZIP contains runtime files and this guide. Development checks run from the repository checkout and use Node; fake-indexeddb is a development-only test dependency:

```sh
cd chrome-extension
npm ci
npm test
npm run test:core     # requires the native .build/release/pshot; or set PSHOT_CLI
npm run test:browser  # requires Playwright and its current Chromium
```

The browser check uses the shipped manifest in a fresh temporary profile, invokes Chrome's extension action through CDP, and exercises real screenshot/clipboard/download APIs against a synthetic local page. It does not add host permissions or modify the product manifest. Its synthetic clipboard read-back is granted only on the local test webpage. It writes evidence to the git-ignored `reports/chrome-prototype/` directory and removes its test profile afterward.

The experimental `Extensions.triggerAction` CDP command requires a recent Chromium for automated checks; that is a test-harness requirement, separate from the extension's declared Chrome 120 minimum. Older Chrome versions and real-world websites still need manual acceptance.

For 0.1.1, ten Node tests and sixty native geometry comparisons pass. The identical editor frontend was checked in Google Chrome over local HTTP at 1280 × 720, 1280 × 600, and 390 × 844, in light/dark appearance and Inspect. Five downloaded PNGs are pixel-identical to the previous prototype's matching fixture exports. Evidence is in `reports/chrome-refinement-2026-10-10/` and the repository's `design-qa.md`.

Real-extension integration evidence is from 0.1.0; it was not rerun for the editor-refinement passes. Extension-page automation was unavailable. Keyboard activation opens the file picker, but automated file selection was blocked by the browser connector's file-access setting. Fabien subsequently reported that 0.1.1 was working nicely; individual integration paths were not itemized in that feedback.

For 0.1.2, all fourteen Node checks pass. Four appearance checks cover live System changes, explicit overrides, legacy settings, storage failure, cross-context synchronization, and startup races. Light/Dark/System and the narrow header were inspected in the local Chrome frontend; actual OS switching and extension preference persistence still need manual verification. Evidence: `reports/chrome-appearance-2026-10-10/`. Claude's visual/product review brief is `docs/chrome-review-for-claude.md` in the repository.


## Beta candidate 0.1.3

Claude's design review is implemented: action arrows removed, Shape segmented into one row (equal-width centered 3 + 2 below 420 px), neutral control-shaped keyboard rings, lighter sliders with white thumbs, a quiet appearance menu, and a simpler empty editor. Output dimensions occupy the idle footer; export/error feedback temporarily uses that slot. The header and manifest no longer say Prototype.

All fourteen Node checks pass. The Chrome frontend was checked at 1280 × 720, 1280 × 600, 420 × 844, and 390 × 844. Five downloaded PNGs are pixel-identical to the previous Chrome fixture exports. Informational contrast is at least 4.84:1, disabled label contrast 5.26:1, and focus contrast 10.99:1 against the surrounding interface surfaces. Evidence: `reports/chrome-beta-2026-10-10/`; implementation response: `docs/chrome-beta-handoff-2026-10-10.md`.

The distribution decision is an unlisted Chrome Web Store beta. The prepared ZIP is `out/PremiumShot-Chrome-beta-0.1.3.zip`, with `manifest.json` at its root. It has not been uploaded or published. Before submission, complete one final real-extension capture/import/copy check and prepare the listing's site/privacy URLs and store images.

PremiumShot is one product, with Mac and Chrome as two entry points on a single website. No capture shortcut is assigned for the first beta. Custom gradients follow beta feedback.

## Store candidate 0.1.4

Fabien reported that the current extension is working nicely and authorized preparation of the unlisted store listing. This candidate preserves every JavaScript, HTML and CSS runtime file from 0.1.3. Its only product asset change is the 128 px icon: the existing artwork occupies 96 × 96 px with 16 px transparent padding on each side, following the store's icon guidance. The 16 px and 48 px toolbar icons are unchanged.

The upload ZIP is `out/PremiumShot-Chrome-beta-0.1.4.zip`. The listing copy, disclosures, screenshots, promotional artwork, privacy/support drafts and submission checklist are in `chrome-web-store/` at the repository root. Those materials are separate from the extension upload. Premiumshot.app is the planned public domain; domain purchase, public privacy/support URLs and publisher registration are pending. No store item has been created, uploaded or submitted.

## Large-capture beta candidate 0.2.0

Capture transfers now use original-byte PNG blobs in IndexedDB, an id-only editor URL, atomic single consumption, and session/expiry/tab/error cleanup. The four permissions, CSP, picker, composition and exported image rules are unchanged. Privacy/support drafts describe temporary disk storage and event-driven cleanup.

All 29 Node checks and 60 native layout comparisons pass. Native Chrome storage tests pass, including racing consumers and cleanup. A valid 12,053,779-byte PNG at 10,240 × 5,760 (a 5K viewport at 2×) survives the handoff byte for byte and renders to a capped 4096 × 2501 PNG. Five newly downloaded 2789 × 1269 exports are byte- and pixel-identical to the accepted fixture exports. This is component/frontend coverage; a fresh clean-profile MV3 run and a real maximised-display capture remain required before distribution.

Serve the repository locally and open `tests/capture-store.html` to rerun native storage and large-image checks. The test uses a unique disposable database and removes it after completion. It does not load the extension or call Chrome's capture API. Historical `test:browser` instrumentation now checks IndexedDB, but was not executed in this pass because extension-page automation remains unavailable; do not bypass that restriction with another browser channel.

Current upload: `out/PremiumShot-Chrome-beta-0.2.0.zip`. Updated listing kit: `chrome-web-store/`. Implementation/evidence handoff: `docs/chrome-beta-0.2.0-handoff.md`. The store artwork starts with the actual popup and a documented preview of the unchanged picker over a synthetic webpage; editor and Inspect follow. Nothing has been uploaded or submitted.
