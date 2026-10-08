#!/usr/bin/env bash
# Prepare a GitHub draft release. Never publishes, force-pushes, or commits files.
set -euo pipefail

usage() {
    echo "Usage: $0 [vMAJOR.MINOR.PATCH] [--dry-run]"
    echo "Default: next minor version. Push remote: origin."
    echo "Runs checks, creates/reuses a local tag, pushes branch + tag, creates GitHub draft."
}

version=""
dry_run=false
for arg in "$@"; do
    case "$arg" in
        --dry-run) dry_run=true ;;
        -h|--help) usage; exit 0 ;;
        v*) [[ -z "$version" ]] || { usage >&2; exit 1; }; version="$arg" ;;
        *) usage >&2; exit 1 ;;
    esac
done
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
cd "$repo"
remote=origin
branch=$(git symbolic-ref --quiet --short HEAD) || {
    echo "Release requires a branch, not detached HEAD." >&2; exit 1;
}
[[ -z "$(git status --porcelain)" ]] || {
    echo "Commit or stash changes before preparing a release." >&2; exit 1;
}
git remote get-url "$remote" >/dev/null

if [[ -z "$version" ]]; then
    latest=""
    tags=$(git tag --list 'v*' --sort=-version:refname)
    while IFS= read -r candidate; do
        if [[ "$candidate" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
            latest="$candidate"; break
        fi
    done <<< "$tags"
    if [[ -n "$latest" ]]; then
        IFS=. read -r major minor patch <<< "${latest#v}"
        version="v${major}.$((minor + 1)).0"
    else
        version="v0.1.0"
    fi
fi
[[ "$version" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || {
    echo "Version must be vMAJOR.MINOR.PATCH (no leading zeroes)." >&2; exit 1;
}
existing_tag=false
if git show-ref --verify --quiet "refs/tags/$version"; then
    existing_tag=true
    [[ "$(git rev-parse "$version^{commit}")" == "$(git rev-parse HEAD)" ]] || {
        echo "$version already points to another commit; refusing to move it." >&2; exit 1;
    }
fi

echo "Prepare $version from $branch at $(git rev-parse --short HEAD) -> $remote"
if "$dry_run"; then
    echo "Would run: Node tests, build integration test, static build."
    echo "Would create/reuse annotated tag: $version"
    echo "Would atomically push branch + tag; create draft with generated notes using gh."
    echo "No files, tags, remotes, or releases changed."
    exit 0
fi
command -v node >/dev/null || { echo "Install Node.js to run checks." >&2; exit 1; }
command -v gh >/dev/null || { echo "Install GitHub CLI (gh), then run gh auth login." >&2; exit 1; }
gh auth status
node --test "$repo"/test/*.test.mjs
bash "$repo/test/build.test.sh"
bash "$repo/test/release.test.sh"
"$repo/scripts/build.sh" "$repo/content" "$repo/.wiki-dist"
[[ -z "$(git status --porcelain)" ]] || {
    echo "Checks changed tracked/unignored files; review and commit before retrying." >&2; exit 1;
}
if ! "$existing_tag"; then
    git tag -a "$version" -m "📦(release): prepare $version"
fi
# No force: reject divergent branch/tag updates. Atomic push prevents partial updates.
git push --atomic "$remote" "HEAD:refs/heads/$branch" "refs/tags/$version"
if gh release view "$version" >/dev/null 2>&1; then
    echo "$version already has a GitHub release; leaving it unchanged."
else
    gh release create "$version" --verify-tag --target "$branch" \
        --title "$version" --generate-notes --draft
fi
echo "Draft ready. Review in GitHub before publishing."
