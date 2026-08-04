/*
 * Game wiki.
 * Markdown files are the source of truth; there is no generated index or build step.
 */

const elements = {
    article: requiredElement("#article"),
    brand: requiredElement("#brand"),
    diagramCanvas: requiredElement("#diagram-canvas"),
    diagramClose: requiredElement("#diagram-close"),
    diagramDialog: requiredElement("#diagram-dialog"),
    diagramFit: requiredElement("#diagram-fit"),
    diagramTitle: requiredElement("#diagram-dialog-title"),
    diagramViewport: requiredElement("#diagram-viewport"),
    diagramZoomIn: requiredElement("#diagram-zoom-in"),
    diagramZoomLevel: requiredElement("#diagram-zoom-level"),
    diagramZoomOut: requiredElement("#diagram-zoom-out"),
    filter: requiredElement("#nav-filter"),
    main: requiredElement("#main"),
    outline: requiredElement("#outline-links"),
    pagination: requiredElement("#page-pagination"),
    sidebar: requiredElement("#sidebar"),
    sidebarToggle: requiredElement("#sidebar-toggle"),
    tree: requiredElement("#tree"),
}

let config
let pageLinks = []
let currentPage = ""
let diagramView
let diagramCloneID = 0

const DIAGRAM_MIN_SCALE = 0.1
const DIAGRAM_MAX_SCALE = 8
const DIAGRAM_ZOOM_STEP = 1.25

const PAGE_STATUSES = new Set(["accepted", "in-progress", "todo", "reference"])
const DOCUMENT_MARKERS = new Map([
    ["Accepted", "accepted"],
    ["In progress", "in-progress"],
    ["TODO", "todo"],
    ["Open question", "open-question"],
    ["Needs evidence", "needs-evidence"],
    ["Needs image", "needs-image"],
    ["Needs diagram", "needs-diagram"],
    ["Needs example", "needs-example"],
])

function requiredElement(selector) {
    const element = document.querySelector(selector)
    if (!element) throw new Error(`Required element is missing: ${selector}`)
    return element
}

function escapeHTML(value) {
    const node = document.createElement("span")
    node.textContent = String(value)
    return node.innerHTML
}

function parseFrontmatter(raw, source) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!match) return { data: {}, content: raw }
    const data = jsyaml.load(match[1])
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error(`Frontmatter must be an object: ${source}`)
    }
    return { data, content: match[2] }
}

async function fetchText(path) {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`)
    return response.text()
}

function pageSlug(target) {
    const segments = target.trim().replace(/\.md$/i, "").split("/")
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
        throw new Error(`Invalid wiki page target: ${target}`)
    }
    return segments
        .map((segment) =>
            segment
                .toLowerCase()
                .replace(/['’]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, ""),
        )
        .join("/")
}

function pageURL(target) {
    return `#/${pageSlug(target)}`
}

function setupMarkdown() {
    marked.setOptions({ gfm: true, breaks: false, pedantic: false })
    marked.use(markedFootnote({ refMarkers: true, footnoteDivider: true }))
    marked.use(markedKatex({ throwOnError: true, strict: "error", trust: false }))

    const renderer = new marked.Renderer()
    renderer.code = (code, language) => {
        const source = typeof code === "object" ? code.text : code
        const lang = typeof code === "object" ? code.lang : language
        if (lang === "mermaid") {
            return `<div class="mermaid">${escapeHTML(source)}</div>`
        }
        const highlighted = highlightSource(source, lang)
        return `<pre><code class="hljs language-${escapeHTML(lang || "")}">${highlighted}</code></pre>`
    }

    marked.use({
        renderer,
        extensions: [
            {
                name: "wikilink",
                level: "inline",
                start(source) {
                    return source.indexOf("[[")
                },
                tokenizer: tokenizeWikilink,
                renderer(token) {
                    const slug = pageSlug(token.target)
                    return `<a class="wiki-link" data-page="${escapeHTML(slug)}" href="#/${escapeHTML(slug)}">${escapeHTML(token.label)}</a>`
                },
            },
        ],
    })
}

function renderMarkdown(markdown) {
    return marked.parse(prepareMarkdown(markdown))
}

