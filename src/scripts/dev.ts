import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const DIST = path.join(ROOT, 'dist');

function build() {
  const banner = [
    '                                              ',
    '  /$$$$$$ /$$         /$$/$$         /$$      ',
    ' /$$__  $|__/        | $|__/        | $$      ',
    '| $$  \\ $$/$$ /$$$$$$| $$/$$/$$$$$$$| $$   /$$',
    '| $$$$$$$| $$/$$__  $| $| $| $$__  $| $$  /$$/',
    '| $$__  $| $| $$  \\__| $| $| $$  \\ $| $$$$$$/ ',
    '| $$  | $| $| $$     | $| $| $$  | $| $$_  $$ ',
    '| $$  | $| $| $$     | $| $| $$  | $| $$ \\  $$',
    '|__/  |__|__|__/     |__|__|__/  |__|__/  \\__/',
    '                                              ',
  ];
  banner.forEach(line => process.stdout.write(line + '\n'));
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    console.error('Build error — fix it and save again');
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.txt':  'text/plain',
};

function serve(port = 3000) {
  http.createServer((req, res) => {
    let urlPath = (req.url || '/').split('?')[0];
    if (urlPath.endsWith('/')) urlPath += 'index.html';

    const filePath = path.join(DIST, urlPath);
    const ext      = path.extname(filePath);

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        res.end(content);
        return;
      } catch {
        // fall through to 404
      }
    }

    const fallback = path.join(DIST, 'index.html');
    if (fs.existsSync(fallback)) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(fallback));
    } else {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Building — refresh in a moment.');
    }
  }).listen(port, () => console.log(`Dev: http://localhost:${port}`));
}

build();
serve();

const watchDirs = [
  path.join(ROOT, 'src/templates'),
  path.join(ROOT, 'src/input.css'),
  path.join(ROOT, 'data'),
  path.join(ROOT, 'public'),
];

let debounce: ReturnType<typeof setTimeout> | null = null;

for (const dir of watchDirs) {
  if (!fs.existsSync(dir)) continue;
  fs.watch(dir, { recursive: true }, () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log('Rebuilding...');
      build();
    }, 300);
  });
}

console.log('Watching src/templates, data/, public/...');
