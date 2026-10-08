import assert from "node:assert/strict"
import test from "node:test"
import { inspectHTML } from "../scripts/inspect-html.mjs"

test("parses links and resources, decoding entities and ignoring escaped markup", () => {
    const result = inspectHTML(`
        <a data-page="Guide" href="#/guide?a=1&amp;b=2">Guide</a>
        <A HREF='other?x=&quot;quoted&quot;'>Other</A>
        <a id="without-href">Not a link</a>
        <img src="pic&#46;png"><source src='clip.webm'>
        <video src=video.mp4 poster="cover.png"></video><audio src="audio.ogg"></audio>
        <script src="main.js"></script><link href="theme.css">
        <pre><code>&lt;a href="fake"&gt;&lt;img src="fake.png"&gt;</code></pre>
        <!-- <img src="comment.png"> -->
        <script>const example = '<a href="script-fake">';</script>
    `)
    assert.deepEqual(result.links, [
        { href: "#/guide?a=1&b=2", wiki: true },
        { href: 'other?x="quoted"', wiki: false },
    ])
    assert.deepEqual(result.assets, ["pic.png", "clip.webm", "video.mp4", "cover.png", "audio.ogg", "main.js", "theme.css"])
})

test("outline matches heading selector, text content and duplicate IDs", () => {
    const result = inspectHTML(`
        <h2 id="stale">Hello <em>World</em><!-- ignored --></h2>
        <h3>Hello World</h3><h2>Hello World</h2>
        <h2 class="sr-only" id="hidden">Hidden</h2>
        <h3 class="sr-only">Third Level</h3>
        <h1 id="title">Title</h1><h4 id="fourth">Fourth</h4>
        <h2>!!!</h2><span id="fn:1"></span><a href="#fn:1">1</a>
    `)
    assert.deepEqual([...result.sections], ["hello-world", "hello-world-2", "hello-world-3", "hidden", "third-level", "title", "fourth", "section-5", "fn:1"])
    assert.equal(result.sections.has("stale"), false)
    assert.deepEqual(result.links, [{ href: "#fn:1", wiki: false }])
})

test("custom-rendered content only generates IDs within actual prose containers", () => {
    const result = inspectHTML(`<h2 id="outside">Outside</h2>
        <div class="custom prose"><section><h2 id="old">Inside</h2></section></div>
        <h3>Not Prose</h3>`, { prose: false })
    assert.deepEqual([...result.sections], ["outside", "inside"])
    assert.deepEqual([...inspectHTML("<h2>Default</h2>").sections], ["default"])
})

test("sidebar categories require a direct anchor only for top-level list items", () => {
    const html = `<ul>
        <li><a href="#/good">Good</a><ul><li>Nested<ul><li>Child</li></ul></li></ul></li>
        <li><p><a href="#/bad">Indirect</a></p><ul><li>Child</li></ul></li>
        <li>No children</li>
        <li><a>No href required by category markup rule</a><ul><li>Child</li></ul></li>
    </ul><div><ul><li>Not top-level<ul><li>Child</li></ul></li></ul></div>`
    for (const prose of [true, false]) {
        assert.deepEqual(inspectHTML(html, { prose }).sidebarErrors, ["Every collapsible sidebar category must link to a content page"])
    }
})

test("HTML parser handles unquoted attributes, void tags and omitted list closing tags", () => {
    const result = inspectHTML('<ul><li><a href=one>One</a><li><a data-page=two href=two>Two</a></ul><img src=asset.png>')
    assert.deepEqual(result.links, [{ href: "one", wiki: false }, { href: "two", wiki: true }])
    assert.deepEqual(result.assets, ["asset.png"])
    assert.deepEqual(result.sidebarErrors, [])
})