function highlightSource(source, language) {
    return language && hljs.getLanguage(language)
        ? hljs.highlight(source, { language, ignoreIllegals: true }).value
        : hljs.highlightAuto(source).value
}

function parseLineRange(spec, lineCount, description) {
    if (!spec) return { start: 1, end: lineCount }
    const match = /^(\d+)(?:-(\d+))?$/.exec(spec)
    if (!match) throw new Error(`Invalid ${description} range: ${spec}`)
    const start = Number(match[1])
    const end = Number(match[2] || match[1])
    if (start < 1 || end < start || end > lineCount) {
        throw new Error(`${description} range ${spec} is outside 1-${lineCount}`)
    }
    return { start, end }
}

function parseHighlightedLines(spec, displayedLineCount) {
    const highlighted = new Set()
    if (!spec) return highlighted
    for (const part of spec.split(",")) {
        const { start, end } = parseLineRange(part.trim(), displayedLineCount, "highlight")
        for (let line = start; line <= end; line += 1) highlighted.add(line)
    }
    return highlighted
}

function resolveIncludePath(rawPath, pagePath) {
    const includePath = rawPath.trim()
    if (!includePath || includePath.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(includePath)) {
        throw new Error(`Code include path must be relative: ${rawPath}`)
    }

    const contentRoot = new URL("content/", location.href)
    const pageURL = new URL(pagePath, location.href)
    const resolved = new URL(includePath, pageURL)
    if (resolved.origin !== contentRoot.origin || !resolved.pathname.startsWith(contentRoot.pathname)) {
        throw new Error(`Code include must stay inside content/: ${rawPath}`)
    }
    if (resolved.search || resolved.hash) throw new Error(`Code include path cannot contain query or hash: ${rawPath}`)
    return resolved
}

function inferLanguage(pathname) {
    const extension = pathname.split(".").pop().toLowerCase()
    const aliases = {
        cjs: "javascript",
        htm: "html",
        js: "javascript",
        jsx: "javascript",
        mjs: "javascript",
        py: "python",
        rs: "rust",
        sh: "bash",
        ts: "typescript",
        tsx: "typescript",
        yml: "yaml",
    }
    return aliases[extension] || extension
}

function wrapHighlightedCode(highlightedHTML, firstSourceLine, highlightedLines) {
    const openSpans = []
    return highlightedHTML
        .split("\n")
        .map((fragment, index) => {
            const inherited = openSpans.join("")
            for (const tag of fragment.match(/<span class="[^"]+">|<\/span>/g) || []) {
                if (tag === "</span>") openSpans.pop()
                else openSpans.push(tag)
            }
            const closing = "</span>".repeat(openSpans.length)
            const displayedLine = index + 1
            const sourceLine = firstSourceLine + index
            const highlighted = highlightedLines.has(displayedLine) ? " is-highlighted" : ""
            return `<span class="code-line${highlighted}" data-line="${sourceLine}">${inherited}${fragment || "&nbsp;"}${closing}</span>`
        })
        .join("")
}

async function renderCodeInclude({ path, sourceRange, language, highlightRange }, pagePath) {
    const resolved = resolveIncludePath(path, pagePath)
    const source = (await fetchText(resolved.href)).replace(/\r\n?/g, "\n")
    const lines = source.split("\n")
    const { start, end } = parseLineRange(sourceRange, lines.length, "source")
    const selected = lines.slice(start - 1, end).join("\n")
    const highlightedLines = parseHighlightedLines(highlightRange, end - start + 1)
    const codeLanguage = language || inferLanguage(resolved.pathname)
    const highlighted = highlightSource(selected, codeLanguage)
    const renderedLines = wrapHighlightedCode(highlighted, start, highlightedLines)
    const label = decodeURIComponent(resolved.pathname.slice(new URL("content/", location.href).pathname.length))
    const rangeLabel = sourceRange ? `<span>lines ${start}–${end}</span>` : ""

    return `<figure class="code-include">
<figcaption><code>${escapeHTML(label)}</code>${rangeLabel}</figcaption>
<pre><code class="hljs language-${escapeHTML(codeLanguage)}">${renderedLines}</code></pre>
</figure>`
}

