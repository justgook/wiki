# Validator-only HTML parser

`htmlparser2.mjs` is a standalone, minified ESM bundle used only by
`scripts/inspect-html.mjs`. It is **not** a browser/runtime vendor dependency;
no project npm install or network access is needed to run the validator.

Upstream code included in the bundle (all MIT licensed):

| Package | Pinned version | Source | License |
| --- | --- | --- | --- |
| htmlparser2 | 10.0.0 | https://github.com/fb55/htmlparser2 | `licenses/htmlparser2-LICENSE` |
| domhandler | 5.0.3 | https://github.com/fb55/domhandler | `licenses/domhandler-LICENSE` |
| domelementtype | 2.3.0 | https://github.com/fb55/domelementtype | `licenses/domelementtype-LICENSE` |
| entities | 6.0.1 | https://github.com/fb55/entities | `licenses/entities-LICENSE` |

Built with esbuild 0.25.12. `htmlparser2-package-lock.json` records the exact npm
registry tarballs and integrity hashes for the isolated installation (including
build tools and dependencies that are not retained in the final bundle).
`htmlparser2-entry.mjs` imports the parser directly to exclude unrelated feed,
serializer and DOM-query modules; its `parseDocument` helper is equivalent to
upstream's helper. Entity decoding and DOM construction remain upstream code.

## Rebuild

From the repository root, with Node/npm installed:

```sh
tmp=$(mktemp -d)
cp scripts/vendor/htmlparser2-package-lock.json "$tmp/package-lock.json"
node --input-type=module -e '
  import fs from "node:fs";
  const dir = process.argv[1];
  const lock = JSON.parse(fs.readFileSync(`${dir}/package-lock.json`));
  fs.writeFileSync(`${dir}/package.json`, JSON.stringify(lock.packages[""]));
' "$tmp"
npm ci --prefix "$tmp" --ignore-scripts
cp scripts/vendor/htmlparser2-entry.mjs "$tmp/entry.mjs"
"$tmp/node_modules/.bin/esbuild" "$tmp/entry.mjs" \
  --bundle --format=esm --platform=neutral --target=es2022 \
  --minify --legal-comments=inline --outfile=scripts/vendor/htmlparser2.mjs
for name in htmlparser2 domhandler domelementtype entities; do
  cp "$tmp/node_modules/$name/LICENSE" "scripts/vendor/licenses/$name-LICENSE"
done
rm -rf "$tmp"
```

Review version/lockfile/license changes together when updating the bundle.
