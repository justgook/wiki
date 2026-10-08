import { spawn } from "node:child_process"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const timeout = 15_000
const serveScript = fileURLToPath(new URL("./serve.mjs", import.meta.url))

function serverReady(server) {
    return new Promise((resolveReady, reject) => {
        let output = ""
        const timer = setTimeout(() => finish(new Error(`Wiki server did not become ready: ${output}`)), timeout)
        const onData = (data) => {
            output = `${output}${data}`.slice(-8000)
            const match = /http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/.exec(output)
            if (match && Number(match[1]) > 0) finish(null, `http://127.0.0.1:${match[1]}`)
        }
        const onError = (error) => finish(error)
        const onExit = (code) => finish(new Error(`Wiki server exited (${code}): ${output}`))
        function finish(error, origin) {
            clearTimeout(timer)
            server.stdout.off("data", onData)
            server.stderr.off("data", onData)
            server.off("error", onError)
            server.off("exit", onExit)
            if (error) reject(error)
            else resolveReady(origin)
        }
        server.stdout.on("data", onData)
        server.stderr.on("data", onData)
        server.once("error", onError)
        server.once("exit", onExit)
    })
}

async function stopServer(server) {
    if (!server?.pid || server.exitCode !== null || server.signalCode !== null) return
    await new Promise((done) => {
        const timer = setTimeout(() => server.kill("SIGKILL"), 2000)
        server.once("exit", () => { clearTimeout(timer); done() })
        server.kill("SIGTERM")
    })
}

async function rendered(page) {
    await page.waitForFunction(() => ["ready", "error"].includes(document.querySelector("#article")?.dataset.renderState), null, { timeout })
    const fatal = await page.locator("#article").evaluate((article) =>
        article.dataset.renderState === "error" ? article.textContent.trim() : null)
    if (fatal) throw new Error(fatal)
}

async function checkImages(page, origin, report) {
    // Lazy images below the fold must load too, not just those in the viewport.
    await page.locator("#article img").evaluateAll((images) => images.forEach((image) => { image.loading = "eager" }))
    await page.waitForFunction((origin) => [...document.querySelectorAll("#article img")]
        .filter((image) => image.src.startsWith(`${origin}/`)).every((image) => image.complete), origin, { timeout })
    const broken = await page.locator("#article img").evaluateAll((images) =>
        images.filter((image) => image.naturalWidth === 0).map((image) => image.currentSrc || image.src))
    for (const url of broken) {
        if (url.startsWith(`${origin}/`)) report(`Broken image: ${url}`)
    }
}

async function checkControls(page) {
    const category = page.locator("#tree .category-toggle").first()
    if (await category.count()) {
        const before = await category.getAttribute("aria-expanded")
        await category.click()
        await page.waitForFunction((before) => document.querySelector("#tree .category-toggle").getAttribute("aria-expanded") !== before, before)
        await category.click()
    }
    const filter = page.locator("#nav-filter")
    if (await page.locator("#tree a[data-page]").count()) {
        const label = (await page.locator("#tree a[data-page]").first().textContent()).trim()
        await filter.fill(label)
        await page.waitForFunction(() => document.querySelector("#tree mark.filter-match"))
        await filter.fill("wiki-smoke-no-match-7b3d9c")
        await page.waitForFunction(() => [...document.querySelectorAll("#tree a[data-page]")]
            .every((link) => link.closest("li")?.hidden))
        await filter.fill("")
        await page.waitForFunction(() => !document.querySelector("#tree li[hidden], #tree mark.filter-match"))
    }

    const outline = page.locator("#outline-links a").first()
    if (await outline.count()) {
        const section = await outline.getAttribute("data-section")
        await outline.click()
        await page.waitForFunction((id) => document.querySelector(`#outline-links a[aria-current="location"]`)?.dataset.section === id
            && new URLSearchParams(location.hash.split("?")[1]).get("section") === id
            && document.getElementById(id), section)
    }

    const expand = page.locator(".diagram-expand").first()
    if (await expand.count()) {
        await expand.click()
        await page.waitForFunction(() => document.querySelector("#diagram-dialog").open
            && document.querySelector("#diagram-canvas svg")
            && document.querySelector("#diagram-canvas").style.transform)
        const before = await page.locator("#diagram-zoom-level").textContent()
        await page.locator("#diagram-zoom-in").click()
        await page.waitForFunction((value) => document.querySelector("#diagram-zoom-level").textContent !== value, before)
        await page.locator("#diagram-zoom-out").click()
        await page.locator("#diagram-fit").click()
        await page.locator("#diagram-close").click()
        await page.waitForFunction(() => !document.querySelector("#diagram-dialog").open)
    }

    const adjacent = page.locator("#page-pagination a").first()
    if (await adjacent.count()) {
        const href = await adjacent.getAttribute("href")
        const previous = await page.locator("#article > :first-child").elementHandle()
        await adjacent.click()
        await page.waitForFunction(({ href }) => location.hash === href, { href })
        // Waiting only for 'ready' could observe the previous page before hashchange runs.
        await page.waitForFunction((node) => !node.isConnected, previous)
        await previous.dispose()
        await rendered(page)
    }
}

