#!/bin/sh
# Makes web copies of the app screenshots: WebP at 828px wide (for 3x phones)
# and 640px wide (for 2x screens). The full-size PNGs aren't kept in the repo,
# so pass the folder that holds them, with light/ and dark/ subfolders. Re-run
# after replacing any screenshot. Needs cwebp (brew install webp).
#
#   sh scripts/optimize-screens.sh ~/Desktop/rimshot-screens
#
# Why WebP and not AVIF: sips writes AVIF as a tiled grid that Chromium
# decodes to blank pixels, so those files would break in Chrome and Edge.

set -eu
SRC=$(cd "${1:?usage: optimize-screens.sh <folder with light/ and dark/ PNGs>}" && pwd)
cd "$(dirname "$0")/../assets/screens"

QUALITY=78

for png in "$SRC"/light/*.PNG "$SRC"/light/*.png "$SRC"/dark/*.PNG "$SRC"/dark/*.png; do
  [ -e "$png" ] || continue
  theme=$(basename "$(dirname "$png")")
  name=$(basename "$png" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]')

  for width in 828 640; do
    out="$theme/$name.webp"
    [ "$width" = 828 ] || out="$theme/$name-$width.webp"
    cwebp -quiet -q "$QUALITY" -m 6 -sharp_yuv -resize "$width" 0 "$png" -o "$out"
  done

  printf '%-24s %5s KB  ->  %4s KB, %4s KB\n' "$theme/$name" "$(du -k "$png" | cut -f1)" \
    "$(du -k "$theme/$name.webp" | cut -f1)" "$(du -k "$theme/$name-640.webp" | cut -f1)"
done
