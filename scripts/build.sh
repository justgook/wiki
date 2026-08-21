#!/usr/bin/env bash
set -euo pipefail

usage() {
    echo "Usage: $0 [CONTENT_DIRECTORY] [OUTPUT_DIRECTORY]" >&2
}

source_dir=${1:-.}
output_dir=${2:-.wiki-dist}
engine_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)

if [[ ! -d "$source_dir" ]]; then
    echo "Wiki content directory does not exist: $source_dir" >&2
    usage
    exit 1
fi
if [[ ! -f "$source_dir/_config.md" || ! -f "$source_dir/_sidebar.md" ]]; then
    echo "Wiki content must contain _config.md and _sidebar.md: $source_dir" >&2
    exit 1
fi

source_dir=$(cd "$source_dir" && pwd -P)
output_parent=$(dirname "$output_dir")
output_name=$(basename "$output_dir")
mkdir -p "$output_parent"
output_parent=$(cd "$output_parent" && pwd -P)
output_dir="$output_parent/$output_name"

if [[ "$source_dir" == "$output_dir" || "$engine_dir" == "$output_dir" || "$output_dir" == "/" ]]; then
    echo "Refusing unsafe wiki output directory: $output_dir" >&2
    exit 1
fi

stage=$(mktemp -d "${TMPDIR:-/tmp}/wiki-build.XXXXXX")
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/content"

cp "$engine_dir/index.html" "$engine_dir/app.js" "$engine_dir/style.css" \
   "$engine_dir/custom.css" "$engine_dir/favicon.svg" "$stage/"
cp -R "$engine_dir/vendor" "$stage/vendor"

# A content repository is public input. Repository metadata, local tooling, and
# site overrides do not belong under /content in the published site.
tar -C "$source_dir" \
    --exclude='*/.*' \
    --exclude='./Makefile' \
    --exclude='./custom.css' \
    --exclude='./favicon.svg' \
    -cf - . | tar -C "$stage/content" -xf -

[[ -f "$source_dir/custom.css" ]] && cp "$source_dir/custom.css" "$stage/custom.css"
[[ -f "$source_dir/favicon.svg" ]] && cp "$source_dir/favicon.svg" "$stage/favicon.svg"
: > "$stage/.nojekyll"

rm -rf "$output_dir"
mv "$stage" "$output_dir"
trap - EXIT

echo "Built wiki: $output_dir"
