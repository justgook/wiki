# Wiki

A no-build, offline-capable Markdown wiki. The repository includes the runtime and a deployed authoring guide that doubles as its demo.

## Run

```sh
python3 -m http.server 8080
```

Open <http://localhost:8080>.

A local HTTP server is required because browsers do not allow `fetch()` to read Markdown reliably from `file://` URLs. There is no build, dependency install, or generated content.

## Use in another repository

Keep the runtime files together at the served wiki root:

- `app.js`
- `index.html`
- `style.css`
- `vendor/`

Provide the consuming site's own:

- `content/_config.md`
- `content/_sidebar.md`
- Markdown pages under `content/`
- `custom.css`
- `favicon.svg`

These files may be symlinked from this repository when it is checked out as a Git submodule.

## Authoring

- Every page requires YAML frontmatter with a `title` and a status: `accepted`, `in-progress`, `todo`, or `reference`.
- `content/_sidebar.md` defines navigation using Markdown headings, lists, and wiki links.
- `content/_config.md` requires the wiki title, description, and home page.
- Wiki links use `[[Page Name]]` or `[[target/path|Visible label]]`.
- Formulas use KaTeX `$...$` or `$$...$$` delimiters.
- Mermaid diagrams use fenced `mermaid` blocks.
- Code includes use VuePress-compatible `@[code](path)` syntax and must stay inside `content/`.

See the deployed **Wiki guide** for the complete authoring reference.

## Vendored libraries

The `vendor/` directory keeps Marked, js-yaml, Highlight.js, marked-footnote, KaTeX, marked-katex-extension, and Mermaid local so the wiki remains usable offline. Third-party license files are stored alongside the relevant libraries.

## Deployment

`.github/workflows/pages.yml` deploys the static repository to GitHub Pages whenever `release` is updated. Enable GitHub Actions as the Pages source in the repository settings.
