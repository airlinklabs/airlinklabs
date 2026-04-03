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
  site: Record<string, string | boolean>;
  underConstruction: { enabled: boolean; message: string; badge: string };
};

type GithubCache = Record<string, unknown>;

type DocPage = {
  slug: string;
  fileSlug: string;
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

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}


async function loadJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Pull the text content of the first matching element inside a parent node string.
// This is a minimal XML reader — it only handles the flat structure we write ourselves.
function xmlText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? unescapeXml(m[1].trim()) : '';
}

// Return every occurrence of <tag>…</tag> as raw inner strings
function xmlAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseStats(xml: string): Record<string, number> {
  const block = xmlText(xml, 'stats') ? xml.match(/<stats>([\s\S]*?)<\/stats>/)![1] : '';
  const stats: Record<string, number> = {};
  const re = /<(\w+)>(\d+)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) stats[m[1]] = parseInt(m[2], 10);
  return stats;
}

function parseVersions(xml: string): Record<string, string> {
  const block = xml.match(/<versions>([\s\S]*?)<\/versions>/)?.[1] ?? '';
  const versions: Record<string, string> = {};
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) versions[m[1]] = unescapeXml(m[2].trim());
  return versions;
}

function parseContributors(xml: string) {
  return xmlAll(xml, 'contributor').map(block => ({
    login:         xmlText(block, 'login'),
    name:          xmlText(block, 'n'),
    bio:           xmlText(block, 'bio'),
    company:       xmlText(block, 'company'),
    avatar_url:    xmlText(block, 'avatarUrl'),
    html_url:      xmlText(block, 'htmlUrl'),
    contributions: parseInt(xmlText(block, 'contributions') || '0', 10),
  }));
}

function parseCommits(xml: string, tag: string) {
  const block = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? '';
  return xmlAll(block, 'commit').map(c => {
    const authorBlock = c.match(/<author>([\s\S]*?)<\/author>/)?.[1] ?? '';
    return {
      sha:      xmlText(c, 'sha'),
      html_url: xmlText(c, 'htmlUrl'),
      // match the shape templates expect: commit.message, commit.author.{name,date}, author.avatar_url
      commit: {
        message: xmlText(c, 'message'),
        author: {
          name: xmlText(authorBlock, 'n'),
          date: xmlText(authorBlock, 'date'),
        },
      },
      author: {
        avatar_url: xmlText(authorBlock, 'avatarUrl'),
      },
    };
  });
}

function parseAddons(xml: string) {
  return xmlAll(xml, 'addon').map(block => ({
    id:              xmlText(block, 'id'),
    name:            xmlText(block, 'n'),
    version:         xmlText(block, 'version'),
    author:          xmlText(block, 'author'),
    status:          xmlText(block, 'status'),
    description:     xmlText(block, 'description'),
    longDescription: xmlText(block, 'longDescription'),
    icon:            xmlText(block, 'icon'),
    github:          xmlText(block, 'github'),
    installNote:     xmlText(block, 'installNote'),
    tags:            xmlAll(block.match(/<tags>([\s\S]*?)<\/tags>/)?.[1] ?? '', 'tag'),
    features:        xmlAll(block.match(/<features>([\s\S]*?)<\/features>/)?.[1] ?? '', 'feature'),
    installSteps: xmlAll(
      block.match(/<installSteps>([\s\S]*?)<\/installSteps>/)?.[1] ?? '', 'step'
    ).map(s => ({
      title:    xmlText(s, 'title'),
      commands: xmlAll(s.match(/<commands>([\s\S]*?)<\/commands>/)?.[1] ?? '', 'command'),
    })),
  }));
}

async function loadXmlCache(filePath: string): Promise<GithubCache> {
  try {
    const xml = await fs.readFile(filePath, 'utf-8');
    return {
      generatedAt:  xmlText(xml, 'generatedAt'),
      stats:        parseStats(xml),
      versions:     parseVersions(xml),
      contributors: parseContributors(xml),
      panelCommits: parseCommits(xml, 'panelCommits'),
      daemonCommits:parseCommits(xml, 'daemonCommits'),
      addons:       parseAddons(xml),
    };
  } catch {
    return {};
  }
}

// Small SVG icons used in templates via featureIcon()
// lucide-static v1.7.0 — real paths, not hand-rolled garbage
const ICONS: Record<string, string> = {
  server:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
  terminal: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19h8"/><path d="m4 17 6-6-6-6"/></svg>',
  folder:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  network:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>',
  users:    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>',
  puzzle:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/></svg>',
  plug:     '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M15 8V2"/><path d="M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"/><path d="M9 8V2"/></svg>',
  transfer: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>',
  database: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>',
  egg:      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12"/></svg>',
};

function featureIcon(key: string): string {
  return ICONS[key] || ICONS['puzzle'];
}

async function renderMarkdown(html: string): Promise<string> {
  let result = await marked(html);
  result = fixMarkdownImagePaths(result);
  result = injectProseCodeCopyButtons(result);
  return result;
}

