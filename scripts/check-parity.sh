#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mac_repo="${PSHOT_MAC_DIR:-$root/../premium-shot-mac}"
revision="$(cat "$root/scripts/mac-core-revision.txt")"
if [[ ! -d "$mac_repo" ]] || ! git -C "$mac_repo" cat-file -e "$revision^{commit}" 2>/dev/null; then
  echo "Mac repository or pinned revision unavailable: $mac_repo ($revision)" >&2
  echo "Set PSHOT_MAC_DIR to a local premiumshot-mac Git checkout containing this commit." >&2
  exit 1
fi
if [[ "$(uname -s)" != Darwin ]]; then
  echo "Mac parity requires macOS, Xcode and Swift 6.2 or newer." >&2
  exit 1
fi
scratch="$(mktemp -d "${TMPDIR:-/tmp}/premiumshot-parity.XXXXXXXX")"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/source"
git -C "$mac_repo" archive "$revision" | tar -xf - -C "$scratch/source"
swift build -c release --product pshot --package-path "$scratch/source" --scratch-path "$scratch/build"
PSHOT_CLI="$scratch/build/release/pshot" npm --prefix "$root/chrome-extension" run test:core
