---
title: Using the Wiki Engine
summary: Build, publish, or bootstrap a no-build Markdown wiki from plain files.
eyebrow: Wiki guide
status: reference
---

This site is both the authoring guide and a working example of the wiki engine. Its pages are plain Markdown from this repository's `content/` directory—the same structure a separate project can use without copying or vendoring the runtime.

The engine does not compile Markdown into HTML. It provides a small browser runtime that loads Markdown directly, builds navigation from `_sidebar.md`, and renders each page on demand. Build commands only assemble the runtime and public content into a directory that any static HTTP server can host.

## Three ways to use the engine

### Publish a content repository with GitHub Actions

Keep the repository focused on Markdown, images, and wiki configuration. The reusable `justgook/wiki` action adds the runtime and produces the publishable directory consumed by the GitHub Pages deployment steps. No engine submodule or generated site needs to be committed.

This is the recommended mode for a living project wiki that should be published automatically whenever its content changes.

### Build a portable static wiki

Add the project's `Makefile` to a content repository and run:

```sh
make build
```

The command downloads the engine when necessary and assembles a complete site under `.wiki-dist/`. That directory can be published with any static host, copied to another machine, or archived as an offline-capable snapshot.

### Bootstrap a standalone wiki

A generated `.wiki-dist/` can itself become the wiki root. Runtime files live at its top level, while editable Markdown and assets live under `.wiki-dist/content/`. Add or change those files directly and serve the directory with any static HTTP server.

This mode is useful when you want the engine to act as an installer or scaffold rather than maintain a separate content-to-build workflow.

## Content repository structure

A content repository keeps its wiki source directly at the repository root:

```text
_config.md
_sidebar.md
overview.md
custom.css
favicon.svg
images/
```

`_config.md` defines the wiki title, description, and home page. `_sidebar.md` is the navigation source of truth. All other Markdown pages and assets are project content. `custom.css`, `custom.js`, and `favicon.svg` are optional site overrides.

The `content/` directory in this engine repository intentionally follows that shape. It is a complete example content root containing configuration, navigation, customization, pages, and example assets.

## Work locally with live content

Run this from a content repository:

```sh
make serve
```

Open [http://localhost:8080](http://localhost:8080). The server reads the current content directory directly instead of building `.wiki-dist/`. Refresh the browser to see Markdown, image, configuration, or CSS changes without rebuilding or restarting the server.

Use `make build` only when you want to inspect or publish the assembled static directory.

## Check content before publishing

Run fast validation with Node.js 22 or newer:

```sh
make validate
make validate VALIDATE_FLAGS=--strict
```

The validator reuses the wiki engine's parsing and rendering rules to check metadata, navigation, internal links and sections, local files/images, code includes, formulas, and custom content. Errors fail the command; warnings fail only with `--strict`. Browser-dependent custom code produces a warning because it cannot be fully checked in Node.

`make build` and the GitHub Action automatically validate the assembled content before publishing. Browser tests are **never automatic**. For an occasional deeper check, install optional Playwright and Chromium in the engine directory (`.wiki-engine/` in a content repository), then opt in:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
# Return to your content repository:
make validate VALIDATE_FLAGS=--browser
```

This exercises the real app in a temporary local browser, including Mermaid, custom hooks, filtering, section links, pagination, and diagram controls. Normal validation needs none of those browser dependencies.

## Runtime features

- Markdown pages loaded directly in the browser.
- Hash-based navigation with shareable page and section links.
- Nested, collapsible sidebar categories with filtering and adjacent-page navigation.
- `[[Wiki links]]` with optional paths and visible labels.
- YAML frontmatter with `accepted`, `in-progress`, `todo`, and `reference` statuses by default; optional `custom.js` can add or replace statuses.
- Visual document markers for decisions, open work, questions, evidence, and missing artifacts.
- Syntax-highlighted code, source-file includes, KaTeX formulas, and expandable Mermaid diagrams.
- Vendored browser libraries with no package install or CDN dependency.

## Authoring guide

- [[Markdown Authoring|Markdown and navigation]] explains pages, metadata, links, and sidebar structure.
- [[Markdown Cheat Sheet|Markdown cheat sheet]] demonstrates common text, lists, tables, quotes, images, and code.
- [[Formulas|Formula examples]] documents LaTeX-style formulas rendered with KaTeX.
- [[Diagrams|Diagram examples]] documents Mermaid syntax and the expanded diagram viewer.
- [[Code Includes|Code include examples]] documents whole-file inclusion, source ranges, and highlighted lines.
