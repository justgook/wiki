import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { isDarkColorScheme, readDiagramTheme } from "../theme.js"

const values = {
    "--bg": "#fff", "--diagram-bg": "rgb(240, 240, 240)",
    "--diagram-node-bg": "color-mix(in srgb, white 90%, blue)",
    "--diagram-border": "#444", "--diagram-text": "#111",
    "--diagram-muted": "#555", "--diagram-faint": "#777",
    "--diagram-accent": "rebeccapurple", "--diagram-accent-ink": "white",
    "--diagram-line": "#888", "--font-sans": "sans-serif", "--diagram-font-size": "18px",
    ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`--chart-${i + 1}`, `color-${i + 1}`])),
}
const styles = { colorScheme: "light", getPropertyValue: name => values[name] || "" }

test("diagram theme delegates CSS colors to browser resolver; preserves font and light mode", () => {
    const calls = []
    const theme = readDiagramTheme(styles, (value, background) => {
        calls.push({ value, background })
        return value === "#fff" ? "#ffffff" : "#123456"
    })
    assert.equal(theme.darkMode, false)
    assert.equal(theme.fontFamily, "sans-serif")
    assert.equal(theme.fontSize, "18px")
    assert.equal(theme.colors.raised, "#123456")
    assert.ok(calls.some(call => call.value.startsWith("color-mix(")))
    assert.ok(calls.some(call => call.value.startsWith("rgb(")))
    assert.equal(calls[1].background, "#ffffff")
    assert.deepEqual(theme.palette, Array(8).fill("#123456"))
})

test("mode follows color-scheme; ambiguous/normal schemes follow browser preference", () => {
    assert.equal(isDarkColorScheme("dark"), true)
    assert.equal(isDarkColorScheme("only light", true), false)
    assert.equal(isDarkColorScheme("light dark", true), true)
    assert.equal(isDarkColorScheme("light dark", false), false)
    assert.equal(isDarkColorScheme("normal", true), true)
})

test("missing diagram tokens report names", () => {
    assert.throws(() => readDiagramTheme({ colorScheme: "dark", getPropertyValue: () => "" }, x => x), /--bg/)
})

test("every root token documented; every referenced token declared", async () => {
    const css = await readFile(new URL("../style.css", import.meta.url), "utf8")
    const docs = await readFile(new URL("../THEMING.md", import.meta.url), "utf8")
    const declared = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]))
    for (const name of declared) assert.ok(docs.includes(`\`${name}\``), `Undocumented token: ${name}`)
    for (const [, name] of css.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(declared.has(name), `Missing token: ${name}`)
})
