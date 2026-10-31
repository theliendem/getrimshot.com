#!/bin/sh
# Stamps every page's links to the site's CSS and JS with a hash of the
# file, like /assets/css/site.css?v=1a2b3c4d. Browsers keep these files for
# hours, so without a new URL a visitor can get new HTML with an old
# stylesheet. Run it after changing any file in assets/css or assets/js,
# and commit the pages it touches.
#
#   sh scripts/stamp-assets.sh

set -eu
cd "$(dirname "$0")/.."

for asset in assets/css/*.css assets/js/*.js; do
  hash=$(shasum "$asset" | cut -c1-8)
  # Only the published pages, so untracked drafts are left alone.
  git ls-files '*.html' | while read -r page; do
    perl -pi -e "s#(\"/\Q$asset\E)(\?v=[0-9a-f]+)?\"#\$1?v=$hash\"#g" "$page"
  done
done
