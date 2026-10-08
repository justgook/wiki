#!/usr/bin/env bash
set -euo pipefail
engine=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
fixture=$(mktemp -d "${TMPDIR:-/tmp}/wiki-release-test.XXXXXX")
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/repo/scripts" "$fixture/repo/test" "$fixture/repo/content" "$fixture/bin"
cp "$engine/scripts/prepare-release.sh" "$fixture/repo/scripts/"
# Mock external checks/GitHub. Real Git pushes only to a temporary local bare repo.
printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/bin/node"
printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/repo/scripts/build.sh"
printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/repo/test/build.test.sh"
printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/repo/test/release.test.sh"
printf '// fixture\n' > "$fixture/repo/test/fixture.test.mjs"
printf 'content\n' > "$fixture/repo/content/home.md"
printf '.wiki-dist/\n' > "$fixture/repo/.gitignore"
cat > "$fixture/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$GH_LOG"
if [[ "$1 $2" == 'release view' ]]; then
    [[ "${RELEASE_EXISTS:-false}" == true ]]
fi
EOF
chmod +x "$fixture/bin/"* "$fixture/repo/scripts/"*.sh
export PATH="$fixture/bin:$PATH"
export GH_LOG="$fixture/gh.log"
git init -q -b release "$fixture/repo"
git -C "$fixture/repo" config user.email test@example.com
git -C "$fixture/repo" config user.name 'Release test'
git -C "$fixture/repo" add .
git -C "$fixture/repo" commit -qm 'fixture'
git -C "$fixture/repo" tag v1.2.0
printf 'next\n' >> "$fixture/repo/content/home.md"
git -C "$fixture/repo" commit -qam 'next'
git init -q --bare "$fixture/remote.git"
git -C "$fixture/repo" remote add origin "$fixture/remote.git"
release="$fixture/repo/scripts/prepare-release.sh"

"$release" --dry-run > "$fixture/dry-run.log"
grep -q 'Prepare v1.3.0' "$fixture/dry-run.log"
! git -C "$fixture/repo" show-ref --verify --quiet refs/tags/v1.3.0
test ! -e "$GH_LOG"
if "$release" v01.2.3 --dry-run > /dev/null 2>&1; then echo 'accepted invalid version' >&2; exit 1; fi
if "$release" v1.2.0 --dry-run > /dev/null 2>&1; then echo 'accepted moved tag' >&2; exit 1; fi
printf 'dirty\n' > "$fixture/repo/untracked"
if "$release" --dry-run > /dev/null 2>&1; then echo 'accepted dirty tree' >&2; exit 1; fi
rm "$fixture/repo/untracked"

"$release" > "$fixture/release.log"
test "$(git -C "$fixture/repo" cat-file -t v1.3.0)" = tag
test "$(git -C "$fixture/remote.git" rev-parse refs/tags/v1.3.0^{commit})" = "$(git -C "$fixture/repo" rev-parse HEAD)"
test "$(git -C "$fixture/remote.git" rev-parse refs/heads/release)" = "$(git -C "$fixture/repo" rev-parse HEAD)"
grep -q 'release create v1.3.0 .*--generate-notes --draft' "$GH_LOG"
RELEASE_EXISTS=true "$release" v1.3.0 > "$fixture/retry.log"
test "$(grep -c '^release create' "$GH_LOG")" = 1
"$release" --dry-run > "$fixture/next.log"
grep -q 'Prepare v1.4.0' "$fixture/next.log"
echo 'release integration test passed'
