// A local-only static server for testing the production export, including
// extensionless Expo routes. It never proxies weather or geocoding requests.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const port = 4173;
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

async function serve(request, response) {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (path.relative(root, file).startsWith('..') || pathname.startsWith('/api/')) {
      response.writeHead(404).end();
      return;
    }
    const filename = path.extname(file) ? file : path.join(file, 'index.html');
    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': mime[path.extname(filename)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}

const server = createServer((request, response) => {
  void serve(request, response);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Serving the web export at http://127.0.0.1:${port}`);
});
