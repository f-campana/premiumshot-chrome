# Standalone repository extraction

The extension and store kit were copied from the shared PremiumShot working archive on 27 October 2026. The original files and evidence remain there. This repository is the new Chrome source of truth; changes here are not automatically applied to an extension that Chrome previously loaded from the old path.

The 20 files in the 0.2.0 upload package, including its packaged README, match the recorded source hashes. The rebuilt upload ZIP matches the accepted SHA-256 `7e1c2f4bb9c7223cb7f677dc5a683a69dcd6e40ac2a9796314133dc4afa9b5ae`. Store packaging and project documentation were adapted for the standalone layout without changing extension runtime files. The generated store-kit ZIP is a new artifact because its documentation and packaging checks changed.

Local verification after extraction: a clean npm dependency install, 29 Node tests, packaging/ZIP checksum, and 60 comparisons against the existing development CLI whose SHA-256 matches the original validation record. The four synthetic fixture images are included here. The Mac source reference is pinned in `scripts/mac-core-revision.txt`; the CLI is never packaged.

A fresh CLI build from that pinned commit was attempted locally but the selected command-line tools had mismatched Swift components. Selecting the installed Xcode reported that its license had not been accepted. The first [hosted checks run](https://github.com/f-campana/premiumshot-chrome/actions/runs/40517900450) subsequently built the pinned CLI and passed all 60 layout comparisons on commit `eb73835`. It also passed the 29 Node tests and candidate ZIP verification; the downloaded CI artifact matched the accepted SHA-256. The local toolchain issue remains separate from the successful hosted build. The tag-triggered draft release workflow has not yet been exercised.

The loaded-extension acceptance and its separate remaining release gates are described in [acceptance-0.2.0.md](acceptance-0.2.0.md). No Web Store item, submission or publication was performed as part of extraction.