async function expandCodeIncludes(markdown, pagePath) {
    const directive = /^ {0,3}@\[code(?:\{([^}]+)\})?(?:\s+([a-z0-9_+-]+)(?:\{([^}]+)\})?)?\]\(([^)\n]+)\)\s*$/i
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
    const output = []
    let fence = null

    for (const line of lines) {
        const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line)
        if (fenceMatch) {
            const marker = fenceMatch[1]
            if (!fence) fence = { character: marker[0], length: marker.length }
            else if (marker[0] === fence.character && marker.length >= fence.length) fence = null
            output.push(line)
            continue
        }

        const match = !fence && directive.exec(line)
        if (!match) {
            output.push(line)
            continue
        }

        output.push(
            await renderCodeInclude(
                {
                    sourceRange: match[1],
                    language: match[2],
                    highlightRange: match[3],
                    path: match[4],
                },
                pagePath,
            ),
        )
    }

    return output.join("\n")
}

function setupMermaid() {
    const styles = getComputedStyle(document.documentElement)
    const wikiValue = (name) => {
        const value = styles.getPropertyValue(name).trim()
        if (!value) throw new Error(`Wiki theme requires the “${name}” CSS custom property`)
        return value
    }
    const wikiColor = (name) => {
        const value = wikiValue(name)
        if (!/^#[0-9a-f]{6}$/i.test(value)) {
            throw new Error(`Wiki theme property “${name}” must be a six-digit hex color`)
        }
        return value
    }

    const colors = {
        background: wikiColor("--bg"),
        surface: wikiColor("--surface"),
        raised: wikiColor("--surface-raised"),
        borderStrong: wikiColor("--border-strong"),
        text: wikiColor("--text"),
        muted: wikiColor("--muted"),
        faint: wikiColor("--faint"),
        accent: wikiColor("--accent"),
        accentInk: wikiColor("--accent-ink"),
    }
    const fontFamily = wikiValue("--font-sans")

    mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily,
        themeVariables: {
            darkMode: true,
            background: colors.surface,
            fontFamily,
            fontSize: "15px",
            primaryColor: colors.raised,
            primaryTextColor: colors.text,
            primaryBorderColor: colors.borderStrong,
            secondaryColor: colors.accent,
            secondaryTextColor: colors.accentInk,
            secondaryBorderColor: colors.accent,
            tertiaryColor: colors.background,
            tertiaryTextColor: colors.muted,
            tertiaryBorderColor: colors.borderStrong,
            lineColor: colors.muted,
            textColor: colors.text,
            mainBkg: colors.raised,
            nodeBorder: colors.borderStrong,
            nodeTextColor: colors.text,
            clusterBkg: colors.background,
            clusterBorder: colors.borderStrong,
            edgeLabelBackground: colors.surface,
            noteBkgColor: colors.raised,
            noteTextColor: colors.text,
            noteBorderColor: colors.accent,
            actorBkg: colors.raised,
            actorBorder: colors.borderStrong,
            actorTextColor: colors.text,
            actorLineColor: colors.faint,
            signalColor: colors.muted,
            signalTextColor: colors.text,
            labelBoxBkgColor: colors.surface,
            labelBoxBorderColor: colors.borderStrong,
            labelTextColor: colors.text,
            loopTextColor: colors.text,
            activationBkgColor: colors.accent,
            activationBorderColor: colors.accent,
            labelColor: colors.text,
            altBackground: colors.background,
        },
        themeCSS: `
      .node rect, .node circle, .node ellipse, .node polygon, .node path {
        stroke-width: 1.25px;
      }
      .node rect, .cluster rect, .actor, .labelBox {
        rx: 6px;
        ry: 6px;
      }
      .nodeLabel, .actor text, .stateLabel text {
        font-weight: 600;
      }
      .cluster-label text, .cluster-label span {
        color: ${colors.muted} !important;
        fill: ${colors.muted} !important;
        font-weight: 600;
      }
      .edgeLabel, .edgeLabel p {
        background-color: ${colors.surface} !important;
        color: ${colors.muted} !important;
      }
      .edgeLabel rect {
        fill: ${colors.surface} !important;
        opacity: 1 !important;
      }
      marker path {
        fill: ${colors.accent} !important;
        stroke: ${colors.accent} !important;
      }
    `,
    })
}

