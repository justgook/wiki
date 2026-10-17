import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { mountedTarget, subwikiURL, validateConfig, validateSubwikis } from "../app.js"

const config = (subwikis) => ({ title: "Parent", description: "Parent wiki", home: "home", ...(subwikis === undefined ? {} : { subwikis }) })

test("validateSubwikis accepts omitted, empty and multiple HTTP(S) mounts without mutation", () => {
    assert.deepEqual(validateSubwikis(), {})
    const mounts = Object.freeze({
        engine: Object.freeze({ url: "https://example.com/docs/" }),
        "engine-v2": Object.freeze({ url: "http://localhost:8080/wiki" }),
        a1: Object.freeze({ url: "https://example.org" }),
    })
    assert.equal(validateSubwikis(mounts), mounts)
    const empty = {}
    assert.equal(validateSubwikis(empty), empty)
})

test("validateSubwikis rejects non-object declarations", () => {
    for (const value of [null, [], "https://example.com/", 42, false]) {
        assert.throws(() => validateSubwikis(value), /subwikis must be an object/, JSON.stringify(value))
    }
})

test("validateSubwikis reserves lowercase, hyphen-separated top-level IDs", () => {
    for (const id of ["", "Engine", "engine/docs", "engine_docs", "-engine", "engine-", "engine--docs", "1engine", "engine.docs", "engine?query"]) {
        assert.throws(() => validateSubwikis({ [id]: { url: "https://example.com/" } }), /Invalid subwiki ID/, id)
    }
})

test("validateSubwikis requires mount objects with string URLs", () => {
    for (const mount of [null, [], "https://example.com/", {}, { url: 42 }, { url: null }]) {
        assert.throws(() => validateSubwikis({ engine: mount }), /Subwiki engine requires a url/, JSON.stringify(mount))
    }
})

test("validateSubwikis rejects relative, non-HTTP, credentialed and stateful site URLs", () => {
    for (const url of ["", "not a URL", "/docs/", "//example.com/docs/", "ftp://example.com/", "file:///docs/", "javascript:alert(1)", "https://user@example.com/", "https://user:pass@example.com/", "https://example.com/?q=1", "https://example.com/#/home"]) {
        assert.throws(() => validateSubwikis({ engine: { url } }), /subwiki/i, url)
    }
})

test("subwikiURL normalizes exactly one trailing slash without changing the site path", () => {
    for (const [url, expected] of [
        ["https://example.com", "https://example.com/"],
        ["https://example.com/", "https://example.com/"],
        ["https://example.com/docs", "https://example.com/docs/"],
        ["https://example.com/docs///", "https://example.com/docs/"],
        ["http://localhost:8080/a/b/", "http://localhost:8080/a/b/"],
    ]) {
        const mount = Object.freeze({ url })
        assert.equal(subwikiURL(mount), expected)
        assert.equal(mount.url, url)
    }
})

test("mountedTarget namespaces plain and hash routes while preserving queries and sections", () => {
    for (const target of ["guide", "#/guide", "#guide"]) assert.equal(mountedTarget("engine", target), "engine/guide")
    for (const target of ["", "#", "#/"]) assert.equal(mountedTarget("engine", target), "engine/")
    assert.equal(mountedTarget("engine-v2", "#/api/reference?entry=one%20two&section=notes"), "engine-v2/api/reference?entry=one%20two&section=notes")
    assert.equal(mountedTarget("engine", "guide#notes"), "engine/guide#notes")
})

test("validateConfig keeps existing configs compatible and validates subwiki declarations", () => {
    const local = config()
    assert.equal(validateConfig(local), local)
    const mounted = config({ engine: { url: "https://example.com/docs/" } })
    assert.equal(validateConfig(mounted), mounted)
    for (const subwikis of [null, [], { Engine: { url: "https://example.com/" } }, { engine: { url: "/relative/" } }]) {
        assert.throws(() => validateConfig(config(subwikis)), /subwiki/i)
    }
    for (const key of ["title", "description", "home"]) {
        for (const value of [undefined, "", "  ", 42]) {
            assert.throws(() => validateConfig({ ...mounted, [key]: value }), /requires a non-empty/)
        }
    }
    assert.throws(() => validateConfig({ ...mounted, extensions: "renderer.js" }), /extensions must be an array/)
})

