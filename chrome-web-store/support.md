# PremiumShot for Chrome support

**Publication draft.** Publish at `/support/chrome/` on the shared PremiumShot site after adding a working `{{SUPPORT_EMAIL}}`. Remove this notice. This is the Chrome door of one PremiumShot site, alongside Mac.

## Capture, finish, share

Pin PremiumShot in Chrome's extension menu. On a webpage, click its icon and choose Select an element, Capture visible tab or Select an area. The editor opens in a new tab. Choose a look, adjust Shape, Space, Corners and Shadow, then Copy image or Download PNG.

The Chrome beta has five looks: Dawn, Tide, Paper, Graphite and Clear. It runs independently of the Mac app and requires Chrome 120 or later.

## Which part of the page is captured?

Visible-tab capture uses the page viewport, excluding Chrome's toolbar and tab strip. An element must fit entirely within the visible page. The area picker captures your drawn rectangle. Offscreen content is outside the capture. These captures use Chrome's rendered pixels, so overlapping page content remains visible.

Chrome's internal pages and the Web Store restrict element and area selection. Try a regular webpage or visible-tab capture. Closed shadow roots and cross-origin iframe interiors can be captured through their visible outer container or an area selection.

## How do I select a parent element or cancel?

Hover over the element. Use Up to select its parent and Down to return to the child. Click or press Enter to capture. Esc or Cancel dismisses the picker. For an area, drag and release to capture. If the page moves or the active tab changes, start a new selection. Reset pinch zoom if prompted.

## Can I use an existing image?

In an empty editor, use Choose an image, drop a file or paste an image. PNG, JPEG and WebP files are supported, up to 32 MB and 64 megapixels. The original file stays unchanged.

## Why is Copy image unavailable or denied?

Open or capture an image first. Choose Copy image to write the finished PNG to the clipboard, then paste into an app that accepts images. If Chrome or your system denies clipboard writing, use Download PNG. There is no background clipboard reader.

## How do Inspect and Actual size work?

Inspect opens a viewing window for the completed image. Scroll to zoom, drag or use arrow keys to pan. F fits, Z selects Actual size, and Esc returns to the editor. Actual size maps one export pixel to one display pixel; it does not change export dimensions.

## How do I follow my system's appearance?

Use the appearance icon in the editor header and choose System. Light and Dark are explicit choices. The preference also applies to the capture popup and other editor tabs. It changes the interface, leaving exported image colors unchanged.

## Are my screenshots saved or uploaded?

Images are processed locally. Closing or reloading the editor discards its current image. Remove screenshot clears it while keeping your style. Download a PNG to keep a finished image. Captures briefly pass through a local IndexedDB database, including visible-tab pixels before an element or area is cropped, and the editor deletes each transfer when it reads it. An unconsumed transfer can remain on disk until cleanup. See the [Chrome privacy policy](/privacy/chrome/) for the complete lifecycle.

## Why did a capture expire or become too large?

Open a pending capture within ten minutes, or capture again. Version 0.2.0 removes the earlier 8 MB transfer limit. Chrome's local disk quota still applies; if storing a capture fails, free disk space or close pending captures and retry. Source images are limited to 64 megapixels; imported files are also limited to 32 MB. The exported image's longest edge is capped at 4096 pixels, and source images are not enlarged.

## Report a problem or share beta feedback

Contact {{SUPPORT_EMAIL}}. Include your Chrome version, operating system, extension version, capture mode, and the steps that led to the problem. A page URL or screenshot is optional; use a public or synthetic example when possible. Send only information you choose to share.