async function renderDiagrams() {
    const nodes = [...elements.article.querySelectorAll(".mermaid")]
    if (nodes.length === 0) return
    await mermaid.run({ nodes, suppressErrors: false })
    nodes.forEach(setupExpandableDiagram)
}

function setupExpandableDiagram(diagram) {
    const svg = diagram.querySelector(":scope > svg")
    if (!svg) throw new Error("Mermaid did not render an SVG diagram")

    const button = document.createElement("button")
    button.type = "button"
    button.className = "diagram-expand"
    button.textContent = "Expand"
    button.setAttribute("aria-label", "Open diagram in fullscreen viewer")
    button.addEventListener("click", () => openDiagramViewer(svg, button))
    diagram.append(button)
}

function diagramTitleFor(svg) {
    const prose = svg.closest(".prose")
    if (!prose) throw new Error("Rendered Mermaid diagram must be inside .prose")
    const headings = [...prose.querySelectorAll("h2, h3, h4")]
    const heading = headings.findLast(
        (candidate) => candidate.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING,
    )
    return heading ? heading.textContent : "Expanded diagram"
}

function cloneDiagramSVG(source) {
    const clone = source.cloneNode(true)
    const prefix = `diagram-viewer-${++diagramCloneID}-`
    const idMap = new Map()

    ;[clone, ...clone.querySelectorAll("[id]")].forEach((element) => {
        if (!element.id) return
        const replacement = `${prefix}${element.id}`
        idMap.set(element.id, replacement)
        element.id = replacement
    })

    ;[clone, ...clone.querySelectorAll("*")].forEach((element) => {
        ;[...element.attributes].forEach((attribute) => {
            let value = attribute.value
            idMap.forEach((replacement, original) => {
                value = value.replaceAll(`url(#${original})`, `url(#${replacement})`)
                if (value === `#${original}`) value = `#${replacement}`
            })
            if (attribute.name.startsWith("aria-")) {
                value = value
                    .split(/\s+/)
                    .map((token) => idMap.get(token) || token)
                    .join(" ")
            }
            element.setAttribute(attribute.name, value)
        })
    })
    clone.querySelectorAll("style").forEach((style) => {
        let css = style.textContent
        idMap.forEach((replacement, original) => {
            css = css.replaceAll(`#${original}`, `#${replacement}`)
        })
        style.textContent = css
    })

    clone.removeAttribute("style")
    clone.setAttribute("width", "100%")
    clone.setAttribute("height", "100%")
    return clone
}

function openDiagramViewer(source, opener) {
    if (elements.diagramDialog.open) throw new Error("Diagram viewer is already open")
    const viewBox = source.viewBox.baseVal
    if (!(viewBox.width > 0) || !(viewBox.height > 0)) {
        throw new Error("Rendered Mermaid diagram requires a positive viewBox")
    }

    const svg = cloneDiagramSVG(source)
    elements.diagramCanvas.replaceChildren(svg)
    elements.diagramCanvas.style.width = `${viewBox.width}px`
    elements.diagramCanvas.style.height = `${viewBox.height}px`
    elements.diagramTitle.textContent = diagramTitleFor(source)
    diagramView = {
        width: viewBox.width,
        height: viewBox.height,
        scale: 1,
        x: 0,
        y: 0,
        opener,
        pointer: undefined,
    }

    document.body.classList.add("diagram-viewer-open")
    elements.diagramDialog.showModal()
    requestAnimationFrame(() => {
        fitDiagramViewer()
        elements.diagramViewport.focus()
    })
}

function requireDiagramView() {
    if (!diagramView) throw new Error("Diagram viewer is not open")
    return diagramView
}

function applyDiagramTransform() {
    const view = requireDiagramView()
    elements.diagramCanvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
    elements.diagramZoomLevel.value = `${Math.round(view.scale * 100)}%`
}

function fitDiagramViewer() {
    const view = requireDiagramView()
    const width = elements.diagramViewport.clientWidth
    const height = elements.diagramViewport.clientHeight
    if (!(width > 0) || !(height > 0)) throw new Error("Diagram viewport has no usable size")

    const padding = Math.min(48, width / 10, height / 10)
    view.scale = Math.min((width - padding * 2) / view.width, (height - padding * 2) / view.height, 1)
    view.x = (width - view.width * view.scale) / 2
    view.y = (height - view.height * view.scale) / 2
    applyDiagramTransform()
}

