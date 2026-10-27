# Acceptance and provenance: 0.2.0

The 0.2.0 upload ZIP prepared on 11 October 2026 has SHA-256
`7e1c2f4bb9c7223cb7f677dc5a683a69dcd6e40ac2a9796314133dc4afa9b5ae`.
The standalone repository preserves the 20 packaged files unchanged, including the packaged README. Its build verifies the complete ZIP checksum.

On 20 October, the exact upload package was loaded in a fresh signed-out Chrome profile. The recorded native pass covered visible-tab, whole-element and area capture, keyboard import, Inspect and pan, download, clipboard paste into Preview, appearance changes, source disposal, and pending-transfer cleanup on cancellation, expiry, source-tab closure and extension reload. A real maximized 3024 × 1724 viewport was captured on the available built-in display. Physical 5K-at-2× capture was not available; earlier 10,240 × 5,760 image coverage was synthetic.

The original local evidence and detailed handoff remain in the shared PremiumShot working archive under `docs/qa/chrome-acceptance-2026-10-20/` and `docs/chrome-acceptance-handoff-2026-10-20.md`. They are not included in this repository.

On 27 October, Fabien reported that his own testing worked perfectly. The specific flows and environment of that independent testing were not enumerated.

The instrumented test of a pending transfer across a full browser restart and the final editor/worker console observations remained open in the last recorded handoff. Do not infer those individual results from general testing. Store-installed acceptance, a real picker store screenshot, publisher/dashboard details and live policy/support pages are separate release gates.
