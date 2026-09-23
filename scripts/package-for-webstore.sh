#!/bin/bash
# Creates a clean ZIP for Chrome Web Store submission, containing only the
# files the extension actually needs at runtime.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
OUTPUT="ai-blocker-extension-v${VERSION}.zip"

rm -f "$OUTPUT"

zip -r "$OUTPUT" . \
  -x ".git/*" \
  -x ".gitignore" \
  -x "node_modules/*" \
  -x "test/*" \
  -x "scripts/*" \
  -x "package.json" \
  -x "package-lock.json" \
  -x "CHROMEWEBSTORE.md" \
  -x "README.md" \
  -x "PRIVACY.md" \
  -x "_metadata/*" \
  -x ".DS_Store" \
  -x "*.swp" \
  -x "*.zip"

echo "Packaged: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