function zoomDiagramViewer(factor, clientX, clientY) {
    const view = requireDiagramView()
    const bounds = elements.diagramViewport.getBoundingClientRect()
    const anchorX = clientX === undefined ? bounds.width / 2 : clientX - bounds.left
    const anchorY = clientY === undefined ? bounds.height / 2 : clientY - bounds.top
    const scale = Math.min(DIAGRAM_MAX_SCALE, Math.max(DIAGRAM_MIN_SCALE, view.scale * factor))
    const diagramX = (anchorX - view.x) / view.scale
    const diagramY = (anchorY - view.y) / view.scale
    view.x = anchorX - diagramX * scale
    view.y = anchorY - diagramY * scale
    view.scale = scale
    applyDiagramTransform()
}

function setupDiagramViewer() {
    elements.diagramClose.addEventListener("click", () => elements.diagramDialog.close())
    elements.diagramFit.addEventListener("click", fitDiagramViewer)
    elements.diagramZoomIn.addEventListener("click", () => zoomDiagramViewer(DIAGRAM_ZOOM_STEP))
    elements.diagramZoomOut.addEventListener("click", () => zoomDiagramViewer(1 / DIAGRAM_ZOOM_STEP))

    elements.diagramViewport.addEventListener(
        "wheel",
        (event) => {
            event.preventDefault()
            zoomDiagramViewer(Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY)
        },
        { passive: false },
    )

    elements.diagramViewport.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return
        const view = requireDiagramView()
        view.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
        elements.diagramViewport.setPointerCapture(event.pointerId)
        elements.diagramViewport.classList.add("is-panning")
    })
    elements.diagramViewport.addEventListener("pointermove", (event) => {
        const view = requireDiagramView()
        if (!view.pointer || view.pointer.id !== event.pointerId) return
        view.x += event.clientX - view.pointer.x
        view.y += event.clientY - view.pointer.y
        view.pointer.x = event.clientX
        view.pointer.y = event.clientY
        applyDiagramTransform()
    })
    const finishPan = (event) => {
        const view = requireDiagramView()
        if (!view.pointer || view.pointer.id !== event.pointerId) return
        view.pointer = undefined
        if (elements.diagramViewport.hasPointerCapture(event.pointerId)) {
            elements.diagramViewport.releasePointerCapture(event.pointerId)
        }
        elements.diagramViewport.classList.remove("is-panning")
    }
    elements.diagramViewport.addEventListener("pointerup", finishPan)
    elements.diagramViewport.addEventListener("pointercancel", finishPan)

    elements.diagramViewport.addEventListener("keydown", (event) => {
        const view = requireDiagramView()
        const panStep = event.shiftKey ? 80 : 30
        if (event.key === "+" || event.key === "=") zoomDiagramViewer(DIAGRAM_ZOOM_STEP)
        else if (event.key === "-") zoomDiagramViewer(1 / DIAGRAM_ZOOM_STEP)
        else if (event.key === "0") fitDiagramViewer()
        else if (event.key === "ArrowLeft") view.x += panStep
        else if (event.key === "ArrowRight") view.x -= panStep
        else if (event.key === "ArrowUp") view.y += panStep
        else if (event.key === "ArrowDown") view.y -= panStep
        else return
        event.preventDefault()
        applyDiagramTransform()
    })

    elements.diagramDialog.addEventListener("close", () => {
        const view = requireDiagramView()
        document.body.classList.remove("diagram-viewer-open")
        elements.diagramCanvas.replaceChildren()
        elements.diagramCanvas.removeAttribute("style")
        diagramView = undefined
        view.opener.focus()
    })
}

async function loadConfig() {
    const raw = await fetchText("content/_config.md")
    const { data } = parseFrontmatter(raw, "content/_config.md")
    for (const key of ["title", "description", "home"]) {
        if (typeof data[key] !== "string" || !data[key].trim()) {
            throw new Error(`content/_config.md requires a non-empty “${key}” string`)
        }
    }
    config = data
    elements.brand.textContent = config.title
    elements.brand.href = pageURL(config.home)
    document.title = config.title
    document.querySelector('meta[name="description"]').content = config.description
}

