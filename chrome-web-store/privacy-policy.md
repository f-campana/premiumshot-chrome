# PremiumShot for Chrome privacy policy

**Publication draft.** Replace `{{PUBLISHER_NAME}}` and `{{SUPPORT_EMAIL}}`, set the effective date to the publication date, describe the chosen support channel's handling, and remove this draft notice before publishing at `/privacy/chrome/` on the shared PremiumShot site. This policy covers the Chrome extension; it does not claim to cover the website's hosting or support provider.

Effective date: {{EFFECTIVE_DATE}}

PremiumShot for Chrome is provided by {{PUBLISHER_NAME}}. It helps you capture or import a screenshot, give it a visual finish, and copy or download a PNG. Image processing happens on your device. The extension has no account system, analytics, advertising or screenshot upload service.

## What the extension handles

When you invoke capture, the extension accesses the visible pixels of the current tab. Element and area capture also use the selected rectangle, page viewport measurements and temporary pointer or keyboard interactions needed to make your selection. The element picker reads element bounds and a tag or ID to show its selection label; it does not transmit page HTML or text.

Chrome first captures the visible tab, and the editor then crops element or area captures. The temporary image can therefore contain other visible page content outside your selection until the editor imports it. Only the cropped image is used for the finished composition.

The extension reads the current tab's URL to check whether selection is supported and derive a source hostname. The hostname appears in the editor, and a source tab identifier enables Back to page. This does not create a record of your browsing history.

If you open, drop or paste an image, the extension processes that image and may display its filename in the editor. Images can contain personal or sensitive information chosen by you. The extension processes those pixels without extracting names, messages, credentials, payment details or other information from them.

Your last style and System, Light or Dark preference are saved locally so you can use them again.

## How information is used and shared

The extension uses this information only to capture, compose, inspect and export your screenshot, remember your settings and return to the source tab. It does not send screenshots, source hostnames, selection interactions or settings to the developer or an external server. It does not sell this information, use it for advertising or profiling, or give the developer access to your captures.

Copy image places the finished PNG on your system clipboard. Download PNG saves it through Chrome's normal download flow. You decide where to paste, save or share it. Chrome, your operating system and any destination you choose have their own data handling practices.

PremiumShot for Chrome's use of information obtained through Chrome APIs complies with the Chrome Web Store User Data Policy, including its Limited Use requirements. Use is limited to the screenshot features described here.

## Storage and removal

Captures temporarily pass through the extension's local IndexedDB database as PNG blobs while moving to the editor. This database uses storage on your device. Reading and deleting a transfer record happen in one transaction, so it can be imported only once. Screenshot pixels are not placed in chrome.storage.local or chrome.storage.sync, and the extension does not sync them.

Unopened transfers become invalid after ten minutes. Cleanup is event-driven: expired records are deleted when the extension's service worker starts or another capture begins, and pending records for a source tab are deleted when that tab closes. A failed attempt to open the editor also deletes its transfer. Cancelling a selection before capture creates no image record.

A small identifier in Chrome's session memory associates transfers with the current browser session. Browser restart, extension reload or update clears that identifier; remaining database records cannot be opened in the new session and are deleted when the extension next starts. Unlike session memory, IndexedDB does not automatically disappear at browser shutdown. If Chrome stops before cleanup, a temporary image can remain on your device until the next extension startup. Ten minutes is the validity limit, not a promise of deletion by a running timer.

The editor holds its current source and finished image in memory. Remove screenshot, reload the editor or close its tab to discard that image from the editor. Style and appearance preferences remain in local extension storage until changed or the extension is removed. Reset restores the default style.

Downloaded files and clipboard copies remain under your control outside the editor; closing the editor does not delete them.

## Permissions

- Temporary active-tab access enables user-initiated capture and identifies the source page.
- Script injection enables element and area selection on the current webpage.
- Local storage remembers your settings. Session storage holds selection tokens and a session identifier; local IndexedDB transfers PNG blobs to the editor.
- Clipboard writing enables Copy image. The extension does not request background clipboard reading.

## Contact and changes

For questions about the extension or this policy, contact {{SUPPORT_EMAIL}} or visit the PremiumShot Chrome support page at `/support/chrome/` on this site. If you choose to send a support message, its contents leave your device through the service you use; the extension does not send a message automatically.

If the extension's data practices change, this policy will be updated with a new effective date and any required disclosure will be provided in the product.
