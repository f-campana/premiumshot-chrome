# Chrome Web Store privacy fields — 0.2.0

Updated 2026-10-11 against the shipped source. These are submission drafts; publisher certifications have not been made. Local processing still needs disclosure under [Chrome's User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq). The [dashboard guide](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) describes the fields below.

## Single purpose

Capture or import a screenshot, compose it locally with a PremiumShot background and adjustable spacing, corners and shadow, then copy or download the finished PNG.

## Permission justifications — paste into their respective fields

**activeTab**

PremiumShot uses temporary access to the active tab after the user invokes the extension. This authorizes Chrome's captureVisibleTab API, identifies the source tab and hostname for the editor, and permits on-demand element or area selection. It does not request persistent access to all websites or read browsing history outside the current capture.

**scripting**

PremiumShot injects its packaged picker into the top frame of the active webpage only after the user chooses Select an element or Select an area. The picker measures visible element bounds or the user's drawn rectangle and viewport, then removes its overlay before capture. No page text or HTML is sent to a server.

**storage**

PremiumShot saves the user's last style and appearance in chrome.storage.local. chrome.storage.session contains only selection tokens and a small browser-session identifier. User-initiated captures pass to the editor as PNG blobs in the extension's local IndexedDB database. The editor consumes and deletes a record in one transaction. Pending transfers become invalid after ten minutes; stale records are cleaned on worker startup and the next capture, and closing the source tab removes its pending transfers. A new browser/extension session invalidates old records and removes them on the next extension startup. IndexedDB can remain on disk if Chrome stops before cleanup; it is not session memory. Pixels are never put in chrome.storage.local or chrome.storage.sync, synced or transmitted.

**clipboardWrite**

PremiumShot writes the finished PNG to the clipboard only when the user chooses Copy image. Pasting an image uses the user's normal paste event. The extension does not request clipboardRead or perform background clipboard reads.

**Host permissions**

None declared. Do not add host access for the listing or for the test fixture.

## Remote code

Select **No, I am not using remote code**. All JavaScript, worker modules, images and styles ship in the ZIP. There is no remote executable code, CDN, telemetry or extension networking. The extension-page CSP is `script-src 'self'; object-src 'none'; connect-src 'none'`.

## Data usage — recommended declaration

The following mapping is a source-based interpretation, to be checked against the actual dashboard wording before certification. Do not select “no data” solely because handling is local.

| Dashboard category | Proposed selection | Actual handling |
| --- | --- | --- |
| Website content | Yes | User-selected screenshots and imported images; DOM tag/ID and element geometry for the on-demand picker. Pixels can include whatever is visibly present in the user's chosen page or file. |
| Web history | Yes | Current source tab URL is read to validate the page and derive its hostname. Only the hostname and tab ID accompany the temporary capture; no list of visited pages or browsing history is collected. |
| User activity | Yes, conservatively | Pointer positions, rectangle dragging and selection keystrokes are processed while the picker is active. They are not logged or transmitted. |
| Personally identifiable information; health; financial/payment; authentication; personal communications; location | No separate collection | There are no account, payment, location, credential or message extraction features. Such information may appear inside pixels the user chooses to capture or import; it is handled as image content locally. Review any changed dashboard definition that requires incidental image content to be classified separately. |

The extension first captures the visible tab, then crops element/area captures in the editor. Temporary transfer pixels can include content outside the selected rectangle. State this in the privacy policy; do not claim that the extension only ever accesses the final cropped pixels.

## Data-use certifications — supported by the inspected implementation

The publisher can certify that data is not sold or transferred to third parties outside permitted uses, is not used for purposes unrelated to the extension's single purpose, and is not used to determine creditworthiness or for lending. Captured data is not used for advertising or profiling. Copy/download destinations are controlled by the user. This preparation does not submit those certifications on the publisher's behalf.

Privacy policy URL: **planned** `https://premiumshot.app/privacy/chrome/`. Publish an accessible policy, fill in publisher/contact details, and link it from the shared site's footer before submission. The current private Sites preview is not a usable public policy URL.

## Source trail

- `chrome-extension/manifest.json`: four permissions, no hosts/commands, packaged service worker, restrictive CSP.
- `background.js`: explicit capture invocation, current-tab validation, temporary source hostname/tab/rectangle/viewport transfer and cleanup.
- `picker.js`: transient DOM measurements and selection events; overlay removal.
- `lib/capture-store.js`: original-byte PNG decoding, local Blob storage, atomic consumption, expiry/session/tab cleanup.
- `editor.js`: IndexedDB consumption and deletion, local style, image import/paste, in-memory worker, explicit copy/download and source-tab return.
- `lib/appearance.js`: local appearance choice and System following.

Candidate 0.2.0 changes capture transfer and editor import. Rendering, picker UI, four permissions and CSP are unchanged from 0.1.4. B5 remains unresolved: the proposed categories above require comparison with the live dashboard definitions before the publisher certifies them.
