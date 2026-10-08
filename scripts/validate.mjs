#!/usr/bin/env node
import { readFile, readdir, realpath, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, resolve, sep, extname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createContext, runInContext } from "node:vm"
import { createRequire } from "node:module"
import { contentRequest, createContentRuntime, pageURL, routePath, validateConfig, safeContentModulePath } from "../app.js"
import { inspectHTML } from "./inspect-html.mjs"

const engine = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const baseURL = "http://wiki.invalid/"
const overrides = new Set(["Makefile", "custom.css", "custom.js", "favicon.svg"])
const require = createRequire(import.meta.url)

function needsBrowser(cause) {
    if (cause.name === "ReferenceError" && /^(document|window|location|navigator|HTMLElement|customElements|localStorage|sessionStorage) is not defined$/.test(cause.message)) return true
    return cause.cause?.code === "ERR_INVALID_URL" && typeof cause.cause.input === "string" && !/^[a-z][a-z0-9+.-]*:/i.test(cause.cause.input)
}

async function customizationModule(path) {
    const module = await import(pathToFileURL(path).href)
    // Node syntax-detects a comment-only/no-export .js file as CommonJS and
    // synthesizes a default {}; the browser sees a module with no exports.
    const commonJS = require.cache[path]
    if (commonJS && module.default === commonJS.exports && Object.keys(commonJS.exports).length === 0) return {}
    return module
}

// Load the exact browser distributions, including the KaTeX plugin's vendored
// dependency, without package installation or process-wide parser globals.
async function dependencies() {
    const context = createContext({ console })
    for (const file of ["js-yaml.min.js", "marked.min.js", "marked-footnote.min.js", "highlight.min.js", "katex/katex.min.js", "marked-katex.min.js"]) {
        runInContext(await readFile(resolve(engine, "vendor", file), "utf8"), context, { filename: file })
    }
    return context
}

async function inventory(root, prefix = "") {
    const files = new Set()
    for (const entry of await readdir(resolve(root, prefix), { withFileTypes: true })) {
        if (entry.name.startsWith(".") || (!prefix && overrides.has(entry.name))) continue
        const path = prefix ? `${prefix}/${entry.name}` : entry.name
        // Do not recurse through symlink directories; reject files outside the content root.
        const absolute = await realpath(resolve(root, path))
        if (!absolute.startsWith(`${root}${sep}`)) throw new Error(`Published file escapes content directory: ${path}`)
        const info = await stat(absolute)
        if (info.isDirectory() && !entry.isSymbolicLink()) {
            for (const nested of await inventory(root, path)) files.add(nested)
        } else if (info.isFile()) files.add(path)
    }
    return files
}

