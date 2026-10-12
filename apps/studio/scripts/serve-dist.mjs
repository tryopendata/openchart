/** Local QA server that proves the artifact works under a real nested mount. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
const root = resolve('dist');
const base = process.env.STUDIO_TEST_BASE_PATH || '/';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!path.startsWith(base)) throw new Error('Outside mount');
    const file = resolve(root, path.slice(base.length) || 'index.html');
    if (!file.startsWith(root + sep)) throw new Error('Outside artifact');
    const contents = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(contents);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(6008, '127.0.0.1', () => console.log(`Studio QA: http://127.0.0.1:6008${base}`));
