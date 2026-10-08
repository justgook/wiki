import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const cli = new URL("../scripts/validate.mjs", import.meta.url)
async function fixture(t, files = {}) {
    const root = await mkdtemp(join(tmpdir(), "wiki-validation-"))
    t.after(() => rm(root, { recursive: true, force: true }))
    const defaults = {
        "_config.md": "---\ntitle: Test\ndescription: Test wiki\nhome: home\n---\n",
        "_sidebar.md": "- [[Home]]\n",
        "home.md": "---\ntitle: Home\nstatus: accepted\n---\n## Start here\nHello.\n",
    }
    for (const [file, content] of Object.entries({ ...defaults, ...files })) {
        await mkdir(join(root, file, ".."), { recursive: true })
        await writeFile(join(root, file), content)
    }
    return root
}
function run(root, ...flags) {
    return spawnSync(process.execPath, [cli.pathname, root, ...flags], { encoding: "utf8" })
}
const page = (body, status = "accepted") => `---\ntitle: Example\nstatus: ${status}\n---\n${body}\n`

test("validates a wiki without browser dependencies", async (t) => {
    const root = await fixture(t)
    const result = run(root)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout, /Checked 1 page.*0 errors/)
})

test("collects errors across navigation, linked sections and unlisted pages", async (t) => {
    const root = await fixture(t, {
        "_sidebar.md": "- [[Home]]\n- [[Missing]]\n",
        "home.md": page("[[Home#Absent]]"),
        "orphan.md": page("Orphan", "bogus"),
        "bad-yaml.md": "---\ntitle: [unterminated\nstatus: accepted\n---\n",
    })
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /Missing wiki page: missing.md/)
    assert.match(result.stdout, /Section not found on home.md: absent/)
    assert.match(result.stdout, /orphan.md.*requires status/)
    assert.match(result.stdout, /bad-yaml.md/)
})

test("uses rendered headings and ignores examples, while validating footnotes", async (t) => {
    const root = await fixture(t, {
        "home.md": page("## Fish &amp; **Chips**\n## Fish &amp; Chips\n[[Home#Fish Chips]]\n[[Home#fish-chips-2]]\n\nText[^one].\n\n[^one]: A note.\n\n`[[Not a page]]`\n\n```md\n[[Missing]]\n@[code](missing.js)\n```"),
    })
    const result = run(root, "--strict")
    assert.equal(result.status, 0, result.stdout + result.stderr)
})

test("warnings do not block unless strict is requested", async (t) => {
    const root = await fixture(t, { "orphan.md": page("Unlisted"), ".private.md": "invalid metadata" })
    assert.equal(run(root).status, 0)
    const result = run(root, "--strict")
    assert.equal(result.status, 1)
    assert.match(result.stdout, /orphan.md.*unreachable/)
    assert.match(result.stdout, /Checked 2 pages/)
})

test("validates code includes, source/highlight ranges and content containment", async (t) => {
    const root = await fixture(t, {
        "home.md": page("@[code{1-2} javascript{2}](examples/source.js)"),
        "examples/source.js": "const a = 1\nconst b = 2",
        "bad-source.md": page("@[code{1-5}](examples/source.js)"),
        "bad-highlight.md": page("@[code{1-2} javascript{3}](examples/source.js)"),
        "bad-path.md": page("@[code](../outside.js)"),
    })
    const result = run(root)
    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stdout, /ERROR home.md/)
    assert.match(result.stdout, /bad-source.md.*source range 1-5 is outside 1-2/)
    assert.match(result.stdout, /bad-highlight.md.*highlight range 3 is outside 1-2/)
    assert.match(result.stdout, /bad-path.md.*must stay inside content/)
    assert.match(result.stdout, /body line 1/)
})

