---
title: Markdown Cheat Sheet
summary: A short reference for the standard Markdown supported by game and wiki-guide pages.
eyebrow: Wiki guide
status: reference
---

Use frontmatter for the page title, then ordinary Markdown for its content. These examples show both the source syntax and its rendered result.

## Text

```md
**Bold**, *italic*, ~~struck through~~, and `inline code`.

[External link](https://www.example.com)
```

**Bold**, *italic*, ~~struck through~~, and `inline code`.

[External link](https://www.example.com)

## Headings and separators

The page title comes from frontmatter. Use level-two headings for major sections and level-three headings beneath them.

```md
## Major section
### Smaller section

---
```

## Lists

```md
- First item
- Second item
  - Nested item

1. Observe
2. Decide
3. Act

- [x] Proven in the prototype
- [ ] Needs playtesting
```

- First item
- Second item
  - Nested item

1. Observe
2. Decide
3. Act

- [x] Proven in the prototype
- [ ] Needs playtesting

## Quotes

```md
> A design pillar should help reject features, not merely describe them.
```

> A design pillar should help reject features, not merely describe them.

## Images

Use descriptive alternative text. Image paths currently resolve from the wiki root.

When the final image is unavailable, embed a dedicated placeholder image at the intended path and put replacement instructions inside that image—not in the page.

```md
![Simple landscape used as a Markdown example](content/wiki/examples/wiki-image.svg)
```

![Simple landscape used as a Markdown example](content/wiki/examples/wiki-image.svg)

## Tables

```md
| State | Meaning |
| --- | --- |
| Proven | Supported by prototype evidence |
| Unresolved | Requires discussion or testing |
```

| State | Meaning |
| --- | --- |
| Proven | Supported by prototype evidence |
| Unresolved | Requires discussion or testing |

## Code blocks

Add a language after the opening fence for syntax highlighting.

````md
```javascript
const phase = 'planning';
```
````

```javascript
const phase = 'planning';
```

## Formulas

Use LaTeX-style delimiters for inline and display math:

```md
Probability is $P = \frac{w_i}{\sum_j w_j}$.

$$
D = B\left(1 + \frac{L}{10}\right)
$$
```

Probability is $P = \frac{w_i}{\sum_j w_j}$.

$$
D = B\left(1 + \frac{L}{10}\right)
$$

See [[Wiki/Formulas|Formula examples]] for more patterns.

## Footnotes

Reference a footnote with `[^label]` and define it anywhere in the page. Footnotes render together at the bottom with a return link.

```md
The prototype supports this conclusion.[^prototype]

[^prototype]: Record the supporting observation here.
```

The prototype supports this conclusion.[^prototype]

[^prototype]: Record the supporting observation here.

## Wiki extensions

- [[Wiki/Markdown Authoring|Markdown and navigation]] — pages, frontmatter, wiki links, and sidebar categories.
- [[Wiki/Formulas|Formula examples]] — LaTeX-style formulas rendered with KaTeX.
- [[Wiki/Diagrams|Diagram examples]] — Mermaid diagrams inside Markdown.
- [[Wiki/Code Includes|Code include examples]] — include source files, select ranges, and highlight lines.

For less common standard syntax, see the [Markdown Guide cheat sheet](https://www.markdownguide.org/cheat-sheet/).
