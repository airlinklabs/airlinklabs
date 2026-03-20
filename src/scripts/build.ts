import ejs from 'ejs';
import fs from 'fs-extra';
import path from 'path';
import { marked } from 'marked';
import fm from 'front-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '../../');
const DIST      = path.join(ROOT, 'dist');
const TEMPLATES = path.join(ROOT, 'src/templates');
const DATA      = path.join(ROOT, 'data');
const PUBLIC    = path.join(ROOT, 'public');

type PackageJson = {
  site: Record<string, string>;
  underConstruction: { enabled: boolean; message: string; badge: string };
};

type GithubCache = Record<string, unknown>;

type DocPage = {
  slug: string;
  title: string;
  description: string;
  order: number;
  author: string;
  date: string;
  content: string;
};

type Announcement = {
  slug: string;
  title: string;
  date: string;
  author: string;
  authorGithub: string;
  pinned: boolean;
  content: string;
};

async function loadJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Small SVG icons used in templates via featureIcon()
const ICONS: Record<string, string> = {
  server:   '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
  terminal: '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  folder:   '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  network:  '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><circle cx="5" cy="19" r="3"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="14.5" y1="15.5" x2="17.5" y2="17.5"/><line x1="9.5" y1="15.5" x2="6.5" y2="17.5"/></svg>',
  users:    '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  puzzle:   '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  plug:     '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M18 6L6 18M8 6v6a2 2 0 0 0 2 2h6"/><path d="M16 18v-6a2 2 0 0 0-2-2H8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>',
  transfer: '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  database: '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
  egg:      '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="7" ry="9"/></svg>',
};

function featureIcon(key: string): string {
  return ICONS[key] || ICONS['puzzle'];
}

async function loadDocPages(): Promise<DocPage[]> {
  const docsDir = path.join(DATA, 'docs');
  const files   = (await fs.readdir(docsDir)).filter(f => f.endsWith('.md'));

  const pages = await Promise.all(files.map(async (file) => {
    const raw    = await fs.readFile(path.join(docsDir, file), 'utf-8');
    const parsed = fm<{ title?: string; description?: string; order?: number; author?: string; date?: string }>(raw);
    const content = await marked(parsed.body);
    const slug    = path.basename(file, '.md');
    return {
      slug,
      title:       parsed.attributes.title       || slug,
      description: parsed.attributes.description || '',
      order:       parsed.attributes.order        ?? 99,
      author:      parsed.attributes.author       || '',
      date:        parsed.attributes.date         ? String(parsed.attributes.date) : '',
      content,
    };
  }));

  return pages.sort((a, b) => a.order - b.order);
}

async function loadAnnouncements(): Promise<Announcement[]> {
  const dir   = path.join(DATA, 'docs', 'announcements');
  const exists = await fs.pathExists(dir);
  if (!exists) return [];

  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.md'));

  const posts = await Promise.all(files.map(async (file) => {
    const raw    = await fs.readFile(path.join(dir, file), 'utf-8');
    const parsed = fm<{ title?: string; date?: string; author?: string; authorGithub?: string; pinned?: boolean }>(raw);
    const content = await marked(parsed.body);
    const slug    = path.basename(file, '.md');
    return {
      slug,
      title:        parsed.attributes.title        || slug,
      date:         parsed.attributes.date         ? String(parsed.attributes.date) : '',
      author:       parsed.attributes.author       || '',
      authorGithub: parsed.attributes.authorGithub || '',
      pinned:       parsed.attributes.pinned        === true,
      content,
    };
  }));

  return posts.sort((a, b) => Number(a.slug) - Number(b.slug));
}

async function renderTemplate(templatePath: string, data: Record<string, unknown>): Promise<string> {
  return ejs.renderFile(templatePath, data, { views: [TEMPLATES] });
}

