#!/usr/bin/env node
/**
 * Local preview server for site/ — `npm run serve`, then open the printed URL.
 * Static only, no dependencies.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const siteDir = resolve(new URL('../docs/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const port = Number(process.env.PORT ?? 8787)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname
  const target = normalize(join(siteDir, pathname))
  if (!target.startsWith(siteDir)) {
    response.writeHead(403).end('forbidden')
    return
  }
  try {
    const body = await readFile(target)
    response.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`preview: http://127.0.0.1:${port}/`)
  console.log(`index  : http://127.0.0.1:${port}/index.json`)
})
