import assert from "node:assert/strict"
import test from "node:test"

import {
    contentRequest,
    createRendererRegistry,
    escapeAttribute,
    pageURL,
    routePath,
    safeContentModulePath,
} from "../app.js"

test("keeps extensionless Markdown routes compatible", () => {
    assert.equal(routePath("Gameplay/Core Loop"), "gameplay/core-loop")
    assert.equal(pageURL("Gameplay/Core Loop"), "#/gameplay/core-loop")
})

test("preserves registered content extensions and query parameters", () => {
    const target = "game-text/dialogue.po?entry=dialogue.m01.com01"
    const extensions = new Set([".md", ".po"])
    assert.equal(routePath(target, extensions), "game-text/dialogue.po")
    assert.equal(pageURL(target, extensions), `#/${target}`)
})

test("keeps dotted targets as Markdown unless their extension is registered", () => {
    assert.equal(routePath("Release/v1.2", new Set([".md", ".po"])), "release/v1-2")
})

test("rejects encoded traversal in custom content paths", () => {
    const extensions = new Set([".md", ".po"])
    assert.throws(() => routePath("game-text/%2e%2e/dialogue.po", extensions), /Invalid content file target/)
    assert.throws(() => safeContentModulePath("wiki-extensions/%2e%2e/gettext.js"), /Extension module path/)
})

test("escapes values embedded in HTML attributes", () => {
    assert.equal(escapeAttribute('value" onmouseover="alert(1)'), "value&quot; onmouseover=&quot;alert(1)")
})

test("resolves content through the registered file extension", () => {
    const extensions = new Set([".md", ".po"])
    assert.deepEqual(contentRequest("missions/m01", extensions), {
        contentPath: "missions/m01.md",
        extension: ".md",
    })
    assert.deepEqual(contentRequest("game-text/dialogue.po", extensions), {
        contentPath: "game-text/dialogue.po",
        extension: ".po",
    })
})

test("rejects unregistered content extensions", () => {
    assert.throws(
        () => contentRequest("game-text/dialogue.po", new Set([".md"])),
        /No content renderer is registered for \.po/,
    )
})

test("validates project extension module paths", () => {
    assert.equal(safeContentModulePath("wiki-extensions/gettext.js"), "wiki-extensions/gettext.js")
    assert.throws(() => safeContentModulePath("../gettext.js"), /Invalid extension module path/)
    assert.throws(() => safeContentModulePath("https://example.com/gettext.js"), /must be relative/)
})

test("registers one renderer per extension", () => {
    const registry = createRendererRegistry()
    const renderer = { extensions: [".po"], render() {} }
    registry.register(renderer, "test renderer")
    assert.equal(registry.renderer(".po"), renderer)
    assert.throws(() => registry.register(renderer), /already registered/)
})