test("checks local assets at the site's URL base, not relative to Markdown files", async (t) => {
    const root = await fixture(t, {
        "home.md": page("![Good](content/images/ok.svg)\n![Bad](images/ok.svg)\n![External](https://example.invalid/image.png)"),
        "images/ok.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    })
    const result = run(root)
    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stdout, /Missing published file: content\/images\/ok.svg/)
    assert.match(result.stdout, /images\/ok.svg/)
    assert.doesNotMatch(result.stdout, /ERROR.*example.invalid/)
})

test("uses the vendored strict KaTeX renderer", async (t) => {
    const root = await fixture(t, { "home.md": page("$\\notARealCommand{x}$") })
    const result = run(root)
    assert.equal(result.status, 1, result.stdout)
    assert.match(result.stdout, /KaTeX parse error/)
})

test("loads custom statuses and renders registered formats and linked query variants", async (t) => {
    const root = await fixture(t, {
        "_config.md": "---\ntitle: Test\ndescription: Custom formats\nhome: home\nextensions: [extensions/catalogue.js]\n---\n",
        "custom.js": 'export default ({ setStatuses }) => setStatuses(["draft"])',
        "home.md": page("[[catalogue.po?entry=good#Notes]]\n[[catalogue.po?entry=bad]]", "draft"),
        "catalogue.po": "Catalogue",
        "extensions/catalogue.js": `export default { extensions: [".po"], render({ source, query, helpers }) {
            if (query.get("entry") === "bad") throw new Error("Unknown catalogue entry")
            return { data: { title: source, status: "draft" }, html: helpers.renderMarkdown("## Notes"), className: "prose" }
        } }`,
    })
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /Unknown catalogue entry/)
    assert.doesNotMatch(result.stdout, /requires status|Section not found/)
    assert.match(result.stdout, /Checked 2 pages/)
})

test("query-required custom pages only need to render their linked variants", async (t) => {
    const root = await fixture(t, {
        "_config.md": "---\ntitle: Test\ndescription: Queries\nhome: catalogue.po?entry=one\nextensions: [renderer.js]\n---\n",
        "_sidebar.md": "- [[catalogue.po?entry=one]]\n",
        "renderer.js": `export default { extensions: [".po"], render({ query }) {
            if (!query.has("entry")) throw new Error("Choose an entry")
            return { data: { title: "Entry", status: "accepted" }, html: "<p>Entry</p>" }
        } }`,
        "catalogue.po": "Entry one",
    })
    const result = run(root)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.doesNotMatch(result.stdout, /ERROR/)
})

test("defers browser-only customization and renderers with explicit warnings", async (t) => {
    const root = await fixture(t, {
        "custom.js": 'export default ({ registerStatus }) => { document.title = "Test"; registerStatus("review") }',
        "home.md": page("[[catalogue.po]]", "review"),
        "_config.md": "---\ntitle: Test\ndescription: Browser formats\nhome: home\nextensions: [renderer.js]\n---\n",
        "renderer.js": `export default { extensions: [".po"], render() {
            return { data: { title: document.title, status: "review" }, html: "<p>Browser content</p>" }
        } }`,
        "catalogue.po": "Browser content",
    })
    const result = run(root)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout, /WARNING custom.js.*Browser-dependent/)
    assert.match(result.stdout, /WARNING catalogue.po.*--browser/)
    assert.equal(run(root, "--strict").status, 1)
})

test("comment-only customization has no default export; explicit invalid default is rejected", async (t) => {
    const root = await fixture(t, { "custom.js": "// No configuration.\n" })
    assert.equal(run(root).status, 0)
    await writeFile(join(root, "custom.js"), "export default {}\n")
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /must export a default configure function/)
})

test("accepts directory links and canonicalizes runtime-supported hash routes", async (t) => {
    const root = await fixture(t, { "home.md": page("[Home](./)\n[Home hash](#home)") })
    const result = run(root)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const { validateWiki } = await import("../scripts/validate.mjs")
    const validated = await validateWiki({ source: root })
    assert.ok(validated.routes.includes("#/home"))
    assert.ok(validated.routes.every((route) => route.startsWith("#/")))
})

test("reports invalid config and sidebar structure independently", async (t) => {
    const root = await fixture(t, {
        "_config.md": "---\ntitle: Test\ndescription: []\nhome: home\n---\n",
        "_sidebar.md": "- Category without a link\n  - [[Home]]\n",
    })
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /_config.md.*description/)
    assert.match(result.stdout, /_sidebar.md.*Every collapsible sidebar category/)
})

test("validates extension registration, renderer output and excluded assets", async (t) => {
    const root = await fixture(t, {
        "_config.md": "---\ntitle: Test\ndescription: Extensions\nhome: home\nextensions: [renderer.mjs, duplicate.mjs]\n---\n",
        "renderer.mjs": 'export default { extensions: [".po"], render() { return { data: { title: "Bad", status: "accepted" }, html: 42 } } }',
        "duplicate.mjs": 'export default { extensions: [".po"], render() { return {} } }',
        "catalogue.po": "Catalogue",
        "home.md": page("[[catalogue.po]]\n![Private](content/.secret.svg)"),
        ".secret.svg": "<svg/>",
    })
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /already registered for .po/)
    assert.match(result.stdout, /must return HTML/)
    assert.match(result.stdout, /Missing published file: content\/.secret.svg/)
})