async function build() {
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
  console.log('Building...');

  await fs.emptyDir(DIST);

  // copy public assets into dist/public so paths like public/js/main.js work from root
  await fs.copy(PUBLIC, path.join(DIST, 'public'));

  // also copy installer.sh to the dist root — GitHub Pages serves dist/ as the site root,
  // so this makes the script available at airlinklabs.github.io/home/installer.sh
  const installerSrc = path.join(PUBLIC, 'installer.sh');
  if (await fs.pathExists(installerSrc)) {
    await fs.copy(installerSrc, path.join(DIST, 'installer.sh'));
    console.log('  installer.sh -> dist root');
  }

  const pkg = await loadJson<PackageJson>(path.join(ROOT, 'package.json'), {
    site: {},
    underConstruction: { enabled: false, message: '', badge: '' },
  });

  const siteData    = await loadJson<Record<string, unknown>>(path.join(DATA, 'site.json'), {});
  const githubCache = await loadJson<GithubCache>(path.join(DATA, 'github-cache', 'cache.json'), {});
  const docPages        = await loadDocPages();
  const announcements   = await loadAnnouncements();

  // addons: prefer live-fetched registry data from cache, fall back to site.json
  const cacheAddons = (githubCache['addons'] as unknown[]) || [];
  const siteAddons  = (siteData['addons']   as unknown[]) || [];
  const addons = cacheAddons.length > 0 ? cacheAddons : siteAddons;

  const base = {
    site:              pkg.site,
    underConstruction: pkg.underConstruction,
    features:          siteData['features']  || [],
    install:           siteData['install']   || {},
    team:              siteData['team']      || {},
    addons,
    githubCache,
    docPages,
    announcements,
    featureIcon,
  };

  // index.html
  const indexHtml = await renderTemplate(path.join(TEMPLATES, 'index.ejs'), base);
  await fs.outputFile(path.join(DIST, 'index.html'), indexHtml);
  console.log('  index.html');

  // registry/index.html
  const registryHtml = await renderTemplate(path.join(TEMPLATES, 'registry.ejs'), base);
  await fs.outputFile(path.join(DIST, 'registry', 'index.html'), registryHtml);
  console.log('  registry/index.html');

  // docs/index.html
  const docsIndexHtml = await renderTemplate(
    path.join(TEMPLATES, 'docs', 'index.ejs'),
    { ...base, firstDoc: docPages[0] || null }
  );
  await fs.outputFile(path.join(DIST, 'docs', 'index.html'), docsIndexHtml);
  console.log('  docs/index.html');

  // each doc page
  for (const doc of docPages) {
    const docHtml = await renderTemplate(
      path.join(TEMPLATES, 'docs', 'doc.ejs'),
      { ...base, currentDoc: doc }
    );
    await fs.outputFile(path.join(DIST, 'docs', doc.slug, 'index.html'), docHtml);
    console.log(`  docs/${doc.slug}/index.html`);
  }

  // blog/index.html — announcements list, newest first
  const blogIndexHtml = await renderTemplate(
    path.join(TEMPLATES, 'blog', 'index.ejs'),
    { ...base, announcements: [...announcements].reverse() }
  );
  await fs.outputFile(path.join(DIST, 'blog', 'index.html'), blogIndexHtml);
  console.log('  blog/index.html');

  // each announcement page
  for (const post of announcements) {
    const postHtml = await renderTemplate(
      path.join(TEMPLATES, 'blog', 'post.ejs'),
      { ...base, post }
    );
    await fs.outputFile(path.join(DIST, 'blog', post.slug, 'index.html'), postHtml);
    console.log(`  blog/${post.slug}/index.html`);
  }

  // write screenshot placeholder text files into the source tree (not dist)
  // so the developer knows what screenshots to drop in
  await writePlaceholders();

  console.log('\nDone → dist/');
}

async function writePlaceholders() {
  const entries = [
    { p: 'public/assets/screenshots/dashboard.txt',    d: 'Admin dashboard — online nodes, total nodes, total instances, avg density. Update notice if new version is available.' },
    { p: 'public/assets/screenshots/console.txt',      d: 'Live console — WebSocket terminal output. CPU/RAM/disk bar at top. Start/stop/restart buttons.' },
    { p: 'public/assets/screenshots/file-manager.txt', d: 'File manager — directory listing with sizes and dates. Upload/new-file/new-folder buttons.' },
    { p: 'public/assets/screenshots/server-list.txt',  d: 'Server list — table of all servers with owner, node, status badge, RAM/CPU limits.' },
    { p: 'public/assets/screenshots/nodes.txt',        d: 'Nodes admin — list of connected nodes, green/red status dot, instance count per node.' },
    { p: 'public/assets/features/server-management/PLACEHOLDER.txt', d: 'Server management admin view — all servers across all nodes.' },
    { p: 'public/assets/features/console/PLACEHOLDER.txt',           d: 'Live console — terminal output with resource usage bar.' },
    { p: 'public/assets/features/file-manager/PLACEHOLDER.txt',      d: 'File manager — directory listing with edit/upload controls.' },
    { p: 'public/assets/features/nodes/PLACEHOLDER.txt',             d: 'Nodes page — node list with status and instance counts.' },
    { p: 'public/assets/features/users/PLACEHOLDER.txt',             d: 'Users admin — user list with email, username, admin toggle.' },
    { p: 'public/assets/features/addons/PLACEHOLDER.txt',            d: 'Addons page — installed addons with enable/disable toggles and marketplace tab.' },
    { p: 'public/assets/features/api/PLACEHOLDER.txt',               d: 'API keys page — list of keys with name, permissions, creation date.' },
    { p: 'public/assets/features/migrations/PLACEHOLDER.txt',        d: 'Any page powered by a migrated addon table.' },
    { p: 'public/assets/addons/modrinth-store/PLACEHOLDER.txt',      d: 'Modrinth Store addon — mod search results inside the panel.' },
    { p: 'public/assets/addons/parachute/PLACEHOLDER.txt',           d: 'Parachute addon — Google Drive backup list for a server.' },
  ];

  for (const e of entries) {
    const full = path.join(ROOT, e.p);
    if (!await fs.pathExists(full)) {
      await fs.ensureDir(path.dirname(full));
      await fs.writeFile(full, e.d + '\n');
    }
  }
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
