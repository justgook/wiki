---
title: Markdown and Navigation
summary: How to add wiki pages, metadata, links, sidebar sections, and collapsible categories.
eyebrow: Wiki guide
status: reference
---

## Add a page

Create a Markdown file anywhere under `content/`. Every rendered page requires YAML frontmatter with a non-empty `title`:

```md
---
title: Example Page
summary: A short description shown below the title.
eyebrow: Game design
status: in-progress
---

Page content starts here.
```

Quote YAML values containing a colon followed by a space:

```yaml
summary: "Loop structure: observe, decide, act, and respond."
```

Every page must use one of four statuses:

- `accepted` — canonical enough to build against;
- `in-progress` — contains useful direction and unresolved parts;
- `todo` — required but not designed yet;
- `reference` — stable authoring or supporting material.

## Document markers

Use a marker blockquote at the beginning of a section or immediately before the statement it classifies:

```md
> **Accepted** — The campaign uses authored stages.

> **In progress** — The death cycle has direction but incomplete rules.

> **Open question** — Which upgrades transfer between characters?

> **TODO** — Define the first boss after the representative encounter works.

> **Needs evidence** — Validate this claim with a playtest.

> **Needs diagram** — Diagram the death and recovery loop.

> **Needs example** — Show the same encounter played by two characters.
```

These exact labels receive strong visual treatment. Page status reports the page as a whole; markers distinguish accepted documentation from unresolved work inside it.

Do not use a marker or prose note for a missing image. Embed a dedicated placeholder image whose contents describe the required replacement.

## Wiki links

Link using the page path without `content/` or `.md`:

```md
[[Gameplay/Core Loop]]
[[Gameplay/Core Loop|Read about the core loop]]
```

Targets are converted to lowercase kebab-case paths. `[[Gameplay/Core Loop]]` resolves to `content/gameplay/core-loop.md`.

Ordinary Markdown links continue to work for external URLs:

```md
[Mermaid documentation](https://mermaid.js.org/)
```

## Direct section links

Every level-two and level-three heading appears under **On this page**. Selecting one updates the URL and scrolls to the heading, so the URL can be copied to link directly to that section:

```text
#/wiki/markdown-authoring?section=sidebar-structure
```

Heading links remain stable while the heading text stays the same. Duplicate heading names receive `-2`, `-3`, and later suffixes.

## Sidebar structure

The sidebar is authored in `content/_sidebar.md`.

- Level-two headings become section separators.
- Top-level list items become pages or categories.
- A top-level item with nested pages becomes collapsible.
- Every collapsible category must link to its own content page.
- Opening or navigating into one category collapses the others.

```md
## Game design

- [[Gameplay/Overview|Gameplay]]
  - [[Gameplay/Core Loop|Core loop]]
  - [[Gameplay/Mechanics|Mechanics]]
```

Keep the **Wiki guide** section at the bottom so documentation about the wiki remains separate from documentation about the game.

## Code blocks

Ordinary fenced blocks receive syntax highlighting:

````md
```javascript
const phase = 'planning';
```
````

See the [[Wiki/Markdown Cheat Sheet|Markdown cheat sheet]] for more rendered examples. For diagrams and external source files, see [[Wiki/Diagrams]] and [[Wiki/Code Includes]].

## Generated navigation behavior

The sidebar starts with every category collapsed. Navigating directly to a category or one of its children expands that category. The current page receives the active treatment and adjacent-page navigation is derived from sidebar order.

Filtering opens every category containing a result, hides non-matching pages, and highlights the matching part of each page label. Clearing the filter restores the category containing the current page.
