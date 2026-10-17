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

By default, every page must use one of four statuses:

- `accepted` — canonical enough to build against;
- `in-progress` — contains useful direction and unresolved parts;
- `todo` — required but not designed yet;
- `reference` — stable authoring or supporting material.

A content repository may add statuses with `registerStatus("under-review")` or replace the defaults with `setStatuses(["draft", "published"])` from an optional root `custom.js` default export. New status colors can be set in `custom.css` using `.status-under-review`. See the README for the full site JavaScript example.

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

### Extended content links

Projects may register trusted browser-side renderers for additional text formats in `_config.md`:

```yaml
extensions:
  - wiki-extensions/gettext.js
```

Keep the registered extension in links to those files:

```md
[[Game Text/Dialogue.po|Dialogue]]
```

Unlike Markdown page targets, extended file paths are preserved rather than converted to kebab case. Extension modules run as trusted project code and must remain inside the content directory. See the repository README for the renderer API.

## Direct section links

Every level-two and level-three heading appears under **On this page**. Selecting one updates the URL and scrolls to the heading, so the URL can be copied to link directly to that section:

```text
#/markdown-authoring?section=sidebar-structure
```

Link to a heading on another page with `#` after the page target. The wiki turns that fragment into the same `?section=` route used by **On this page**:

```md
[[Markdown Authoring#Sidebar structure|Sidebar structure]]
[[Markdown Authoring?section=sidebar-structure|Sidebar structure]]
```

Both links open `#/markdown-authoring?section=sidebar-structure`. If the target also has renderer query parameters, put them before the fragment (for example, `[[Game Text/Dialogue.po?entry=example#Notes|Notes]]`). A fragment takes precedence over an existing `section` query parameter. Heading links remain stable while the heading text stays the same. Duplicate heading names receive `-2`, `-3`, and later suffixes.

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

## Live remote subwiki mounts

A parent wiki can mount a trusted public site running the same engine. Add this to the parent's `_config.md` (at the content root):

```yaml
subwikis:
  engine: {url: https://example.github.io/engine-wiki/}
```

Add the mount as a top-level entry in the parent's `_sidebar.md`, without manual child entries:

```md
- [[engine|Engine documentation]]
```

The ID `engine` reserves the local route prefix: do not also create local pages or directories under that name. A remote page such as `architecture.md` opens at `#/engine/architecture`. You can link to it from a parent page with `[[engine/architecture|Engine architecture]]`. Direct deep links are supported even before the mount's sidebar has been expanded.

Remote sidebar navigation loads lazily on expansion. Pages are fetched live in the browser, so publishing remote changes does not require rebuilding the parent; normal browser caching still applies. Navigation and configuration are cached for the session; reload the parent to refresh them. A failed remote request stays isolated to the mount and offers a retry rather than breaking local content.

### Links, resources, and rendering

- Inside a mounted page, Markdown wiki links are scoped to that child: `[[Architecture]]` stays in `#/engine/architecture`, not the parent's local wiki.
- Relative resources resolve from the remote site root, following the existing engine convention. Code includes are different: `@[code](path)` resolves relative to the remote page.
- The parent's theme, installed renderers, and statuses apply. Remote `custom.js`, extensions, and styles are not loaded. The parent must install any renderers or statuses the child needs.

### Trust and limits

**Remote HTML is trusted, not sandboxed. Arbitrary third-party sites are unsafe to mount.** Use only trusted public sites running the same engine. Cross-origin fetching requires CORS on the remote host; GitHub Pages typically allows it.

Only one level of mounts is supported; a child that declares nested mounts is rejected. Remote content has no offline availability promise and is not covered by full-text search. Sidebar filtering only filters navigation labels. Offline validators skip remote content checks: local validation does not verify remote pages, their links, or their resources.

## Code blocks

Ordinary fenced blocks receive syntax highlighting:

````md
```javascript
const phase = 'planning';
```
````

See the [[Markdown Cheat Sheet|Markdown cheat sheet]] for more rendered examples. For diagrams and external source files, see [[Diagrams]] and [[Code Includes]].

## Generated navigation behavior

The sidebar starts with every category collapsed. Navigating directly to a category or one of its children expands that category. The current page receives the active treatment and adjacent-page navigation is derived from sidebar order.

Filtering opens every category containing a result, hides non-matching pages, and highlights the matching part of each page label. Clearing the filter restores the category containing the current page.
