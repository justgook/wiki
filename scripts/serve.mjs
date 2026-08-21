import { createReadStream, existsSync } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import { dirname, extname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const contentRoot = resolve(process.argv[2] || ".")
const port = Number(process.argv[3] || 8080)
const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".ttf": "font/ttf",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}

for (const required of ["_config.md", "_sidebar.md"]) {
    if (!existsSync(resolve(contentRoot, required))) {
        console.error(`Wiki content is missing ${required}: ${contentRoot}`)
        process.exit(1)
    }
}

function safePath(root, relativePath) {
    const file = resolve(root, relativePath)
    return file === root || file.startsWith(`${root}${sep}`) ? file : null
}

function requestedFile(pathname) {
    if (pathname === "/content" || pathname.startsWith("/content/")) {
        return safePath(contentRoot, pathname.slice("/content".length).replace(/^\/+/, ""))
    }
    if (pathname === "/custom.css" && existsSync(resolve(contentRoot, "custom.css"))) {
        return resolve(contentRoot, "custom.css")
    }
    if (pathname === "/favicon.svg" && existsSync(resolve(contentRoot, "favicon.svg"))) {
        return resolve(contentRoot, "favicon.svg")
    }
    return safePath(engineRoot, `.${pathname}`)
}

createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname)
        let file = requestedFile(pathname)
        if (!file) {
            response.writeHead(403).end("Forbidden\n")
            return
        }

        let info = await stat(file)
        if (info.isDirectory()) {
            file = resolve(file, "index.html")
            info = await stat(file)
        }
        if (!info.isFile()) throw new Error("Not a file")

        response.writeHead(200, {
            "Cache-Control": "no-store",
            "Content-Length": info.size,
            "Content-Type": mimeTypes[extname(file).toLowerCase()] || "application/octet-stream",
        })
        if (request.method === "HEAD") response.end()
        else createReadStream(file).pipe(response)
    } catch {
        response.writeHead(404, {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
        }).end("Not found\n")
    }
}).listen(port, "127.0.0.1", () => {
    console.log(`Wiki available at http://localhost:${port}`)
    console.log(`Serving live content from ${contentRoot}`)
})
