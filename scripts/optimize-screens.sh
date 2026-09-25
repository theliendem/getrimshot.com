#!/bin/sh
# Makes web copies of the app screenshots: a 828px-wide JPEG next to each
# original PNG. The originals are never modified. Re-run after replacing any
# screenshot. Needs macOS (sips).
#
#   sh scripts/optimize-screens.sh
#
# Why JPEG and not AVIF: sips writes AVIF as a tiled grid that Chromium
# decodes to blank pixels, so those files would break in Chrome and Edge.

set -eu
cd "$(dirname "$0")/../assets/screens"

WIDTH=828      # largest phone frame is ~276 CSS px, shown at 3x on iPhone
QUALITY=75

for png in light/*.PNG light/*.png dark/*.PNG dark/*.png; do
  [ -e "$png" ] || continue
  base="${png%.*}"
  w=$(sips -g pixelWidth "$png" | awk '/pixelWidth/ { print $2 }')
  h=$(sips -g pixelHeight "$png" | awk '/pixelHeight/ { print $2 }')
  height=$(( h * WIDTH / w ))

  sips --resampleHeightWidth "$height" "$WIDTH" -s format jpeg -s formatOptions "$QUALITY" "$png" --out "$base.jpg" >/dev/null

  printf '%-18s %5s KB  ->  %4s KB\n' "$png" "$(du -k "$png" | cut -f1)" "$(du -k "$base.jpg" | cut -f1)"
done
