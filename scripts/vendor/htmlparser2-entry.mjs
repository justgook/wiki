// Build-only entry, copied to the temporary npm directory before bundling.
// Equivalent to htmlparser2@10.0.0's parseDocument helper; importing Parser
// directly avoids retaining the unrelated feed/serializer modules.
import { Parser } from "./node_modules/htmlparser2/dist/esm/Parser.js"
import { DomHandler } from "domhandler"

export function parseDocument(data, options = {}) {
    const handler = new DomHandler(undefined, options)
    new Parser(handler, options).end(data)
    return handler.root
}
