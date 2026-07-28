---
title: Code Include Examples
summary: Working examples for including complete files, selected source lines, and highlighted lines in Markdown.
eyebrow: Wiki reference
status: reference
---

Code is stored beside the documentation and fetched when the page is rendered. Paths are relative to this Markdown file and cannot escape the `content/` directory.

## Complete file

The language is inferred from the `.js` extension:

@[code](./examples/encounter-state.js)

## Selected source lines

The `{11-21}` range after `code` includes only source lines 11 through 21:

@[code{11-21} javascript](./examples/encounter-state.js)

## Highlighted lines

The first range selects source lines 16 through 29. The `{2,4-6}` after the language highlights displayed lines 2 and 4 through 6, corresponding to original source lines 17 and 19 through 21.

@[code{16-29} javascript{2,4-6}](./examples/encounter-state.js)

## Syntax reference

```md
@[code](./examples/encounter-state.js)
@[code{11-21} javascript](./examples/encounter-state.js)
@[code{16-29} javascript{2,4-6}](./examples/encounter-state.js)
```

Missing files, invalid ranges, absolute paths, and paths outside `content/` fail visibly.
