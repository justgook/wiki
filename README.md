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
- Custom theming through `custom.css` and `favicon.svg`.
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
favicon.svg      # optional site override
Makefile         # optional local preview command
.github/workflows/pages.yml
```

Every Markdown page requires YAML frontmatter with a `title` and a status: `accepted`, `in-progress`, `todo`, or `reference`. `_sidebar.md` defines navigation; `_config.md` defines the wiki title, description, home page, and optional content extensions.

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

It validates `_config.md` and `_sidebar.md`, copies public content, applies optional `custom.css` and `favicon.svg`, and returns the absolute generated directory as the `path` output. Dotfiles, `.github/`, `Makefile`, and local wiki folders are not published as content.

## Preview locally

Copy this repository's `Makefile` into a content repository, then run:

```sh
make serve
```

On first use it downloads the engine into `.wiki-engine/`, then serves the current content directly at <http://localhost:8080>. Markdown, images, `custom.css`, and `favicon.svg` remain live: refresh the browser to see edits without rebuilding or restarting the server. It uses Bun, Node.js, Python 3, or Python—whichever is available in that order.

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

## Migrating a submodule-based wiki

For a repository like `justgook/imprint-zero`:

1. Move everything under `content/` to the repository root.
2. Remove the `core` submodule, `.gitmodules`, and engine symlinks (`app.js`, `index.html`, `style.css`, and `vendor`).
3. Keep `custom.css` and `favicon.svg` at the root.
4. Copy this `Makefile`, add the two ignored directories above, and use the publishing workflow shown above.

## Authoring guide

The [deployed Wiki guide](https://justgook.github.io/wiki/) documents page metadata, navigation, `[[Wiki links]]`, Markdown syntax, KaTeX formulas, Mermaid diagrams, and VuePress-compatible `@[code](path)` includes. It is built from this repository's `content/` directory using the same action available to consuming repositories.

## Engine development

The runtime has no package install or compilation step. `scripts/build.sh content .wiki-dist` assembles a site. Third-party browser libraries and their licenses are kept under `vendor/` so generated wikis work without CDN dependencies.
