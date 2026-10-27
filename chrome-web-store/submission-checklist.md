# Unlisted beta submission — 0.2.0

## Before upload

- [x] Prepare one product name and a beta description consistent with the accepted Mac/Chrome direction.
- [x] B1 implementation: Blob handoff, atomic deletion, session/expiry/tab/error cleanup; 29 unit checks, native Chrome storage checks and synthetic 5K-at-2× image pipeline pass.
- [x] B2 artwork: popup first, shipped picker frontend on a synthetic webpage second, then current editor/dark/Inspect screenshots; provenance documented.
- [x] Prepare 128 px padded icon, small promo and optional marquee.
- [x] Prepare one-purpose statement, four permission explanations, remote-code answer and data-use mapping.
- [x] Prepare privacy/support copy for the shared PremiumShot site.
- [x] Build and validate a ZIP whose root contains `manifest.json`; exclude test harnesses, development dependencies, store assets and private QA material.
- [ ] Register the publisher account. The owner completes the developer agreement and registration payment; this kit performs neither. Choose the Google account carefully: [registration guidance](https://developer.chrome.com/docs/webstore/register).
- [ ] Confirm publisher name and verify a working contact/support email. Complete current account and trader-status fields using the publisher's actual details. [Account setup](https://developer.chrome.com/docs/webstore/set-up-account).
- [ ] Enable account 2-Step Verification before publication. [Chrome requirement](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification).
- [ ] Purchase/configure premiumshot.app and choose the shared site's public origin.
- [ ] Replace the privacy/support draft tokens, describe the chosen support channel's handling, and set the effective date.
- [ ] Publish the public privacy and support pages on the shared site; link privacy from home. Test both URLs without authentication. The private review site's sign-in gate is not sufficient.

## Last local acceptance on the upload candidate

0.2.0 changes runtime transfer and import. The component checks do not satisfy B6. Load this candidate in a clean profile and record the following; do not infer itemized passes from Fabien's earlier general feedback.

- [x] Element and area captures on a regular webpage, with no picker overlay in the exported pixels; visible tab and Back to page.
- [x] Keyboard file import, Inspect/Actual size/pan/Esc, Download, and Copy pasted into another image-capable app.
- [x] Saved System/Light/Dark across popup and reopened editors; real OS appearance change while System is selected.
- [ ] Reload/close discards the current source; last style remains; no unexpected error in the extension's service worker/editor console.
- [x] Real capture at the largest available maximised window, including a 5K viewport at 2× where available. Inspect the extension's IndexedDB after import, picker cancellation, expired transfer cleanup and source-tab close: no corresponding pending records. Synthetic 10,240 × 5,760 PNG coverage already passes; it is not a physical-display capture test.
- [ ] Browser restart/extension reload invalidates pending captures and removes old-session database records on the next worker startup.

**20 October native acceptance:** the exact 0.2.0 upload ZIP was loaded in a fresh signed-out profile and exercised through user-authorized native CUA. The four checked rows above have [itemized evidence](../docs/acceptance-0.2.0.md). Reload and actual close/reopen discard the source and retain style; final console observations are still pending. Real ten-minute expiry, picker cancellation, source-tab closure and extension reload pass, with empty stores and a changed session id. The available built-in display produced a real 3024 × 1724 maximized viewport; no physical 5K display was available. Fabien authorized global Chrome restart, but native control then returned a ScreenCaptureKit failure/frozen frame and an off-screen menu-bar error. Restart and final console checks remain open until native control recovers.

Historical boundary: the prior browser policy prevented extension-page automation. Store screenshots use the identical shipped frontend over HTTP, not a new MV3 integration run. Do not work around that policy with another automation channel.

## Fill the dashboard draft

1. Create **one** item and upload `PremiumShot-Chrome-beta-0.2.0.zip`. Keep the resulting extension ID for future updates.
2. Confirm name, version and summary from the manifest. Paste `listing-description.txt`; select English and the appropriate Tools/Productivity category.
3. Upload the five screenshots in the documented order, icon, small promo, and optional marquee. No video is needed. The picker image is a source-faithful frontend preview, not loaded-extension evidence; replace it with a real loaded-extension screenshot during B6 if available.
4. Add live home, privacy and support URLs. Keep authentication out of the public policy path.
5. Paste the single purpose and each permission justification. Remote code: **No**. Match the live data-use definitions to `privacy-practices.md`; the publisher makes the supported certifications.
6. Purchases: **No** for this build. Visibility: **Unlisted**. Choose intended regions after completing account/trader details. Trusted-tester membership is a different, Private distribution option.
7. Supply reviewer instructions where the dashboard permits them; no credentials are needed.
8. Save and inspect the dashboard preview. Verify each uploaded image, link and privacy field. A saved draft is not an approved or published extension.

## Submit and verify — subsequent action

The current request authorizes preparation. Store submission/publication has not occurred. Once the concrete dashboard draft is ready, obtain the user's instruction to submit it. If the dashboard offers deferred publication, prefer manual publication after review so release timing remains explicit. [Publication workflow](https://developer.chrome.com/docs/webstore/publish).

After approval and authorized publication, verify the direct unlisted URL in a clean Chrome profile, install from the store, exercise a capture/export, and confirm the installed version. Add the real Chrome store URL to the one-site Chrome entry and provide it to beta testers. Distribution to testers or feedback messages requires the user's instructions; this kit sends none.

An unlisted item can be installed by anyone who receives its URL and remains subject to store review. It is not a confidential or restricted beta. [Distribution guide](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution).
