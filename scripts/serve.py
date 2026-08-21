#!/usr/bin/env python3
"""Serve wiki engine assets overlaid with a live content directory."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import mimetypes
import sys

ENGINE_ROOT = Path(__file__).resolve().parent.parent
CONTENT_ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
PORT = int(sys.argv[2] if len(sys.argv) > 2 else "8080")

for required in ("_config.md", "_sidebar.md"):
    if not (CONTENT_ROOT / required).is_file():
        raise SystemExit(f"Wiki content is missing {required}: {CONTENT_ROOT}")


def safe_path(root, relative):
    candidate = (root / relative.lstrip("/")).resolve()
    try:
        candidate.relative_to(root)
        return candidate
    except ValueError:
        return None


def requested_file(pathname):
    if pathname == "/content" or pathname.startswith("/content/"):
        return safe_path(CONTENT_ROOT, pathname[len("/content"):])
    if pathname in ("/custom.css", "/favicon.svg"):
        override = CONTENT_ROOT / pathname[1:]
        if override.is_file():
            return override
    return safe_path(ENGINE_ROOT, pathname)


class WikiHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.serve(send_body=False)

    def do_GET(self):
        self.serve(send_body=True)

    def serve(self, send_body):
        try:
            pathname = unquote(urlsplit(self.path).path)
            file = requested_file(pathname)
            if file is None:
                self.send_error(403)
                return
            if file.is_dir():
                file = file / "index.html"
            if not file.is_file():
                self.send_error(404)
                return

            size = file.stat().st_size
            content_type = mimetypes.guess_type(str(file))[0] or "application/octet-stream"
            if file.suffix == ".po":
                content_type = "text/x-gettext-translation"
            if content_type.startswith("text/") or file.suffix in (".js", ".json", ".md", ".svg"):
                content_type += "; charset=utf-8"
            self.send_response(200)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(size))
            self.send_header("Content-Type", content_type)
            self.end_headers()
            if send_body:
                with file.open("rb") as source:
                    self.wfile.write(source.read())
        except (OSError, ValueError):
            self.send_error(404)


print(f"Wiki available at http://localhost:{PORT}")
print(f"Serving live content from {CONTENT_ROOT}")
ThreadingHTTPServer(("127.0.0.1", PORT), WikiHandler).serve_forever()