async function loadNavigation() {
    const markdown = await fetchText("content/_sidebar.md")
    elements.tree.innerHTML = renderMarkdown(markdown)
    pageLinks = [...elements.tree.querySelectorAll("a[data-page]")]
    if (pageLinks.length === 0) throw new Error("content/_sidebar.md must contain at least one wiki link")
    pageLinks.forEach((link) => (link.dataset.filterText = link.textContent))

    elements.tree.querySelectorAll(":scope > ul > li").forEach((item) => {
        const children = item.querySelector(":scope > ul")
        if (!children) return

        const categoryLink = item.querySelector(":scope > a")
        if (!categoryLink) throw new Error("Every collapsible sidebar category must link to a content page")

        item.classList.add("category")
        const toggle = document.createElement("button")
        toggle.type = "button"
        toggle.className = "category-toggle"
        toggle.setAttribute("aria-expanded", "false")
        toggle.setAttribute("aria-label", `Expand ${categoryLink.textContent}`)
        toggle.innerHTML = '<span aria-hidden="true"></span>'
        children.hidden = true
        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") === "true"
            if (expanded) setCategoryExpanded(item, false)
            else expandOnlyCategory(item)
        })
        item.insertBefore(toggle, children)
    })
}

function setCategoryExpanded(category, expanded) {
    const categoryLink = category.querySelector(":scope > a")
    const children = category.querySelector(":scope > ul")
    const toggle = category.querySelector(":scope > .category-toggle")
    if (!categoryLink || !children || !toggle) {
        throw new Error("Collapsible sidebar category has invalid markup")
    }
    children.hidden = !expanded
    toggle.setAttribute("aria-expanded", String(expanded))
    toggle.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${categoryLink.textContent}`)
}

function expandOnlyCategory(categoryToExpand) {
    elements.tree.querySelectorAll(":scope > ul > li.category").forEach((category) => {
        setCategoryExpanded(category, category === categoryToExpand)
    })
}

function routeState() {
    const raw = location.hash.replace(/^#\/?/, "")
    const queryStart = raw.indexOf("?")
    const rawPage = queryStart === -1 ? raw : raw.slice(0, queryStart)
    const rawQuery = queryStart === -1 ? "" : raw.slice(queryStart + 1)
    return {
        page: pageSlug(decodeURIComponent(rawPage || config.home)),
        section: new URLSearchParams(rawQuery).get("section"),
    }
}

function routePage() {
    return routeState().page
}

async function renderRoute() {
    if (elements.diagramDialog.open) elements.diagramDialog.close()
    currentPage = routePage()
    closeSidebar()
    elements.article.innerHTML = '<div class="loading">Loading page…</div>'

    const raw = await fetchText(`content/${currentPage}.md`)
    const { data, content } = parseFrontmatter(raw, `content/${currentPage}.md`)
    if (typeof data.title !== "string" || !data.title.trim()) {
        throw new Error(`content/${currentPage}.md requires a title in frontmatter`)
    }
    if (!PAGE_STATUSES.has(data.status)) {
        throw new Error(`content/${currentPage}.md requires status: accepted, in-progress, todo, or reference`)
    }

    const expandedContent = await expandCodeIncludes(content, `content/${currentPage}.md`)
    elements.article.innerHTML = `
    <header class="article-header">
      ${data.eyebrow ? `<span class="eyebrow">${escapeHTML(data.eyebrow)}</span>` : ""}
      <h1>${escapeHTML(data.title)}</h1>
      ${data.summary ? `<p class="summary">${escapeHTML(data.summary)}</p>` : ""}
      <span class="status status-${data.status}">${escapeHTML(data.status)}</span>
    </header>
    <div class="prose">${renderMarkdown(expandedContent)}</div>`

    setupDocumentMarkers()
    await renderDiagrams()
    setupFootnoteNavigation()
    document.title = `${data.title} · ${config.title}`
    markActivePage()
    buildOutline()
    buildPagination()
    scrollToRouteLocation("auto")
}

function setupDocumentMarkers() {
    elements.article.querySelectorAll(".prose blockquote").forEach((quote) => {
        const label = quote.querySelector(":scope > p:first-child > strong:first-child")
        const marker = DOCUMENT_MARKERS.get(label?.textContent)
        if (!marker) return
        quote.classList.add("document-marker", `marker-${marker}`)
    })
}

function setupFootnoteNavigation() {
    elements.article.querySelectorAll("[data-footnote-ref], [data-footnote-backref]").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault()
            const targetID = link.getAttribute("href").slice(1)
            const target = document.getElementById(targetID)
            if (!target) throw new Error(`Footnote target is missing: ${targetID}`)
            elements.article
                .querySelectorAll(".footnote-target")
                .forEach((element) => element.classList.remove("footnote-target"))
            target.classList.add("footnote-target")
            target.scrollIntoView({ behavior: "smooth", block: "center" })
        })
    })
}

function markActivePage() {
    const activeLink = pageLinks.find((link) => link.dataset.page === currentPage)
    if (elements.filter.value.trim()) {
        elements.tree.querySelectorAll(":scope > ul > li.category").forEach((category) => {
            setCategoryExpanded(category, !category.hidden)
        })
    } else {
        expandOnlyCategory(activeLink?.closest(".category"))
    }

    pageLinks.forEach((link) => {
        const active = link === activeLink
        link.classList.toggle("active", active)
        if (active) link.setAttribute("aria-current", "page")
        else link.removeAttribute("aria-current")
    })
}

function headingID(text, usedIDs, index) {
    const base = pageSlug(text) || `section-${index + 1}`
    const occurrence = (usedIDs.get(base) || 0) + 1
    usedIDs.set(base, occurrence)
    return occurrence === 1 ? base : `${base}-${occurrence}`
}

function sectionURL(section) {
    return `#/${currentPage}?section=${encodeURIComponent(section)}`
}

