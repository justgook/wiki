---
title: Using This Wiki
summary: Authoring reference and examples for the no-build Markdown wiki.
eyebrow: Wiki guide
status: reference
---

This deployed guide documents the wiki runtime and demonstrates its authoring features.

## What the wiki provides

- Markdown pages loaded directly in the browser without a build step.
- Hash-based navigation, shareable links to page sections, and nested collapsible sidebar categories.
- `[[Wiki links]]` between pages.
- YAML frontmatter with enforced page statuses: accepted, in-progress, todo, or reference.
- Visually distinct document markers for accepted decisions, open work, questions, evidence, and missing artifacts.
- Syntax-highlighted fenced code blocks.
- Mermaid diagrams authored inside Markdown.
- Source files included as code blocks, with ranges and highlighted lines.

## Guide pages

- [[Wiki/Content Style Guide|Content style guide]] defines the preferred order for presenting information: chart, schema, image, table, formula, then text.
- [[Wiki/Markdown Authoring|Markdown and navigation]] explains pages, metadata, links, and sidebar structure.
- [[Wiki/Markdown Cheat Sheet|Markdown cheat sheet]] demonstrates common text, list, table, quote, and code syntax.
- [[Wiki/Formulas|Formula examples]] documents LaTeX-style inline and display math rendered with KaTeX.
- [[Wiki/Diagrams|Diagram examples]] documents Mermaid syntax with rendered examples.
- [[Wiki/Code Includes|Code include examples]] documents whole-file inclusion, source ranges, and highlighted lines.

## Run locally

From the repository root:

```sh
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). A local HTTP server is required because the browser fetches Markdown and included source files at runtime.

## Demo content

The **Wiki guide** is the runtime repository's complete demo content. Consuming sites provide their own `content/`, `custom.css`, and branding. Example source files used by this guide live under `content/wiki/examples/`.
