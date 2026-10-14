import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { validateWiki } from "../scripts/validate.mjs"
import { createContext, runInContext } from "node:vm"
import { createCodeBlockRegistry, createContentRuntime } from "../app.js"

const helpers = { escapeHTML: (value) => value.replaceAll("<", "&lt;").replaceAll(">", "&gt;") }
function render(registry, source = "data", info = "example") {
    return registry.render({ source, info, helpers })
}
function article(html) {
    return { querySelectorAll: () => [...html.matchAll(/data-wiki-code-block="(\d+)"/g)].map((match) => ({
        dataset: { wikiCodeBlock: match[1] },
    })) }
}
async function runtime() {
    const dependencies = createContext({ console })
    for (const file of ["js-yaml.min.js", "marked.min.js", "marked-footnote.min.js", "highlight.min.js", "katex/katex.min.js", "marked-katex.min.js"]) {
        runInContext(await readFile(new URL(`../vendor/${file}`, import.meta.url), "utf8"), dependencies)
    }
    return createContentRuntime({ dependencies, baseURL: "http://wiki.invalid/" })
}

test("registration validates names, callbacks and duplicate built-ins", () => {
    const registry = createCodeBlockRegistry()
    for (const name of [undefined, "", "Example", "bad name", 'bad\"']) {
        assert.throws(() => registry.register({ name, render() {} }), /lowercase name/)
    }
    assert.throws(() => registry.register({ name: "example" }), /provide render/)
    assert.throws(() => registry.register({ name: "example", render() {}, afterRender: true }), /afterRender/)
    assert.throws(() => registry.register({ name: "mermaid", render() {} }), /already registered/)
})

test("unknown fences fall back; Mermaid escapes source through the registry", () => {
    const registry = createCodeBlockRegistry()
    assert.equal(render(registry, "x", "unknown"), null)
    assert.match(render(registry, "<script>", "mermaid"), /class="mermaid">&lt;script&gt;/)
})

test("custom output is validated with page and fence diagnostics", () => {
    for (const result of [undefined, "html", { html: 1 }, { html: "", className: 'x\"' }, Promise.resolve({ html: "" })]) {
        const registry = createCodeBlockRegistry()
        registry.register({ name: "example", render: () => result })
        registry.begin("content/page.md")
        assert.throws(() => render(registry), /content\/page.md: code block 1 \(example\)/)
    }
})

test("mounts repeated blocks separately and cleans up once in reverse order", async () => {
    const registry = createCodeBlockRegistry()
    const mounted = [], cleaned = []
    registry.register({ name: "example", render: () => ({ html: "placeholder" }), afterRender(ctx) {
        mounted.push(ctx)
        return () => cleaned.push(ctx.source)
    } })
    const html = render(registry, "one", "example option") + render(registry, "two")
    const controller = new AbortController()
    const dispose = await registry.mount(article(html), { signal: controller.signal, path: "page.md" })
    assert.deepEqual(mounted.map(({ source, info, path }) => [source, info, path]), [
        ["one", "example option", "page.md"], ["two", "example", "page.md"],
    ])
    assert.notEqual(mounted[0].element, mounted[1].element)
    controller.abort()
    dispose()
    assert.deepEqual(cleaned, ["two", "one"])
})

test("navigation abort cleans up late initialization and skips remaining blocks", async () => {
    const registry = createCodeBlockRegistry()
    let finish, calls = 0, cleaned = 0
    registry.register({ name: "example", render: () => ({ html: "" }), afterRender() {
        calls++
        return new Promise((resolve) => { finish = () => resolve(() => cleaned++) })
    } })
    const html = render(registry) + render(registry)
    const controller = new AbortController()
    const mounting = registry.mount(article(html), { signal: controller.signal })
    controller.abort()
    registry.begin("next.md")
    finish()
    await mounting
    assert.equal(calls, 1)
    assert.equal(cleaned, 1)
})

test("mount failure disposes earlier blocks and includes block context", async () => {
    const registry = createCodeBlockRegistry()
    let cleaned = false
    registry.register({ name: "example", render: () => ({ html: "" }), afterRender({ source }) {
        if (source === "bad") throw new Error("broken")
        return () => { cleaned = true }
    } })
    registry.begin("page.md")
    const html = render(registry, "good") + render(registry, "bad")
    await assert.rejects(registry.mount(article(html), { signal: new AbortController().signal }), /page.md: code block 2 \(example\): broken/)
    assert.equal(cleaned, true)
})

test("content runtime registers blocks, preserves highlighting and does not initialize views", async () => {
    const engine = await runtime()
    let received
    await engine.configure({ default({ registerCodeBlock }) {
        registerCodeBlock({ name: "chatkit", render(ctx) {
            received = ctx
            return { html: `<p>${ctx.helpers.escapeHTML(ctx.source)}</p>`, className: "chatkit-preview" }
        }, afterRender() { throw new Error("must not run in validation") } })
    } })
    const result = await engine.render({ path: "content/page.md", extension: ".md", source:
        '---\ntitle: Example\nstatus: accepted\n---\n\n```chatkit option\n<Text />\n```\n\n```js\nconst x = 1\n```\n\n```mermaid\ngraph LR\n A --> B\n```\n' })
    assert.match(result.html, /chatkit-preview/)
    assert.match(result.html, /&lt;Text \/&gt;/)
    assert.match(result.html, /language-js/)
    assert.match(result.html, /class="mermaid"/)
    assert.equal(received.info, "chatkit option")
})

test("validator inspects block output and reports rendering failures", async () => {
    const source = await mkdtemp(join(tmpdir(), "wiki-code-blocks-"))
    try {
        await Promise.all([
            writeFile(join(source, "_config.md"), "---\ntitle: Test\ndescription: Test blocks\nhome: welcome\n---\n"),
            writeFile(join(source, "_sidebar.md"), "- [[Welcome]]\n"),
            writeFile(join(source, "welcome.md"), "---\ntitle: Welcome\nstatus: accepted\n---\n\n```example\nvalue\n```\n"),
            writeFile(join(source, "custom.js"), `export default ({ registerCodeBlock }) => registerCodeBlock({
                name: "example", render: () => ({ html: '<img src="content/missing.png">' }),
                afterRender() { throw new Error("must not initialize") },
            })`),
        ])
        let result = await validateWiki({ source })
        assert.ok(result.diagnostics.some(({ message }) => /missing.png/.test(message)), JSON.stringify(result))
        await writeFile(join(source, "custom.js"), `export default ({ registerCodeBlock }) => registerCodeBlock({
            name: "example", render() { throw new Error("bad source") },
        })`)
        // Use a distinct module path: Node caches configuration modules by URL.
        const second = await mkdtemp(join(tmpdir(), "wiki-code-blocks-error-"))
        try {
            for (const file of ["_config.md", "_sidebar.md", "welcome.md", "custom.js"]) {
                await writeFile(join(second, file), await readFile(join(source, file)))
            }
            result = await validateWiki({ source: second })
            assert.ok(result.diagnostics.some(({ message }) => /code block 1 \(example\): bad source/.test(message)), JSON.stringify(result))
        } finally { await rm(second, { recursive: true, force: true }) }
    } finally { await rm(source, { recursive: true, force: true }) }
})
