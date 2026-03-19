#!/usr/bin/env node
/**
 * Minimal development server with live reload.
 * No dependencies — uses only Node.js built-ins.
 *
 * Usage: node dev-server.js [port]
 *
 * Serves files from the scaffold directory with proper MIME types
 * and injects a live-reload script that watches for file changes.
 */

import { createServer } from 'http';
import { readFile, stat, watch } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2] || '3000', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
};

// SSE clients for live reload
const clients = new Set();

// Live reload script injected into HTML responses
const RELOAD_SCRIPT = `
<script>
(function() {
  const es = new EventSource('/__reload');
  es.onmessage = () => location.reload();
  es.onerror = () => setTimeout(() => location.reload(), 1000);
})();
</script>`;

const server = createServer(async (req, res) => {
  // SSE endpoint for live reload
  if (req.url === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('data: connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const filePath = join(__dirname, urlPath);

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');

    let content = await readFile(filePath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    // Set headers that support WASM + SharedArrayBuffer (for future WASM toys)
    const headers = {
      'Content-Type': mime,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    };

    // Inject live reload into HTML
    if (ext === '.html') {
      let html = content.toString('utf-8');
      html = html.replace('</body>', `${RELOAD_SCRIPT}\n</body>`);
      content = html;
    }

    res.writeHead(200, headers);
    res.end(content);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

// Watch for file changes and notify clients
async function watchFiles() {
  try {
    const watcher = watch(__dirname, { recursive: true });
    for await (const event of watcher) {
      if (event.filename && !event.filename.startsWith('.')) {
        for (const client of clients) {
          client.write('data: reload\n\n');
        }
      }
    }
  } catch (e) {
    // Recursive watch may not be supported; fall back silently
    console.warn('File watching not available — live reload disabled');
  }
}

server.listen(PORT, () => {
  console.log(`\n  audiotoy dev server`);
  console.log(`  ───────────────────`);
  console.log(`  Local:   http://localhost:${PORT}/`);
  console.log(`  Example: http://localhost:${PORT}/examples/theremin.html`);
  console.log(`\n  Watching for changes...\n`);
  watchFiles();
});