/** Validate source content or an assembled site. Trusted custom modules execute locally. */
export async function validateWiki({ source = "content", site } = {}) {
    source = await realpath(resolve(source))
    const siteRoot = site ? await realpath(resolve(site)) : engine
    const diagnostics = []
    const add = (severity, file, message) => diagnostics.push({ severity, file, message })
    const error = (file, cause) => add("error", file, cause.message || String(cause))
    const files = await inventory(source)
    async function localFile(url) {
        const address = new URL(url, baseURL)
        if (address.origin !== new URL(baseURL).origin) throw new Error(`Not a local resource: ${url}`)
        const path = decodeURIComponent(address.pathname).replace(/^\//, "")
        let root = siteRoot
        let relative = path
        if (path.startsWith("content/")) {
            root = source
            relative = path.slice(8)
            // Exact casing, plus the same published-file exclusions as build.sh.
            if (!files.has(relative)) {
                const directory = relative.replace(/\/$/, "")
                const index = directory ? `${directory}/index.html` : "index.html"
                if (files.has(index)) relative = index
                else throw new Error(`Missing published file: ${path}`)
            }
        } else if (!site && overrides.has(path) && existsSync(resolve(source, path))) {
            root = source
        }
        let absolute
        try {
            absolute = await realpath(resolve(root, relative))
            if ((await stat(absolute)).isDirectory()) absolute = await realpath(resolve(absolute, "index.html"))
        } catch { throw new Error(`Missing local file: ${path || "index.html"}`) }
        if (!absolute.startsWith(`${root}${sep}`) || !(await stat(absolute)).isFile()) {
            throw new Error(`Invalid local file: ${path}`)
        }
        return absolute
    }
    const runtime = createContentRuntime({
        dependencies: await dependencies(),
        baseURL,
        readText: async (url) => readFile(await localFile(url), "utf8"),
    })
    let config
    let browserCustomization = false
    let browserExtensions = false
    const defer = (file, cause) => add("warning", file, `Browser-dependent code was not validated in Node; run --browser (${cause.message})`)
    try {
        config = validateConfig(runtime.parseFrontmatter(await readFile(resolve(source, "_config.md"), "utf8"), "content/_config.md").data)
    } catch (cause) { error("_config.md", cause) }
    try {
        const custom = site ? resolve(siteRoot, "custom.js") : resolve(source, "custom.js")
        if (existsSync(custom)) await runtime.configure(await customizationModule(custom))
    } catch (cause) {
        if (needsBrowser(cause)) { browserCustomization = true; defer("custom.js", cause) }
        else error("custom.js", cause)
    }
    for (const path of config?.extensions || []) {
        try {
            const safe = safeContentModulePath(path)
            if (!files.has(safe)) throw new Error(`Missing published extension module: ${safe}`)
            runtime.registry.register((await import(pathToFileURL(resolve(source, safe)).href)).default, `content/${safe}`)
        } catch (cause) {
            if (needsBrowser(cause)) { browserExtensions = true; defer(path, cause) }
            else error("_config.md", cause)
        }
    }
    const extensions = runtime.registry.extensions()
    const pages = [...files].filter((path) => extensions.has(extname(path).toLowerCase()) && path !== "_config.md" && path !== "_sidebar.md").sort()
    const documents = new Map()
    const pending = []
    const routes = new Set(["#/"])
    const graph = new Map()
    const seeds = new Set()
    const querylessFailures = new Map()

    function inspect(html, file, prose, key = file) {
        const document = inspectHTML(html, { prose })
        documents.set(key, document)
        pending.push({ file, key, document })
        return document
    }
    try {
        const sidebar = inspect(runtime.renderMarkdown(await readFile(resolve(source, "_sidebar.md"), "utf8")), "_sidebar.md", false)
        if (!sidebar.links.some((link) => link.wiki)) throw new Error("content/_sidebar.md must contain at least one wiki link")
        sidebar.sidebarErrors.forEach((message) => add("error", "_sidebar.md", message))
    } catch (cause) { error("_sidebar.md", cause) }
    for (const file of pages) {
        try {
            const route = routePath(file, extensions)
            if (contentRequest(route, extensions).contentPath !== file) {
                add("warning", file, `Filename is not reachable through its normal wiki route (${route}); use lowercase kebab-case Markdown filenames`)
            } else routes.add(pageURL(file, extensions))
            const rendered = await runtime.render({ source: await readFile(resolve(source, file), "utf8"), path: `content/${file}`, extension: extname(file).toLowerCase(), validateStatus: !browserCustomization })
            inspect(rendered.html, file, (rendered.className || "").split(/\s+/).includes("prose"))
        } catch (cause) {
            if (extname(file).toLowerCase() === ".md") error(file, cause)
            else if (needsBrowser(cause)) defer(file, cause)
            else querylessFailures.set(file, cause)
        }
    }

    // Resolve routes exactly like the browser, and render linked query variants.
    async function target(href, from) {
        const raw = href.replace(/^#\/?/, "")
        const queryStart = raw.indexOf("?")
        const rawPath = decodeURIComponent((queryStart < 0 ? raw : raw.slice(0, queryStart)) || config?.home || "")
        if (browserExtensions) return // Browser smoke discovers links using the actual extension registry.
        const route = routePath(rawPath, extensions)
        const query = new URLSearchParams(queryStart < 0 ? "" : raw.slice(queryStart + 1))
        routes.add(`#/${route.split("/").map(encodeURIComponent).join("/")}${query.size ? `?${query}` : ""}`)
        const request = contentRequest(route, extensions)
        const file = request.contentPath
        if (!files.has(file)) throw new Error(`Missing wiki page: ${file}`)
        if (from === "_sidebar.md" || from === "_config.md") seeds.add(file)
        if (!graph.has(from)) graph.set(from, new Set())
        graph.get(from).add(file)
        const contentQuery = new URLSearchParams(query)
        contentQuery.delete("section")
        const key = contentQuery.size ? `${file}?${contentQuery}` : file
        if (!contentQuery.size && querylessFailures.has(file)) throw querylessFailures.get(file)
        if (!documents.has(key) && !attempted.has(key)) {
            attempted.add(key)
            try {
                const rendered = await runtime.render({ source: await readFile(resolve(source, file), "utf8"), path: `content/${file}`, extension: request.extension, query, validateStatus: !browserCustomization })
                inspect(rendered.html, file, (rendered.className || "").split(/\s+/).includes("prose"), key)
            } catch (cause) {
                if (needsBrowser(cause)) defer(key, cause)
                else throw cause
            }
        }
        const section = query.get("section")
        if (section && documents.has(key) && !documents.get(key).sections.has(section)) {
            throw new Error(`Section not found on ${file}: ${section}`)
        }
    }
    const attempted = new Set(pages)
    if (config) {
        try { await target(pageURL(config.home, extensions), "_config.md") }
        catch (cause) { error("_config.md", cause) }
    }
    // pending can grow as query-bearing routes discover more links.
    for (let index = 0; index < pending.length; index += 1) {
        if (index > 10000) { add("error", "wiki", "Too many query variants (possible infinitely generated links)"); break }
        const { file, key, document } = pending[index]
        for (const { href, footnote } of document.links) {
            try {
                if (href.startsWith("#") && !footnote) await target(href, file)
                else if (footnote && href.startsWith("#")) {
                    if (!document.sections.has(decodeURIComponent(href.slice(1)))) throw new Error(`Missing footnote target: ${href}`)
                } else {
                    const url = new URL(href, baseURL)
                    if (url.origin === new URL(baseURL).origin) await localFile(url)
                }
            } catch (cause) { error(key, cause) }
        }
        for (const asset of document.assets) {
            try {
                const url = new URL(asset, baseURL)
                if (url.origin === new URL(baseURL).origin) await localFile(url)
            } catch (cause) { error(key, cause) }
        }
    }
    const reachable = new Set()
    function reach(file) {
        if (reachable.has(file)) return
        reachable.add(file)
        for (const next of graph.get(file) || []) reach(next)
    }
    seeds.forEach(reach)
    for (const file of pages) {
        if (!reachable.has(file) && !browserExtensions) add("warning", file, "Page is unreachable from home/navigation")
        if (querylessFailures.has(file) && !reachable.has(file)) {
            add("warning", file, `Unlisted custom content could not be rendered without query parameters: ${querylessFailures.get(file).message}`)
        }
    }
    // A query-required custom renderer need not provide a queryless page.
    for (const file of querylessFailures.keys()) {
        routes.delete(pageURL(file, extensions))
    }
    return { diagnostics, pages: pages.length, routes: [...routes] }
}

export async function main(args = process.argv.slice(2)) {
    let source = "content", site, browser = false, strict = false
    let positional = false
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index]
        if (argument === "--browser") browser = true
        else if (argument === "--strict") strict = true
        else if (argument === "--site" && args[index + 1]) site = args[++index]
        else if (argument === "--help") {
            console.log("Usage: node scripts/validate.mjs [CONTENT_DIRECTORY] [--strict] [--browser] [--site SITE_DIRECTORY]\nBrowser checks are opt-in and require Playwright with Chromium. Custom modules are trusted code and execute locally.")
            return 0
        } else if (!argument.startsWith("-") && !positional) { source = argument; positional = true }
        else { console.error(`Unknown argument: ${argument}`); return 1 }
    }
    try {
        const result = await validateWiki({ source, site })
        if (browser && !result.diagnostics.some((item) => item.severity === "error")) {
            const { smokeWiki } = await import("./smoke.mjs")
            result.diagnostics.push(...await smokeWiki({ source: resolve(source), site: site ? resolve(site) : undefined, routes: result.routes }))
        }
        for (const item of result.diagnostics) console.log(`${item.severity.toUpperCase()} ${item.file} — ${item.message}`)
        const errors = result.diagnostics.filter((item) => item.severity === "error").length
        const warnings = result.diagnostics.length - errors
        console.log(`Checked ${result.pages} page${result.pages === 1 ? "" : "s"}: ${errors} errors, ${warnings} warnings${browser ? " (browser requested)" : ""}`)
        return errors || (strict && warnings) ? 1 : 0
    } catch (cause) {
        console.error(`ERROR wiki — ${cause.message}`)
        return 1
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main()
