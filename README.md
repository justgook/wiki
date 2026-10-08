# Wiki

A no-build, offline-capable content wiki. Markdown is the default source format, and project extensions can render additional text formats directly in the browser. Source files remain the source of truth: there is no framework, package install, generated page index, or CDN requirement. This repository includes the runtime and a [deployed authoring guide](https://justgook.github.io/wiki/) that doubles as its demo.

The engine is designed for project wikis, living design documents, and knowledge bases that should remain easy to read and edit as plain files. A reusable GitHub Action combines the engine with any content repository for publishing, while `make serve` provides a live local preview.

## What it provides

- Markdown pages rendered directly in the browser.
- Project-defined content renderers for additional text formats.
- Hash-based navigation with shareable page and section links.
- A nested, collapsible sidebar defined in Markdown, including page filtering and adjacent-page navigation.
- `[[Wiki links]]` with optional paths and visible labels.
- YAML frontmatter with document statuses: `accepted`, `in-progress`, `todo`, and `reference`.
- Visual markers for accepted decisions, open work, questions, missing evidence, images, diagrams, and examples.
- Syntax-highlighted fenced code blocks and source-file includes.
- KaTeX formulas and expandable Mermaid diagrams.
- Custom theming through `custom.css` and `favicon.svg`, and optional site behavior through `custom.js`.
- Vendored browser libraries, so a built wiki does not depend on external services.

There is deliberately no static-site compilation step. `make build` and the GitHub Action only assemble the engine and public content into a publishable directory; Markdown is still rendered at runtime.

## Three ways to use it

### 1. Publish a Markdown repository with GitHub Actions

Keep source content, project renderers, and wiki assets in your content repository. The reusable action adds the engine and assembles the publishable site; the surrounding workflow deploys it through GitHub Pages. The content repository never needs to vendor or track the runtime.

**Best for:** a maintained project wiki with automatic publishing on every push.

### 2. Build a portable static wiki

Download the `Makefile` into a content repository and run `make build`. This installs the engine locally and writes a complete static wiki to `.wiki-dist/`. Publish that directory with any static host, copy it to another machine, or archive it as a self-contained snapshot.

**Best for:** non-GitHub hosting, manual releases, and portable or offline snapshots.

### 3. Bootstrap a standalone wiki

Use the `Makefile` and `make build` as an installer or scaffold. The generated `.wiki-dist/` can become the wiki root: the runtime lives at its top level and editable Markdown lives under `.wiki-dist/content/`. You can then add or edit content directly in that standalone folder and serve it with any static HTTP server.

**Best for:** quickly creating a self-contained wiki without adopting the GitHub Action workflow.

In all three modes, the same browser engine renders the same Markdown format. The difference is only how the engine and content are assembled and published.

## Content repository layout

The content repository root is the wiki content root—there is no engine submodule and no `content/` wrapper:

```text
_config.md
_sidebar.md
home.md
images/
custom.css       # optional site override
custom.js        # optional site JavaScript override
favicon.svg      # optional site override
Makefile         # optional local preview command
.github/workflows/pages.yml
```

Every Markdown page requires YAML frontmatter with a `title` and a status: `accepted`, `in-progress`, `todo`, or `reference` by default. `_sidebar.md` defines navigation; `_config.md` defines the wiki title, description, home page, and optional content extensions.

### Optional site JavaScript and statuses

Put `custom.js` at the content repository root to run site-wide JavaScript. It is loaded after the engine module starts but before the first page renders; if absent, the engine's empty default file is used. Export a default configure function:

```js
export default function configure({ registerStatus, setStatuses }) {
    registerStatus("under-review") // add to the four defaults
    // Or replace all defaults: setStatuses(["draft", "published"])
}
```

All pages (including pages from custom renderers) must use one of the resulting statuses. Status names must be lowercase ASCII letters/numbers separated by hyphens; the engine renders them as text and as a `status-NAME` CSS class. Style new statuses in `custom.css`, for example `.status-under-review { color: purple; }`. The configure function may be async. Like content renderer modules, `custom.js` is trusted code with full browser privileges; use only scripts you control.

## Theme tokens

Override design tokens in your content repository's `custom.css`; no engine edits needed. [THEMING.md](THEMING.md) lists every token: UI, syntax highlighting, Mermaid diagrams, chart palettes, fonts, and layout. Set `color-scheme: light` or `dark` alongside your colors. Browser-supported CSS colors—including `rgb()`, short hex, and `color-mix()`—are resolved for Mermaid only on diagram pages. Custom chart/schema renderers can consume the same CSS variables.

## Custom content renderers

A content repository can render non-Markdown text formats without compiling them to Markdown first. Register trusted project-local JavaScript modules in `_config.md`:

```yaml
extensions:
  - wiki-extensions/gettext.js
```

An extension module declares the file extensions it handles and returns page metadata plus rendered HTML:

```js
export default {
    extensions: [".po"],
    render({ source, path, query, helpers }) {
        return {
            data: {
                title: "Translation catalogue",
                summary: path,
                eyebrow: "Game text",
                status: "in-progress",
            },
            html: `<pre>${helpers.escapeHTML(source)}</pre>`,
            className: "translation-catalogue",
        }
    },
}
```

Renderer modules are trusted content and run in the browser with the same privileges as the wiki. Paths must remain inside the content repository. Each renderer must declare at least one extension, and two renderers cannot claim the same extension.

Link directly to an extended file, preserving its extension:

```md
[[Game Text/Dialogue.po|Dialogue]]
```

Query parameters are passed to the renderer as `URLSearchParams`, allowing extension-specific deep links such as:

```text
#/game-text/dialogue.po?entry=dialogue.m01.com01
```

The render context provides `escapeHTML`, `escapeAttribute`, `pageURL`, and `renderMarkdown` helpers. Use `escapeAttribute` for values interpolated inside HTML attributes. A renderer may also define `afterRender({ article, path, query, helpers })` for behavior such as scrolling to an extension-specific entry. Project-specific renderer styles belong in the content repository's `custom.css`.

## Publish from another repository

Add this workflow to the content repository as `.github/workflows/pages.yml`:

```yaml
name: Deploy wiki

on:
  push:
    branches: [release]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - name: Build wiki
        id: wiki
        uses: justgook/wiki@release
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ${{ steps.wiki.outputs.path }}
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

Enable **GitHub Actions** as the Pages source in the repository settings. For stable production use, pin the wiki action to a release tag or commit SHA instead of `release`.

The action accepts:

- `source` — content directory, default `.`
- `output` — generated site directory, default `.wiki-dist`

It copies public content, applies optional `custom.css`, `custom.js`, and `favicon.svg`, validates the assembled wiki, and returns the absolute generated directory as the `path` output. Content errors stop publication; browser smoke tests are never run automatically. Dotfiles, `.github/`, `Makefile`, and local wiki folders are not published as content.

## Preview locally

Copy this repository's `Makefile` into a content repository, then run:

```sh
make serve
```

On first use it downloads the engine into `.wiki-engine/`, then serves the current content directly at <http://localhost:8080>. Markdown, images, `custom.css`, `custom.js`, and `favicon.svg` remain live: refresh the browser to see edits without rebuilding or restarting the server. It uses Bun, Node.js, Python 3, or Python—whichever is available in that order.

To assemble the same publishable directory produced by the GitHub Action, run:

```sh
make build
```

This writes `.wiki-dist/` using the downloaded engine's `scripts/build.sh`. Engine and action-output directories should be ignored by Git:

```gitignore
.wiki-engine/
.wiki-dist/
```

Useful overrides:

```sh
make serve PORT=3000
make build WIKI_OUTPUT=dist
make serve WIKI_VERSION=v1.0.0
make reinstall-engine
make clean
```

Inside this engine repository, `make serve` automatically uses the existing `content/` demo. In a content repository it serves the current directory; `WIKI_SOURCE=path/to/content` can override that detection.

## Validate before publishing

Requires **Node.js 22 or newer**. Fast validation uses the engine's existing vendored Markdown, YAML, highlighting and KaTeX libraries; it needs no npm install, browser, server or network access (unless your trusted custom code accesses the network).

```sh
make validate
make validate VALIDATE_FLAGS=--strict           # Also fail on warnings
make validate VALIDATE_FLAGS=--browser          # Explicit, slower browser smoke
# Inside the engine repository:
node scripts/validate.mjs content
```

Validation checks configuration, sidebar structure, all published Markdown and registered-format pages, title/status metadata, internal links and sections, local linked files/images, code includes/ranges, strict formulas, and custom renderer output. It ignores dotfiles and syntax examples inside code; `todo` statuses and authoring markers are not errors. Unreachable pages and noncanonical filenames produce warnings. External URLs are not checked. File paths must match case exactly.

Custom statuses and renderer modules execute as **trusted local code**, just as they are trusted browser code at runtime. Node-compatible renderers are checked directly, including query variants found in links. Custom formats may require query parameters; unlisted formats that cannot render without them produce a warning. Code requiring browser globals or browser-relative `fetch()` is deferred with a warning recommending `--browser`; `--strict` prevents publishing with such incomplete checks. Browser-only hooks, Mermaid rendering, layout, CSS resources and assets referenced only through `srcset` are outside the fast check.

`make build` and the reusable GitHub Action automatically run **fast validation only**, against the assembled publishable files. Errors leave the previous output directory intact. Local building therefore now needs Node.js, even if previewing uses Python. The action sets up Node.js 22 itself.

### Optional browser smoke

Install the optional dependency **in the engine directory** (this repository, or `.wiki-engine/` in a content repository):

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
```

Then run `make validate VALIDATE_FLAGS=--browser` from your wiki directory. Nothing installs or downloads automatically. Playwright's `node_modules/` can be ignored by Git; no dependency is needed for normal validation or publishing.

The smoke runner starts a temporary local server and headless Chromium, visits discovered pages and linked query routes, checks fatal panels, uncaught errors, local requests/images and actual Mermaid rendering, and exercises filtering, section navigation, pagination and diagram controls where present. It runs custom `afterRender()` hooks through the real app. It closes the browser and server afterwards. Browser checks run only after content validation has no errors; they are not a visual/layout audit or an exhaustive test of arbitrary custom query combinations.

For an already assembled site:

```sh
node scripts/validate.mjs .wiki-dist/content --site .wiki-dist
node scripts/validate.mjs .wiki-dist/content --site .wiki-dist --browser
```

Diagnostics include the source file, and line information when provided by the parser/include processor. Exit status is `1` on errors (or warnings with `--strict`), otherwise `0`.

## Migrating a submodule-based wiki

For a repository like `justgook/imprint-zero`:

1. Move everything under `content/` to the repository root.
2. Remove the `core` submodule, `.gitmodules`, and engine symlinks (`app.js`, `index.html`, `style.css`, and `vendor`).
3. Keep `custom.css`, optional `custom.js`, and `favicon.svg` at the root.
4. Copy this `Makefile`, add the two ignored directories above, and use the publishing workflow shown above.

## Authoring guide

The [deployed Wiki guide](https://justgook.github.io/wiki/) documents page metadata, navigation, `[[Wiki links]]`, Markdown syntax, KaTeX formulas, Mermaid diagrams, and VuePress-compatible `@[code](path)` includes. It is built from this repository's `content/` directory using the same action available to consuming repositories.

## Prepare a release

Requires Git, Node.js, and authenticated [GitHub CLI](https://cli.github.com/) (`gh auth login`). Commit changes first; run from a branch, not detached HEAD.

```sh
./scripts/prepare-release.sh --dry-run       # Preview next minor version; no changes
./scripts/prepare-release.sh v1.3.0         # Explicit version; existing HEAD tag can be reused
./scripts/prepare-release.sh                # Next minor from latest local stable tag
```

Fetch tags first if your checkout is stale (`git fetch origin --tags`). The script runs tests/build, creates an annotated tag, atomically pushes the current branch plus tag to `origin`, then creates a **draft** GitHub release with generated notes. Review the draft before publishing. Existing releases remain unchanged; dirty trees and conflicting tags are rejected. No commits, force pushes, or automatic publication. If GitHub draft creation fails after pushing, rerun with the same explicit version.

## Engine development

The runtime has no package install or compilation step. `scripts/build.sh content .wiki-dist` assembles a site. Third-party browser libraries and their licenses are kept under `vendor/` so generated wikis work without CDN dependencies.

Checks: `node --test test/*.test.mjs`, `bash test/build.test.sh`, and `bash test/release.test.sh`. Opt-in smoke integration tests: `WIKI_BROWSER_TEST=1 node --test test/smoke.test.mjs` (requires Playwright/Chromium). Browser color regressions: run `node scripts/serve.mjs content 8080`, then open `http://localhost:8080/test/theming.browser.html` (expect `PASS` in the title).
