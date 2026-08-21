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
printf 'do not publish\n' > "$fixture/.env"
mkdir -p "$fixture/pages/nested" "$fixture/dist/content"
printf 'public page\n' > "$fixture/pages/reference.md"
printf 'do not publish\n' > "$fixture/pages/nested/.secret"
printf 'stale output\n' > "$fixture/dist/content/stale.md"

"$engine_dir/scripts/build.sh" "$fixture" "$fixture/dist"

test -f "$fixture/dist/index.html"
test -f "$fixture/dist/content/_config.md"
test -f "$fixture/dist/content/_sidebar.md"
test -f "$fixture/dist/content/home.md"
test -f "$fixture/dist/content/pages/reference.md"
grep -q 'fixture override' "$fixture/dist/custom.css"
test ! -e "$fixture/dist/content/.env"
test ! -e "$fixture/dist/content/pages/nested/.secret"
test ! -e "$fixture/dist/content/custom.css"
test ! -e "$fixture/dist/content/dist"

echo "build integration test passed"
