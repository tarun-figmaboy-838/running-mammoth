/* Simulates a Vercel deploy of THIS repo, so a 404 can be reproduced locally.
   Serves the repo ROOT (Root Directory unset) and applies the root vercel.json's
   rewrites/redirects/cleanUrls the way Vercel does. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MODE = process.argv[2] || 'root';           // 'root' | 'game'
const BASE = MODE === 'game' ? join(ROOT, 'game') : ROOT;
const CFG = JSON.parse(await readFile(join(BASE, 'vercel.json'), 'utf8').catch(() => '{}'));
const PORT = Number(process.argv[3] || 8199);

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.gif':'image/gif',
  '.woff2':'font/woff2', '.jpg':'image/jpeg' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  // Vercel: redirects first (they change the browser URL)
  for (const r of CFG.redirects || []) {
    if (r.source === p) { res.writeHead(r.permanent === false ? 307 : 308, { Location: r.destination }); return res.end(); }
  }
  // then cleanUrls: a request for /x.html is redirected to /x
  if (CFG.cleanUrls && p.endsWith('.html')) {
    const clean = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    if (clean !== p) { res.writeHead(308, { Location: clean }); return res.end(); }
  }
  // then rewrites (URL stays, content comes from elsewhere)
  let served = p;
  for (const r of CFG.rewrites || []) {
    if (r.source === p) { served = r.destination; break; }
  }
  // static resolution
  const tries = [served];
  if (served.endsWith('/')) tries.push(served + 'index.html');
  if (CFG.cleanUrls && !extname(served)) tries.push(served + '.html', served + '/index.html');

  for (const t of tries) {
    const f = join(BASE, t);
    try {
      const s = await stat(f);
      if (!s.isFile()) continue;
      const h = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' };
      for (const g of CFG.headers || []) {
        const re = new RegExp('^' + g.source.replace(/\(\.\*\)/g, '(.*)') + '$');
        if (re.test(p)) for (const kv of g.headers) h[kv.key] = kv.value;
      }
      res.writeHead(200, h);
      return res.end(await readFile(f));
    } catch {}
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 ' + p + (served !== p ? ' (rewritten to ' + served + ')' : ''));
});
server.listen(PORT, () => console.log(`vercel-sim [${MODE}] on http://127.0.0.1:${PORT}  base=${BASE.replace(ROOT,'.')}`));
