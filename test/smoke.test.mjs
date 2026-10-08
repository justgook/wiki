import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { smokeWiki } from "../scripts/smoke.mjs"

// These checks do not need Playwright and do not start a server.
test("browser smoke rejects invalid routes as diagnostics", async () => {
    const diagnostics = await smokeWiki({ source: "content", routes: ["https://example.com"] })
    assert.equal(diagnostics.length, 1)
    assert.equal(diagnostics[0].severity, "error")
    assert.equal(diagnostics[0].file, "content")
    assert.match(diagnostics[0].message, /beginning with #\//)
})

test("empty browser route list does not load optional dependencies", async () => {
    assert.deepEqual(await smokeWiki({ source: "does-not-exist", routes: [] }), [])
})

let hasPlaywright = false
try { import.meta.resolve("playwright"); hasPlaywright = true } catch {}

test("missing optional Playwright gives actionable instructions", { skip: hasPlaywright }, async () => {
    const diagnostics = await smokeWiki({ source: "content", routes: ["#/"] })
    assert.equal(diagnostics.length, 1)
    assert.match(diagnostics[0].message, /optional Playwright/)
    assert.match(diagnostics[0].message, /npm install/)
    assert.match(diagnostics[0].message, /playwright install chromium/)
})

// Explicitly opt in after installing Playwright + Chromium: WIKI_BROWSER_TEST=1 node --test test/smoke.test.mjs
// No dependency installation or browser download is performed by this test.
test("browser smoke exercises home, controls, rendering errors and broken assets", {
    skip: process.env.WIKI_BROWSER_TEST !== "1",
    timeout: 120_000,
}, async () => {
    const source = await mkdtemp(join(tmpdir(), "wiki-smoke-"))
    try {
        await Promise.all([
            writeFile(join(source, "_config.md"), "---\ntitle: Smoke\ndescription: Browser smoke fixture\nhome: welcome\n---\n"),
            writeFile(join(source, "_sidebar.md"), "## Pages\n\n- [[Welcome]]\n- [[Second]]\n"),
            writeFile(join(source, "welcome.md"), "---\ntitle: Welcome\nstatus: accepted\n---\n\n## Diagram\n\n```mermaid\ngraph LR\n A --> B\n```\n"),
            writeFile(join(source, "second.md"), "---\ntitle: Second\nstatus: accepted\n---\n\n## Section\n\nHello.\n"),
        ])
        assert.deepEqual(await smokeWiki({ source, routes: ["#/", "#/second"] }), [])

        const site = join(source, ".site")
        const build = spawnSync("bash", [fileURLToPath(new URL("../scripts/build.sh", import.meta.url)), source, site], { encoding: "utf8" })
        assert.equal(build.status, 0, build.stdout + build.stderr)
        await writeFile(join(site, "custom.js"), 'export default () => { throw new Error("Staged customization ran") }')
        const staged = await smokeWiki({ source: join(site, "content"), site, routes: ["#/"] })
        assert.ok(staged.some(({ message }) => /Staged customization ran/.test(message)), JSON.stringify(staged))

        await writeFile(join(source, "second.md"), "---\ntitle: Second\nstatus: accepted\n---\n\n![Missing](content/missing.png)\n")
        const broken = await smokeWiki({ source, routes: ["#/second"] })
        assert.ok(broken.some(({ message }) => /Local HTTP 404.*missing\.png/.test(message)), JSON.stringify(broken))
        assert.ok(broken.some(({ message }) => /Broken image:.*missing\.png/.test(message)), JSON.stringify(broken))

        const fatal = await smokeWiki({ source, routes: ["#/missing"] })
        assert.ok(fatal.some(({ message }) => /Wiki failed to load/.test(message)), JSON.stringify(fatal))
    } finally {
        await rm(source, { recursive: true, force: true })
    }
})
