import { headingID } from "../app.js"
import { parseDocument } from "./vendor/htmlparser2.mjs"

const assetAttributes = {
    img: ["src"],
    source: ["src"],
    video: ["src", "poster"],
    audio: ["src"],
    script: ["src"],
    link: ["href"],
}
const hasAttribute = (node, name) => Object.hasOwn(node.attribs, name)
const hasClass = (node, name) => (node.attribs?.class || "").split(/\s+/).includes(name)

// DOM textContent, rather than innerText: comments do not contribute, while
// inline elements (including script/style text) do, just as in buildOutline.
function textContent(node) {
    if (node.type === "text") return node.data
    return (node.children || []).map(textContent).join("")
}

/** Inspect rendered HTML without executing it or resolving resource paths. */
export function inspectHTML(html, { prose = true } = {}) {
    const document = parseDocument(prose ? `<div class="prose">${html}</div>` : html)
    const root = prose ? document.children[0] : document
    const links = []
    const assets = []
    const sections = new Set()
    const sidebarErrors = []
    const elements = []
    const headings = []

    function visit(node, inProse) {
        if (node.attribs) {
            elements.push(node)
            if (inProse && ((node.name === "h2" && !hasClass(node, "sr-only")) || node.name === "h3")) {
                headings.push(node)
            }
            if (node.name === "a" && hasAttribute(node, "href")) {
                links.push({ href: node.attribs.href, wiki: hasAttribute(node, "data-page"),
                    ...(hasAttribute(node, "data-footnote-ref") || hasAttribute(node, "data-footnote-backref") ? { footnote: true } : {}),
                })
            }
            for (const attribute of assetAttributes[node.name] || []) {
                if (hasAttribute(node, attribute)) assets.push(node.attribs[attribute])
            }
            inProse ||= hasClass(node, "prose")
        }
        for (const child of node.children || []) visit(child, inProse)
    }
    visit(document, false)

    // The app overwrites outline heading IDs, so gather explicit IDs only
    // after doing the same mutation (otherwise stale IDs would validate).
    const usedIDs = new Map()
    headings.forEach((heading, index) => {
        heading.attribs.id = headingID(textContent(heading), usedIDs, index)
    })
    for (const element of elements) {
        if (hasAttribute(element, "id")) sections.add(element.attribs.id)
    }

    // Navigation applies this rule only to :scope > ul > li, not nested lists.
    for (const list of root.children || []) {
        if (list.name !== "ul") continue
        for (const item of list.children || []) {
            if (item.name !== "li") continue
            const children = item.children || []
            if (children.some((child) => child.name === "ul") && !children.some((child) => child.name === "a")) {
                sidebarErrors.push("Every collapsible sidebar category must link to a content page")
            }
        }
    }
    return { links, assets, sections, sidebarErrors }
}
