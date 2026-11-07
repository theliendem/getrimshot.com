#!/bin/sh
# Writes the HeyCatch short-link pages. HeyCatch reserves every
# single-character path (/a to /z, /0 to /9) for channel attribution:
# /<char> must forward to /?utm_source=heycatch&utm_campaign=<char>.
# GitHub Pages has no redirect rules, so each path gets a tiny page that
# forwards at once. /s is skipped because it is the show-sharing page.
#
#   sh scripts/short-links.sh

set -eu
cd "$(dirname "$0")/.."

for c in a b c d e f g h i j k l m n o p q r t u v w x y z 0 1 2 3 4 5 6 7 8 9; do
  url="/?utm_source=heycatch&amp;utm_campaign=$c"
  mkdir -p "$c"
  cat > "$c/index.html" <<EOF
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Rimshot</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="https://getrimshot.com/">
  <script>location.replace("/?utm_source=heycatch&utm_campaign=$c")</script>
  <meta http-equiv="refresh" content="0; url=$url">
</head>
<body>
  <a href="$url">Continue to Rimshot</a>
</body>
</html>
EOF
done
