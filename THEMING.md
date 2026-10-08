# Theming

Override `:root` tokens in content-root `custom.css`. Engine files stay untouched.
Set native `color-scheme: light` or `dark`; Mermaid follows. `light dark` follows OS preference.
CSS colors accepted: hex, names, rgb(), hsl(), color-mix(), etc. Mermaid gets opaque sRGB hex; alpha composited over diagram surface. Reload after edits.

```css
:root {
  color-scheme: dark;
  --bg: #352b40;
  --surface: color-mix(in srgb, var(--bg) 96%, #f0e9c9);
  --surface-raised: color-mix(in srgb, var(--bg) 90%, #f0e9c9);
  --text: #f0e9c9;
  --prose-text: var(--text);
  --accent: #dacb80;
  --accent-ink: var(--bg);
  --secondary: #99d4e6;
  --syntax-string: #76c379;
  --chart-1: #76c379;
}
```

## UI

| Token | Role |
| --- | --- |
| `--bg` | Page/viewer background |
| `--surface` | Sidebar, cards, table headers, math panels |
| `--surface-raised` | Hover states, inline code |
| `--border` | Subtle dividers |
| `--border-strong` | Strong borders, controls |
| `--text` | Headings, primary text |
| `--prose-text` | Body copy |
| `--muted` | Descriptions, secondary text |
| `--faint` | Labels, outline, line numbers; check contrast |
| `--accent` | Active links, accepted status, highlighted lines |
| `--accent-ink` | Text on accent backgrounds |
| `--secondary` | Secondary emphasis |
| `--blue` | Links, progress state; legacy alias of secondary |
| `--danger` | Errors |
| `--warning` | TODO, open questions |
| `--evidence` | Needs evidence/image/diagram/example |
| `--backdrop` | Fullscreen diagram overlay; alpha allowed |
| `--sidebar-shadow` | Mobile sidebar shadow color |
| `--focus-ring` | Keyboard focus outline |
| `--selection-bg` | Selected text background |
| `--selection-text` | Selected text foreground |
| `--marker-color` | Local callout override; normally set by marker class |

## Code

Fenced blocks + source includes. Inline code uses UI tokens.

| Token | Role |
| --- | --- |
| `--syntax-bg` | Code panel background |
| `--syntax-text` | Plain code, substitutions |
| `--syntax-comment` | Comments, formulas |
| `--syntax-keyword` | Keywords, types, template variables |
| `--syntax-title` | Functions, classes |
| `--syntax-literal` | Numbers, booleans, attributes, operators, variables |
| `--syntax-string` | Strings, regex |
| `--syntax-symbol` | Built-ins, symbols |
| `--syntax-tag` | Markup names, selectors, quotes |
| `--syntax-section` | Section headings |
| `--syntax-bullet` | Bullets |
| `--syntax-addition-text` | Diff added text |
| `--syntax-addition-bg` | Diff added background |
| `--syntax-deletion-text` | Diff removed text |
| `--syntax-deletion-bg` | Diff removed background |

## Diagrams + charts

Mermaid flow/sequence/state/class/ER diagrams inherit UI defaults. Override independently below.
Mermaid pie/XY charts consume categorical palette; color scales share it. Eight colors; pie slices 9–12 repeat 1–4. Custom renderers opt in with `var(--chart-N)` or `getComputedStyle()`; no automatic third-party chart theming. Mermaid-specific inline theme/style directives can override defaults.

| Token | Role / default |
| --- | --- |
| `--diagram-bg` | Diagram panel / surface |
| `--diagram-node-bg` | Node fill / raised surface |
| `--diagram-border` | Node/panel stroke / strong border |
| `--diagram-text` | Labels / text |
| `--diagram-muted` | Secondary/edge labels / muted |
| `--diagram-faint` | Actor lifelines / faint |
| `--diagram-line` | Connectors, chart axes / muted |
| `--diagram-accent` | Arrowheads, activations / accent |
| `--diagram-accent-ink` | Accent-node/pie-slice text / accent ink |
| `--diagram-font-size` | Mermaid labels / 15px |
| `--chart-1` | Series 1 / accent |
| `--chart-2` | Series 2 / secondary |
| `--chart-3` | Series 3 / evidence |
| `--chart-4` | Series 4 / warning |
| `--chart-5` | Series 5 / danger |
| `--chart-6` | Series 6 / green |
| `--chart-7` | Series 7 / orange |
| `--chart-8` | Series 8 / pale blue |

Custom graph/schema renderers: reuse diagram roles. Mermaid ER/class diagrams supported; no separate schema-file renderer. Images/PNG snapshots cannot inherit theme colors. SVG diagrams can; Mermaid derives some diagram-specific details itself.

## Fonts + layout

| Token | Role / default |
| --- | --- |
| `--font-sans` | UI, prose, diagrams / system sans |
| `--font-mono` | Code, labels / system mono |
| `--topbar-height` | Header height / 56px |
| `--sidebar-width` | Desktop navigation / 280px |
| `--outline-width` | Desktop section outline / 220px; 0 below 1080px |
| `--content-width` | Article max width / 760px |

Need different spacing/radii? Override selectors. Tokens cover colors, fonts, major layout—not every CSS dimension. Favicon separate `favicon.svg`. Check text contrast; palette choice alone guarantees nothing.