function buildOutline() {
    const headings = [...elements.article.querySelectorAll(".prose h2:not(.sr-only), .prose h3")]
    const usedIDs = new Map()
    elements.outline.innerHTML = ""
    headings.forEach((heading, index) => {
        heading.id = headingID(heading.textContent, usedIDs, index)
        const link = document.createElement("a")
        link.href = sectionURL(heading.id)
        link.className = heading.tagName === "H3" ? "depth-3" : ""
        link.dataset.section = heading.id
        link.textContent = heading.textContent
        elements.outline.append(link)
    })
}

function markActiveOutline(section) {
    elements.outline.querySelectorAll("a[data-section]").forEach((link) => {
        const active = link.dataset.section === section
        link.classList.toggle("active", active)
        if (active) link.setAttribute("aria-current", "location")
        else link.removeAttribute("aria-current")
    })
}

function scrollToRouteLocation(behavior) {
    const { section } = routeState()
    markActiveOutline(section)
    if (!section) {
        elements.main.scrollTo({ top: 0, behavior })
        window.scrollTo({ top: 0, behavior })
        return
    }

    const heading = document.getElementById(section)
    if (!heading || !elements.article.contains(heading)) throw new Error(`Section not found on page: ${section}`)
    heading.scrollIntoView({ behavior, block: "start" })
}

async function navigateRoute() {
    if (routePage() === currentPage) {
        scrollToRouteLocation("smooth")
        return
    }
    await renderRoute()
}

function buildPagination() {
    const unique = pageLinks.filter(
        (link, index, links) => links.findIndex((candidate) => candidate.dataset.page === link.dataset.page) === index,
    )
    const index = unique.findIndex((link) => link.dataset.page === currentPage)
    const adjacentLink = (link, relation) =>
        link
            ? `<a class="page-${relation}" href="${link.getAttribute("href")}"><small>${relation}</small><span>${escapeHTML(link.textContent)}</span></a>`
            : "<span></span>"
    elements.pagination.innerHTML =
        adjacentLink(unique[index - 1], "previous") + adjacentLink(unique[index + 1], "next")
}