// Standard markdown ![alt](path) images end up with relative paths that break
// when served from a sub-directory. Rewrite any img src that starts with a
// bare filename or relative path to be root-relative via /public/assets/...
// We only touch paths that don't already start with http(s):// or /.
function fixMarkdownImagePaths(html: string): string {
  return html.replace(/<img([^>]+)src="([^"]+)"([^>]*)>/gi, (match, before, src, after) => {
    if (src.startsWith('http') || src.startsWith('/') || src.startsWith('data:') || src.startsWith('.')) {
      return match;
    }
    const fixed = '/' + src.replace(/^\.\//, '');
    return `<img${before}src="${fixed}"${after}>`;
  });
}


async function loadDocPages(): Promise<DocPage[]> {
  const docsDir = path.join(DATA, 'docs');
  const files   = (await fs.readdir(docsDir)).filter(f => f.endsWith('.md'));

  const pages = await Promise.all(files.map(async (file) => {
    const raw    = await fs.readFile(path.join(docsDir, file), 'utf-8');
    const parsed = fm<{ title?: string; description?: string; order?: number; author?: string; date?: string }>(raw);
    const fileSlug           = path.basename(file, '.md');
    const titleSlug          = parsed.attributes.title ? titleToSlug(parsed.attributes.title) : fileSlug;
    const bodyWithImages     = resolveContentImages(parsed.body, `/public/assets/docs/${fileSlug}`);
    let content              = await renderMarkdown(bodyWithImages);
    return {
      slug:        titleSlug,
      fileSlug,
      title:       parsed.attributes.title       || fileSlug,
      description: parsed.attributes.description || '',
      order:       parsed.attributes.order        ?? 99,
      author:      parsed.attributes.author       || '',
      date:        parsed.attributes.date         ? String(parsed.attributes.date) : '',
      content,
    };
  }));

  return pages.sort((a, b) => a.order - b.order);
}

// <(filename.ext)> — image embeds
// <(chart title="..." ...)> — inline bar chart
// <(statusgrid title="..." items="Label:100,Label:70")> — status table in a box
// <(progress label="..." value=75)> — single progress bar (kept for back-compat)
// modifiers for images (space-separated):
//   full, noround, alt="...", caption="..."
function resolveContentImages(html: string, assetBasePath: string): string {
  return html.replace(/<\(((?:[^)>]|\([^)]*\))+)\)>/g, (_match, inner) => {
    const raw   = inner.trim();
    const parts = raw.split(/\s+/);
    const first = parts[0];
    if (!first) return '';

    // ── chart block ──────────────────────────────────────────────────────────
    // syntax: <(chart title="Migration timeline" bars="Phase 1:100,Phase 2:65,Phase 3:20")>
    if (first === 'chart') {
      let title  = '';
      let barsRaw = '';
      let caption = '';
      const kvRe = /(\w+)="([^"]*)"/g;
      let m: RegExpExecArray | null;
      while ((m = kvRe.exec(raw)) !== null) {
        if (m[1] === 'title')   title   = m[2];
        if (m[1] === 'bars')    barsRaw = m[2];
        if (m[1] === 'caption') caption = m[2];
      }
      const bars = barsRaw.split(',').map(b => {
        const idx = b.lastIndexOf(':');
        return { label: b.slice(0, idx).trim(), value: parseInt(b.slice(idx + 1), 10) || 0 };
      });
      const maxVal = Math.max(...bars.map(b => b.value), 1);
      const barsHtml = bars.map(b => {
        const pct = Math.round((b.value / maxVal) * 100);
        return `<div class="prose-chart-row">`
          + `<span class="prose-chart-label">${b.label}</span>`
          + `<div class="prose-chart-track">`
          + `<div class="prose-chart-bar" style="width:${pct}%"></div>`
          + `</div>`
          + `<span class="prose-chart-val">${b.value}%</span>`
          + `</div>`;
      }).join('');
      const titleHtml  = title   ? `<p class="prose-chart-title">${title}</p>` : '';
      const captionHtml = caption ? `<p class="prose-caption" style="text-align:left;">${caption}</p>` : '';
      return `<div class="prose-chart">${titleHtml}${barsHtml}${captionHtml}</div>`;
    }

    // ── status grid ───────────────────────────────────────────────────────────
    // syntax: <(statusgrid title="..." items="Label:100,Label:70,Label:30")>
    // value 100 = done, 60-99 = partial, <60 = wip
    if (first === 'statusgrid') {
      let title    = '';
      let itemsRaw = '';
      const kvRe2  = /(\w+)="([^"]*)"/g;
      let m2: RegExpExecArray | null;
      while ((m2 = kvRe2.exec(raw)) !== null) {
        if (m2[1] === 'title') title    = m2[2];
        if (m2[1] === 'items') itemsRaw = m2[2];
      }
      const items = itemsRaw.split(',').map(s => {
        const idx   = s.lastIndexOf(':');
        const label = s.slice(0, idx).trim();
        const val   = parseInt(s.slice(idx + 1), 10) || 0;
        let badgeClass = 'wip';
        let badgeText  = 'in progress';
        if (val === 100) { badgeClass = 'done';    badgeText = 'done'; }
        else if (val >= 60) { badgeClass = 'partial'; badgeText = 'partial'; }
        return { label, badgeClass, badgeText };
      });
      const titleHtml = title ? `<div class="prose-status-grid-title">${title}</div>` : '';
      const rowsHtml  = items.map(it =>
        `<div class="prose-status-row">`
        + `<span class="prose-status-label">${it.label}</span>`
        + `<span class="prose-status-badge ${it.badgeClass}">${it.badgeText}</span>`
        + `</div>`
      ).join('');
      return `<div class="prose-status-grid">${titleHtml}${rowsHtml}</div>`;
    }

    // ── progress bar (kept for back-compat) ──────────────────────────────────
    if (first === 'progress') {
      let label = '';
      let value = 0;
      const kvRe2 = /(\w+)="([^"]*)"/g;
      let m2: RegExpExecArray | null;
      while ((m2 = kvRe2.exec(raw)) !== null) {
        if (m2[1] === 'label') label = m2[2];
      }
      const numMatch = raw.match(/value=(\d+)/);
      if (numMatch) value = parseInt(numMatch[1], 10);
      return `<div class="prose-progress">`
        + `<div class="prose-progress-header">`
        + `<span class="prose-progress-label">${label}</span>`
        + `<span class="prose-progress-val">${value}%</span>`
        + `</div>`
        + `<div class="prose-progress-track">`
        + `<div class="prose-progress-fill" style="width:${value}%"></div>`
        + `</div>`
        + `</div>`;
    }

    // ── image ─────────────────────────────────────────────────────────────────
    const modifiers = parts.slice(1);
    const isFull    = modifiers.includes('full');
    const noRound   = modifiers.includes('noround');

    let alt     = '';
    let caption = '';
    for (const mod of modifiers) {
      const altMatch     = mod.match(/^alt="([^"]*)"$/);
      const captionMatch = mod.match(/^caption="([^"]*)"$/);
      if (altMatch)     alt     = altMatch[1];
      if (captionMatch) caption = captionMatch[1];
    }

    // Use assetBasePath as-is. If it starts with '/', it's root-absolute (works on
    // GitHub Pages only when served from the domain root). If it's relative, keep it.
    // Callers that need relative paths (e.g. blog posts at /blog/slug/) should pass
    // a path like '../../public/assets/blog/slug' instead of '/public/assets/blog/slug'.
    const src        = `${assetBasePath}/${first}`;
    const roundStyle = noRound ? '' : 'border-radius:8px;';
    const widthStyle = isFull  ? 'width:100%;max-width:100%;' : 'max-width:100%;';
    const imgHtml    = `<img src="${src}" alt="${alt}" loading="lazy" class="prose-img img-loaded" style="${widthStyle}${roundStyle}display:block;">`;

    if (caption) {
      return `<figure class="prose-figure">${imgHtml}<figcaption class="prose-caption">${caption}</figcaption></figure>`;
    }
    return `<figure class="prose-figure">${imgHtml}</figure>`;
  });
}

