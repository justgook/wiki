#!/usr/bin/env bash
set -euo pipefail

engine_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
fixture=$(mktemp -d "${TMPDIR:-/tmp}/wiki-build-test.XXXXXX")
trap 'rm -rf "$fixture"' EXIT

cat > "$fixture/_config.md" <<'EOF'
---
title: Build test
description: Build test fixture.
home: home
---
EOF
cat > "$fixture/_sidebar.md" <<'EOF'
## Test
- [[Home]]
EOF
cat > "$fixture/home.md" <<'EOF'
---
title: Home
status: accepted
---

Content copied successfully.
EOF
printf '/* fixture override */\n' > "$fixture/custom.css"
printf '/* fixture script */\n' > "$fixture/custom.js"
printf 'do not publish\n' > "$fixture/.env"
mkdir -p "$fixture/pages/nested" "$fixture/wiki-extensions" "$fixture/game-text" "$fixture/dist/content"
printf '%s\n' '---' 'title: Reference' 'status: reference' '---' 'Public page.' > "$fixture/pages/reference.md"
printf 'export default {}\n' > "$fixture/wiki-extensions/example.js"
printf 'msgid "Example"\nmsgstr ""\n' > "$fixture/game-text/example.po"
printf 'do not publish\n' > "$fixture/pages/nested/.secret"
printf 'stale output\n' > "$fixture/dist/content/stale.md"

"$engine_dir/scripts/build.sh" "$fixture" "$fixture/dist"

test -f "$fixture/dist/index.html"
test -f "$fixture/dist/theme.js"
grep -q "readDiagramTheme" "$fixture/dist/theme.js"
test -f "$fixture/dist/content/_config.md"
test -f "$fixture/dist/content/_sidebar.md"
test -f "$fixture/dist/content/home.md"
test -f "$fixture/dist/content/pages/reference.md"
test -f "$fixture/dist/content/wiki-extensions/example.js"
test -f "$fixture/dist/content/game-text/example.po"
grep -q 'fixture override' "$fixture/dist/custom.css"
grep -q 'fixture script' "$fixture/dist/custom.js"
test ! -e "$fixture/dist/content/.env"
test ! -e "$fixture/dist/content/pages/nested/.secret"
test ! -e "$fixture/dist/content/custom.css"
test ! -e "$fixture/dist/content/custom.js"
rm "$fixture/custom.js"
"$engine_dir/scripts/build.sh" "$fixture" "$fixture/dist"
test -f "$fixture/dist/custom.js"
! grep -q 'fixture script' "$fixture/dist/custom.js"
test ! -e "$fixture/dist/content/dist"

# A bad page blocks publication without replacing the last successful output.
printf '%s\n' '---' 'title: Home' 'status: invalid' '---' > "$fixture/home.md"
if "$engine_dir/scripts/build.sh" "$fixture" "$fixture/dist" > "$fixture/build.log" 2>&1; then
    echo 'Expected content validation to fail' >&2
    exit 1
fi
grep -q 'home.md.*requires status' "$fixture/build.log"
grep -q 'Content copied successfully' "$fixture/dist/content/home.md"
rm "$fixture/build.log"

# Browser-only customization remains publishable, but fast validation reports its limitation.
printf '%s\n' '---' 'title: Home' 'status: accepted' '---' 'Browser customization fixture.' > "$fixture/home.md"
printf '%s\n' 'export default () => { document.body.dataset.customized = "yes" }' > "$fixture/custom.js"
"$engine_dir/scripts/build.sh" "$fixture" "$fixture/dist" > "$fixture/build.log" 2>&1
grep -q 'WARNING custom.js.*Browser-dependent' "$fixture/build.log"
grep -q 'Browser customization fixture' "$fixture/dist/content/home.md"
rm "$fixture/build.log"

echo "build integration test passed"
