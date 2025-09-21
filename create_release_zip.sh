#!/usr/bin/env bash
# create_release_zip.sh
# Create a release .zip containing the minimal files required to run Clipy.
# Usage: ./create_release_zip.sh clipy-release-1.0.zip

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <output-zip-file>"
  exit 2
fi

OUT_ZIP="release/$1"

# make the release directory if it doesn't exist
mkdir -p release

# 1) Create temporary directory with a `clipy` subdirectory
TMPDIR=".release_tmp_$$"
CLIPY_DIR="$TMPDIR/clipy"
echo "Creating temporary directory $TMPDIR"
rm -rf "$TMPDIR"
mkdir -p "$CLIPY_DIR"

# 2) Copy contents of src into clipy/
if [ -d "src" ]; then
  echo "Copying src/ -> $CLIPY_DIR"
  # Use rsync if available for robust copying; fallback to cp -a
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "src/" "$CLIPY_DIR/"
  else
    cp -a "src/." "$CLIPY_DIR/"
  fi
else
  echo "Error: src/ directory not found" >&2
  rm -rf "$TMPDIR"
  exit 3
fi

# 3) Delete js/__tests__ from the temporary copy if present
if [ -d "$CLIPY_DIR/js/__tests__" ]; then
  echo "Removing $CLIPY_DIR/js/__tests__"
  rm -rf "$CLIPY_DIR/js/__tests__"
fi

# 4) Zip up the clipy folder (store clipy/ as top-level in archive)
if [ -e "$OUT_ZIP" ]; then
  echo "Output file $OUT_ZIP already exists; overwriting"
  rm -f "$OUT_ZIP"
fi

echo "Creating zip $OUT_ZIP from $CLIPY_DIR"
(
  cd "$TMPDIR"
  # -r recurse, -9 best compression, -q quiet
  zip -r -9 -q "../$OUT_ZIP" "clipy"
)

# 5) Delete temporary directory
rm -rf "$TMPDIR"

echo "Release zip created: $OUT_ZIP"
exit 0
