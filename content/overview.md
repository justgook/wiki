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

`_config.md` defines the wiki title, description, and home page. `_sidebar.md` is the navigation source of truth. All other Markdown pages and assets are project content. `custom.css` and `favicon.svg` are optional branding overrides.

The `content/` directory in this engine repository intentionally follows that shape. It is a complete example content root containing configuration, navigation, customization, pages, and example assets.

## Work locally with live content

Run this from a content repository:

```sh
make serve
```

Open [http://localhost:8080](http://localhost:8080). The server reads the current content directory directly instead of building `.wiki-dist/`. Refresh the browser to see Markdown, image, configuration, or CSS changes without rebuilding or restarting the server.

Use `make build` only when you want to inspect or publish the assembled static directory.

## Runtime features

- Markdown pages loaded directly in the browser.
- Hash-based navigation with shareable page and section links.
- Nested, collapsible sidebar categories with filtering and adjacent-page navigation.
- `[[Wiki links]]` with optional paths and visible labels.
- YAML frontmatter with `accepted`, `in-progress`, `todo`, and `reference` statuses.
- Visual document markers for decisions, open work, questions, evidence, and missing artifacts.
- Syntax-highlighted code, source-file includes, KaTeX formulas, and expandable Mermaid diagrams.
- Vendored browser libraries with no package install or CDN dependency.

## Authoring guide

- [[Markdown Authoring|Markdown and navigation]] explains pages, metadata, links, and sidebar structure.
- [[Markdown Cheat Sheet|Markdown cheat sheet]] demonstrates common text, lists, tables, quotes, images, and code.
- [[Formulas|Formula examples]] documents LaTeX-style formulas rendered with KaTeX.
- [[Diagrams|Diagram examples]] documents Mermaid syntax and the expanded diagram viewer.
- [[Code Includes|Code include examples]] documents whole-file inclusion, source ranges, and highlighted lines.