// wrap every <pre> in prose with a relative div + inject a copy button
// main.js already handles .prose-copy-btn clicks via the same clipboard pattern
function injectProseCodeCopyButtons(html: string): string {
  return html.replace(/<pre>/g, () => {
    const btn = `<button class="prose-copy-btn" aria-label="Copy code" type="button">`
      + `<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">`
      + `<rect x="9" y="9" width="13" height="13" rx="2"/>`
      + `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`
      + `</svg> Copy</button>`;
    return `<div class="prose-code-block">${btn}<pre>`;
  }).replace(/<\/pre>/g, '</pre></div>');
}

async function loadAnnouncements(): Promise<Announcement[]> {
  const dir   = path.join(DATA, 'docs', 'announcements');
  const exists = await fs.pathExists(dir);
  if (!exists) return [];

  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.md'));

  const posts = await Promise.all(files.map(async (file) => {
    const raw    = await fs.readFile(path.join(dir, file), 'utf-8');
    const parsed = fm<{ title?: string; date?: string; author?: string; authorGithub?: string; pinned?: boolean }>(raw);
    const slug   = path.basename(file, '.md');

    // resolve images before passing to marked so the custom tags don't get escaped
    // Blog posts live at dist/blog/{slug}/index.html, so two levels up from root.
    // Using a relative path here means the image resolves correctly regardless of
    // whether the site is deployed at the domain root or a subpath like /home/.
    const bodyWithImages = resolveContentImages(parsed.body, `../../public/assets/blog/${slug}`);
    let content = await renderMarkdown(bodyWithImages);

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
  const githubCache = await loadXmlCache(path.join(DATA, 'github-cache', 'cache.xml'));
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

  // each doc page — output at slug/ (title-derived kebab-case)
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

  // 404.html — GitHub Pages serves this for any unmatched path
  const notFoundHtml = await renderTemplate(path.join(TEMPLATES, '404.ejs'), base);
  await fs.outputFile(path.join(DIST, '404.html'), notFoundHtml);
  console.log('  404.html');

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