/** Explicit opt-in only; importing this module never loads Playwright or starts a server. */
export async function smokeWiki({ source, site, routes }) {
    const diagnostics = []
    let file = source || "."
    const report = (message) => diagnostics.push({ severity: "error", file, message })
    if (!Array.isArray(routes) || routes.some((route) => typeof route !== "string" || !route.startsWith("#/"))) {
        report("Browser smoke routes must be an array of site routes beginning with #/.")
        return diagnostics
    }
    if (!routes.length) return diagnostics

    let browser
    let server
    try {
        let chromium
        try {
            ;({ chromium } = await import("playwright"))
        } catch (error) {
            throw new Error(`Browser smoke requires optional Playwright. Install it in the engine directory with npm install --no-save --package-lock=false playwright, then run npx playwright install chromium. No browser is needed for normal validation. (${error.message})`)
        }
        try {
            browser = await chromium.launch({ headless: true })
        } catch (error) {
            throw new Error(`Could not launch Chromium for browser smoke. Run npx playwright install chromium (on Linux, system dependencies may also be required). ${error.message}`)
        }
        server = spawn(process.execPath, [serveScript, resolve(source || "."), "0", ...(site ? [resolve(site)] : [])], { stdio: ["ignore", "pipe", "pipe"] })
        const origin = await serverReady(server)
        const discovered = new Set(routes)
        for (const route of discovered) {
            if (discovered.size > 1000) { report("Too many browser routes (possible infinitely generated links)"); break }
            file = route
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
            page.setDefaultTimeout(timeout)
            page.on("console", (message) => { if (message.type() === "error") report(`console.error: ${message.text()}`) })
            page.on("pageerror", (error) => report(`Uncaught browser error: ${error.message}`))
            page.on("requestfailed", (request) => {
                if (request.url().startsWith(`${origin}/`)) report(`Local request failed: ${request.url()} (${request.failure()?.errorText})`)
            })
            page.on("response", (response) => {
                if (response.url().startsWith(`${origin}/`) && response.status() >= 400) {
                    report(`Local HTTP ${response.status()}: ${response.url()}`)
                }
            })
            try {
                await page.goto(`${origin}/${route}`, { waitUntil: "load", timeout })
                await rendered(page)
                const linkedRoutes = await page.locator('#article a[href^="#"], #tree a[href^="#"], #brand').evaluateAll((links) =>
                    links.filter((link) => !link.hasAttribute("data-footnote-ref") && !link.hasAttribute("data-footnote-backref"))
                        .map((link) => link.getAttribute("href")))
                for (const href of linkedRoutes) {
                    if (href?.startsWith("#")) discovered.add(href.startsWith("#/") ? href : `#/${href.slice(1)}`)
                }
                await checkImages(page, origin, report)
                await checkControls(page)
                await checkImages(page, origin, report)
            } catch (error) {
                report(`Browser smoke failed: ${error.message}`)
            } finally {
                await page.close()
            }
        }
    } catch (error) {
        report(error.message)
    } finally {
        // A browser close failure must not leave the local content server running.
        try { if (browser) await browser.close() } catch (error) { report(`Browser cleanup failed: ${error.message}`) }
        await stopServer(server)
    }
    return diagnostics
}