function renderFilterMatch(link, query) {
    const text = link.dataset.filterText
    link.replaceChildren()
    if (!query) {
        link.textContent = text
        return false
    }

    const lowerText = text.toLowerCase()
    let cursor = 0
    let match = lowerText.indexOf(query)
    if (match === -1) {
        link.textContent = text
        return false
    }

    while (match !== -1) {
        link.append(document.createTextNode(text.slice(cursor, match)))
        const highlight = document.createElement("mark")
        highlight.className = "filter-match"
        highlight.textContent = text.slice(match, match + query.length)
        link.append(highlight)
        cursor = match + query.length
        match = lowerText.indexOf(query, cursor)
    }
    link.append(document.createTextNode(text.slice(cursor)))
    return true
}

function setupFilter() {
    elements.filter.addEventListener("input", () => {
        const query = elements.filter.value.trim().toLowerCase()
        const matchingLinks = new Set(pageLinks.filter((link) => renderFilterMatch(link, query)))

        elements.tree.querySelectorAll("li").forEach((item) => {
            item.hidden = query
                ? ![...item.querySelectorAll("a[data-page]")].some((link) => matchingLinks.has(link))
                : false
        })

        if (query) {
            elements.tree.querySelectorAll(":scope > ul > li.category").forEach((category) => {
                setCategoryExpanded(category, !category.hidden)
            })
            return
        }

        const activeLink = pageLinks.find((link) => link.dataset.page === currentPage)
        expandOnlyCategory(activeLink?.closest(".category"))
    })
}

function closeSidebar() {
    document.body.classList.remove("sidebar-open")
    elements.sidebarToggle.setAttribute("aria-expanded", "false")
}

function setupSidebar() {
    elements.sidebarToggle.addEventListener("click", () => {
        const open = document.body.classList.toggle("sidebar-open")
        elements.sidebarToggle.setAttribute("aria-expanded", String(open))
    })
    elements.tree.addEventListener("click", (event) => {
        if (event.target.closest("a")) closeSidebar()
    })
}

function renderFatal(error) {
    console.error(error)
    elements.article.innerHTML = `
    <div class="fatal-error">
      <strong>Wiki failed to load</strong>
      <code>${escapeHTML(error.message)}</code>
    </div>`
}

function isTableDelimiter(line) {
    let value = line.trim()
    if (!value.includes("|")) return false
    if (value.startsWith("|")) value = value.slice(1)
    if (value.endsWith("|")) value = value.slice(0, -1)
    return value.split("|").every((cell) => /^\s*:?-+:?\s*$/.test(cell))
}

function protectWikilinks(line) {
    let output = ""
    let cursor = 0

    while (cursor < line.length) {
        if (line.startsWith("[[", cursor)) {
            const end = line.indexOf("]]", cursor + 2)
            if (end !== -1) {
                const content = line.slice(cursor + 2, end)
                const separator = content.indexOf("|")
                if (separator > 0 && separator < content.length - 1) {
                    output += `[[${content.replace(/(?<!\\)\|/g, "\\|")}]]`
                    cursor = end + 2
                    continue
                }
            }
        }

        output += line[cursor]
        cursor += 1
    }

    return output
}

function prepareMarkdown(markdown) {
    const lines = markdown.split("\n")

    for (let delimiter = 1; delimiter < lines.length; delimiter += 1) {
        if (!isTableDelimiter(lines[delimiter])) continue

        lines[delimiter - 1] = protectWikilinks(lines[delimiter - 1])
        for (let row = delimiter + 1; row < lines.length && lines[row].trim(); row += 1) {
            lines[row] = protectWikilinks(lines[row])
        }
    }

    return lines.join("\n")
}

function tokenizeWikilink(source) {
    const match = /^\[\[((?:(?!\\?\|)[^\]\n])+)(?:\\?\|([^\]\n]+))?\]\]/.exec(source)
    if (!match) return undefined

    return {
        type: "wikilink",
        raw: match[0],
        target: match[1].trim(),
        label: (match[2] || match[1]).replace(/\\\|/g, "|").trim(),
    }
}

async function init() {
    setupMarkdown()
    setupMermaid()
    setupDiagramViewer()
    setupSidebar()
    setupFilter()
    await loadConfig()
    await loadNavigation()
    await renderRoute()
    window.addEventListener("hashchange", () => navigateRoute().catch(renderFatal))
}

init().catch(renderFatal)