// Explicit opt-in, matching smoke.test.mjs. Install Playwright + Chromium separately;
// the default unit suite neither imports Playwright nor starts HTTP servers.
// WIKI_BROWSER_TEST=1 node --test test/subwikis.test.mjs
test("browser mounts are lazy, namespaced, remotely resolved and recoverable", {
    skip: process.env.WIKI_BROWSER_TEST !== "1",
    timeout: 120_000,
}, async (t) => {
    const { chromium } = await import("playwright")
    const root = fileURLToPath(new URL("../", import.meta.url))
    const requests = []
    let unavailable = false
    const frontmatter = (title, body) => `---\ntitle: ${title}\nstatus: accepted\n---\n\n${body}\n`
    const childFiles = {
        "/docs/content/_config.md": "---\ntitle: Child engine\ndescription: Child documentation\nhome: start\nextensions: [remote-renderer.js]\n---\n",
        "/docs/content/_sidebar.md": "- [[start|Child start]]\n- [[guide|Child guide]]\n",
        "/docs/content/start.md": frontmatter("Child start", "Child landing page.\n\n[[guide?mode=full#Details|Query guide]]\n\n[Local section](#details)\n\n## Details\n\n![Remote image](content/picture.svg)\n\n@[code javascript](examples/source.js)"),
        "/docs/content/guide.md": frontmatter("Child guide", "Child guide body.\n\n## Details\n\nDeep section.\n\n[[start|Back to child]]"),
        "/docs/content/examples/source.js": "const remoteInclude = 42\n",
        "/docs/content/picture.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2"/></svg>',
    }
    const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".md": "text/plain" }
    async function serve(handler) {
        const server = createServer((request, response) => {
            Promise.resolve(handler(request, response)).catch(() => {
                response.writeHead(404)
                response.end("Not found")
            })
        })
        await new Promise((resolve, reject) => {
            server.once("error", reject)
            server.listen(0, "127.0.0.1", resolve)
        })
        t.after(() => new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve())
            server.closeAllConnections()
        }))
        return `http://127.0.0.1:${server.address().port}/`
    }
    const childOrigin = await serve((request, response) => {
        const path = new URL(request.url, "http://fixture/").pathname
        requests.push(path)
        response.setHeader("Access-Control-Allow-Origin", "*")
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("Content-Type", types[extname(path)] || "text/plain")
        if (unavailable) { response.writeHead(503); response.end("Temporarily unavailable"); return }
        if (!Object.hasOwn(childFiles, path)) { response.writeHead(404); response.end("Not found"); return }
        response.end(childFiles[path])
    })
    const childURL = `${childOrigin}docs/`
    const parentFiles = {
        "/content/_config.md": `---\ntitle: Parent wiki\ndescription: Parent documentation\nhome: home\nsubwikis: ${JSON.stringify({ engine: { url: childURL } })}\n---\n`,
        "/content/_sidebar.md": "- [[home|Parent home]]\n- [[engine|Engine docs]]\n",
        "/content/home.md": frontmatter("Parent home", "Parent remains usable."),
    }
    const parentURL = await serve(async (request, response) => {
        const path = decodeURIComponent(new URL(request.url, "http://fixture/").pathname)
        response.setHeader("Cache-Control", "no-store")
        if (Object.hasOwn(parentFiles, path)) { response.end(parentFiles[path]); return }
        const file = resolve(root, `.${path === "/" ? "/index.html" : path}`)
        if (!file.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) { response.writeHead(403); response.end(); return }
        const body = await readFile(file)
        response.setHeader("Content-Type", types[extname(file)] || "application/octet-stream")
        response.end(body)
    })
    const browser = await chromium.launch({ headless: true })
    t.after(() => browser.close())
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    page.setDefaultTimeout(15_000)
    const rendered = async (title) => {
        await page.waitForFunction((title) => document.querySelector('#article[data-render-state="ready"] h1')?.textContent === title, title)
    }
    await page.goto(parentURL)
    await rendered("Parent home")
    assert.deepEqual(requests, [], "initial parent rendering must not contact the child")

    // This exported helper needs a real DOM, so exercise it only in the browser.
    const rewritten = await page.evaluate(async (siteURL) => {
        const { rewriteMountedHTML } = await import("./app.js")
        const template = document.createElement("template")
        template.innerHTML = rewriteMountedHTML(`
            <a id="absolute" href="${siteURL}#/guide?mode=full&section=details">Guide</a>
            <a id="external" href="https://example.org/elsewhere">External</a>
            <a id="footnote" data-footnote-ref href="#fn1">Footnote</a>
            <a id="backref" data-footnote-backref href="#fnref1">Back</a>
            <video poster="content/poster.svg" src="content/movie.webm"></video>
            <img srcset="content/small.svg 1x, content/large.svg 2x">
            <img id="inline" src="data:image/png;base64,AAAA" srcset="data:image/png;base64,AAAA 1x">
        `, "engine", siteURL, "start")
        const holder = template.content
        return {
            absolute: holder.querySelector("#absolute").getAttribute("href"),
            page: holder.querySelector("#absolute").dataset.page,
            external: holder.querySelector("#external").getAttribute("href"),
            footnote: holder.querySelector("#footnote").getAttribute("href"),
            backref: holder.querySelector("#backref").getAttribute("href"),
            poster: holder.querySelector("video").getAttribute("poster"),
            video: holder.querySelector("video").getAttribute("src"),
            srcset: holder.querySelector("img").getAttribute("srcset"),
            inline: holder.querySelector("#inline").getAttribute("srcset"),
        }
    }, childURL)
    assert.deepEqual(rewritten, {
        absolute: "#/engine/guide?mode=full&section=details",
        page: "engine/guide",
        external: "https://example.org/elsewhere",
        footnote: "#fn1",
        backref: "#fnref1",
        poster: `${childURL}content/poster.svg`,
        video: `${childURL}content/movie.webm`,
        srcset: `${childURL}content/small.svg 1x, ${childURL}content/large.svg 2x`,
        inline: "data:image/png;base64,AAAA 1x",
    })

    await page.getByRole("button", { name: "Expand Engine docs", exact: true }).click()
    await page.locator('#tree a[data-page="engine/guide"]').waitFor({ state: "visible" })
    assert.deepEqual(requests, ["/docs/content/_config.md", "/docs/content/_sidebar.md"])
    assert.equal(await page.locator("#article h1").textContent(), "Parent home")
    await page.locator('#tree a[data-page="engine"]').click()
    await rendered("Child start")
    assert.equal(await page.locator(".subwiki-original").getAttribute("href"), `${childURL}#/start`)
    assert.equal(await page.locator('#article a:has-text("Query guide")').getAttribute("href"), "#/engine/guide?mode=full&section=details")
    assert.equal(await page.locator('#article a:has-text("Local section")').getAttribute("href"), "#/engine/start?section=details")
    assert.equal(await page.locator('#article img[alt="Remote image"]').getAttribute("src"), `${childURL}content/picture.svg`)
    assert.match(await page.locator("#article .code-include").textContent(), /remoteInclude = 42/)
    assert.ok(requests.includes("/docs/content/examples/source.js"))
    assert.ok(requests.includes("/docs/content/picture.svg"))
    await page.waitForFunction(() => [...document.querySelectorAll('#article img')].every((image) => image.complete && image.naturalWidth > 0))

    await page.locator('#article a:has-text("Query guide")').click()
    await rendered("Child guide")
    assert.equal(new URL(page.url()).hash, "#/engine/guide?mode=full&section=details")
    await page.reload()
    await rendered("Child guide")
    assert.equal(new URL(page.url()).hash, "#/engine/guide?mode=full&section=details")
    assert.equal(await page.locator('#tree a[data-page="engine/guide"]').count(), 1)
    assert.ok(requests.includes("/docs/content/guide.md"))
    assert.equal(await page.locator('#article a:has-text("Back to child")').getAttribute("href"), "#/engine/start")

    // A fresh parent load drops the successful mount cache before simulating failure.
    unavailable = true
    await page.goto(parentURL)
    await rendered("Parent home")
    await page.getByRole("button", { name: "Expand Engine docs", exact: true }).click()
    await page.getByRole("button", { name: "Retry", exact: true }).waitFor()
    assert.match(await page.locator('[data-subwiki="engine"]').textContent(), /Subwiki unavailable/)
    assert.equal(await page.locator("#article h1").textContent(), "Parent home")
    await page.locator('#tree a[data-page="home"]').click()
    await rendered("Parent home")
    const attempts = requests.filter((path) => path === "/docs/content/_config.md").length
    unavailable = false
    await page.getByRole("button", { name: "Retry", exact: true }).click()
    await page.locator('#tree a[data-page="engine/guide"]').waitFor({ state: "visible" })
    assert.equal(requests.filter((path) => path === "/docs/content/_config.md").length, attempts + 1)
    await page.locator('#tree a[data-page="engine/guide"]').click()
    await rendered("Child guide")
    await page.locator('#tree a[data-page="home"]').click()
    await rendered("Parent home")

    // Direct-route failures offer article retry and do not poison same-page routing.
    unavailable = true
    await page.goto(`${parentURL}#/engine/guide`)
    await page.waitForSelector('#article[data-render-state="error"]')
    assert.equal(await page.locator('#tree a[data-page="home"]').count(), 1)
    unavailable = false
    await page.locator('#article button').click()
    await rendered("Child guide")
    assert.ok(!requests.some((path) => /remote-renderer|custom\.js|custom\.css/.test(path)), "remote modules and styling must not be loaded")
})
