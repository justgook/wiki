/* Browser resolves CSS colors; Mermaid receives opaque sRGB hex. */
export function resolveCSSColor(value, background = "#000000") {
    const probe = document.createElement("span")
    probe.style.color = value
    if (!probe.style.color) throw new Error(`Invalid wiki theme color: ${value}`)
    probe.hidden = true
    document.documentElement.append(probe)
    let color
    try {
        color = getComputedStyle(probe).color
    } finally {
        probe.remove()
    }
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("Wiki diagram themes require Canvas 2D")
    context.fillStyle = background
    context.fillRect(0, 0, 1, 1)
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const channels = context.getImageData(0, 0, 1, 1).data
    return `#${[...channels].slice(0, 3).map(channel => channel.toString(16).padStart(2, "0")).join("")}`
}

export function isDarkColorScheme(scheme, prefersDark = false) {
    const modes = scheme.split(/\s+/).filter(mode => mode === "light" || mode === "dark")
    return modes.length === 1 ? modes[0] === "dark" : prefersDark
}

export function readDiagramTheme(
    styles = getComputedStyle(document.documentElement),
    resolveColor = resolveCSSColor,
    prefersDark = globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches || false,
) {
    const value = name => {
        const result = styles.getPropertyValue(name).trim()
        if (!result) throw new Error(`Wiki theme requires the “${name}” CSS custom property`)
        return result
    }
    const darkMode = isDarkColorScheme(styles.colorScheme, prefersDark)
    const background = resolveColor(value("--bg"), darkMode ? "#000000" : "#ffffff")
    const color = (name, backdrop = background) => {
        try {
            return resolveColor(value(name), backdrop)
        } catch (error) {
            throw new Error(`Wiki theme color ${name}: ${error.message}`, { cause: error })
        }
    }
    const surface = color("--diagram-bg")
    return {
        darkMode,
        fontFamily: value("--font-sans"),
        fontSize: value("--diagram-font-size"),
        colors: {
            background,
            surface,
            raised: color("--diagram-node-bg", surface),
            borderStrong: color("--diagram-border", surface),
            text: color("--diagram-text", surface),
            muted: color("--diagram-muted", surface),
            faint: color("--diagram-faint", surface),
            accent: color("--diagram-accent", surface),
            accentInk: color("--diagram-accent-ink", surface),
            line: color("--diagram-line", surface),
        },
        palette: Array.from({ length: 8 }, (_, index) => color(`--chart-${index + 1}`, surface)),
    }
}
