// Made by https://github.com/bthavanish
import ejs from "ejs";
import fs from "fs-extra";
import path from "path";
import { marked } from "marked";
import fm from "front-matter";
import { fileURLToPath } from "url";

// ── Build-time Iconify icon inlining ─────────────────────────────────────────
const iconMapPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "icon-map.json",
);

interface IconEntry {
  body: string;
  width?: number;
  height?: number;
}

function loadIconMap(): Record<string, IconEntry> {
  if (!fs.existsSync(iconMapPath)) return {};
  const raw = fs.readJSONSync(iconMapPath) as {
    icons: Record<string, { body: string; width?: number; height?: number }>;
    aliases?: Record<string, { parent: string }>;
  };
  const map: Record<string, IconEntry> = {};
  // direct icons
  for (const [name, entry] of Object.entries(raw.icons || {})) {
    map[name] = { body: entry.body, width: entry.width, height: entry.height };
  }
  // aliases → resolve to parent
  if (raw.aliases) {
    for (const [alias, info] of Object.entries(raw.aliases)) {
      if (map[info.parent]) map[alias] = map[info.parent];
    }
  }
  return map;
}

const ICON_MAP = loadIconMap();
// Hardcoded aliases for icons that Iconify maps differently
const ICON_ALIASES: Record<string, string> = {
  home: "house",
  "arrows-right-left": "arrow-left-right",
};
const ICONIFY_RE =
  /<iconify-icon\s+icon="([^"]+)"(?:\s+width="(\d+)")?(?:\s+height="(\d+)")?(?:\s+[^>]*)?\s*><\/iconify-icon>/g;

function inlineIcons(html: string): string {
  return html.replace(
    ICONIFY_RE,
    (_match, iconName: string, w?: string, h?: string) => {
      // Strip prefix (e.g. "lucide:home" → "home") and resolve aliases
      const shortName = iconName.includes(":")
        ? iconName.split(":")[1]
        : iconName;
      const resolved = ICON_ALIASES[shortName] || shortName;
      const entry = ICON_MAP[resolved] || ICON_MAP[shortName];
      if (!entry) {
        console.warn(`  ⚠ icon "${iconName}" not found in icon map`);
        return `<span class="icon-missing" aria-hidden="true">?</span>`;
      }
      const width = w || String(entry.width || 24);
      const height = h || String(entry.height || 24);
      return `<svg width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${entry.body}</svg>`;
    },
  );
}

// Configure marked to add IDs to headings for deep-linking
marked.use({
  renderer: {
    heading({ tokens, depth }: { tokens: any[]; depth: number }) {
      const text = tokens.map((t: any) => t.raw || t.text || "").join("");
      const id = text
        .toLowerCase()
        .replace(/<[^>]+>/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      return `<h${depth} id="${id}">${tokens.map((t: any) => t.raw || t.text || "").join("")}</h${depth}>`;
    },
  },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const DIST = path.join(ROOT, "dist");
const TEMPLATES = path.join(ROOT, "src/templates");
const DATA = path.join(ROOT, "data");
const PUBLIC = path.join(ROOT, "public");

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
  section: string;
  order: number;
  author: string;
  date: string;
  content: string;
  headings: { id: string; text: string; level: number }[];
};

type Announcement = {
  slug: string;
  title: string;
  date: string;
  author: string;
  authorGithub: string;
  pinned: boolean;
  content: string;
  headings: { id: string; text: string; level: number }[];
};

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function loadJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Pull the text content of the first matching element inside a parent node string.
// This is a minimal XML reader — it only handles the flat structure we write ourselves.
function xmlText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? unescapeXml(m[1].trim()) : "";
}

// Return every occurrence of <tag>…</tag> as raw inner strings
function xmlAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseStats(xml: string): Record<string, number> {
  const block = xmlText(xml, "stats")
    ? xml.match(/<stats>([\s\S]*?)<\/stats>/)![1]
    : "";
  const stats: Record<string, number> = {};
  const re = /<(\w+)>(\d+)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) stats[m[1]] = parseInt(m[2], 10);
  return stats;
}

function parseVersions(xml: string): Record<string, string> {
  const block = xml.match(/<versions>([\s\S]*?)<\/versions>/)?.[1] ?? "";
  const versions: Record<string, string> = {};
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null)
    versions[m[1]] = unescapeXml(m[2].trim());
  return versions;
}

function parseContributors(xml: string) {
  return xmlAll(xml, "contributor").map((block) => ({
    login: xmlText(block, "login"),
    name: xmlText(block, "n"),
    bio: xmlText(block, "bio"),
    company: xmlText(block, "company"),
    avatar_url: xmlText(block, "avatarUrl"),
    html_url: xmlText(block, "htmlUrl"),
    contributions: parseInt(xmlText(block, "contributions") || "0", 10),
  }));
}

function parseCommits(xml: string, tag: string) {
  const block =
    xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? "";
  return xmlAll(block, "commit").map((c) => {
    const authorBlock = c.match(/<author>([\s\S]*?)<\/author>/)?.[1] ?? "";
    return {
      sha: xmlText(c, "sha"),
      html_url: xmlText(c, "htmlUrl"),
      // match the shape templates expect: commit.message, commit.author.{name,date}, author.avatar_url
      commit: {
        message: xmlText(c, "message"),
        author: {
          name: xmlText(authorBlock, "n"),
          date: xmlText(authorBlock, "date"),
        },
      },
      author: {
        avatar_url: xmlText(authorBlock, "avatarUrl"),
      },
    };
  });
}

function parseAddons(xml: string) {
  return xmlAll(xml, "addon").map((block) => ({
    id: xmlText(block, "id"),
    name: xmlText(block, "n"),
    version: xmlText(block, "version"),
    author: xmlText(block, "author"),
    status: xmlText(block, "status"),
    description: xmlText(block, "description"),
    longDescription: xmlText(block, "longDescription"),
    icon: xmlText(block, "icon"),
    github: xmlText(block, "github"),
    installNote: xmlText(block, "installNote"),
    tags: xmlAll(block.match(/<tags>([\s\S]*?)<\/tags>/)?.[1] ?? "", "tag"),
    features: xmlAll(
      block.match(/<features>([\s\S]*?)<\/features>/)?.[1] ?? "",
      "feature",
    ),
    installSteps: xmlAll(
      block.match(/<installSteps>([\s\S]*?)<\/installSteps>/)?.[1] ?? "",
      "step",
    ).map((s) => ({
      title: xmlText(s, "title"),
      commands: xmlAll(
        s.match(/<commands>([\s\S]*?)<\/commands>/)?.[1] ?? "",
        "command",
      ),
    })),
  }));
}

async function loadXmlCache(filePath: string): Promise<GithubCache> {
  try {
    const xml = await fs.readFile(filePath, "utf-8");
    return {
      generatedAt: xmlText(xml, "generatedAt"),
      stats: parseStats(xml),
      versions: parseVersions(xml),
      contributors: parseContributors(xml),
      panelCommits: parseCommits(xml, "panelCommits"),
      daemonCommits: parseCommits(xml, "daemonCommits"),
      addons: parseAddons(xml),
    };
  } catch {
    return {};
  }
}

// Small SVG icons used in templates via featureIcon()
// Iconify — lucide icons via web component
const ICONS: Record<string, string> = {
  server:
    '<iconify-icon icon="lucide:server" width="15" height="15"></iconify-icon>',
  terminal:
    '<iconify-icon icon="lucide:terminal" width="15" height="15"></iconify-icon>',
  folder:
    '<iconify-icon icon="lucide:folder" width="15" height="15"></iconify-icon>',
  network:
    '<iconify-icon icon="lucide:network" width="15" height="15"></iconify-icon>',
  users:
    '<iconify-icon icon="lucide:users" width="15" height="15"></iconify-icon>',
  puzzle:
    '<iconify-icon icon="lucide:puzzle" width="15" height="15"></iconify-icon>',
  plug: '<iconify-icon icon="lucide:plug" width="15" height="15"></iconify-icon>',
  transfer:
    '<iconify-icon icon="lucide:arrows-right-left" width="15" height="15"></iconify-icon>',
  database:
    '<iconify-icon icon="lucide:database" width="15" height="15"></iconify-icon>',
  egg: '<iconify-icon icon="lucide:egg" width="15" height="15"></iconify-icon>',
};

function featureIcon(key: string): string {
  return ICONS[key] || ICONS["puzzle"];
}

async function renderMarkdown(html: string): Promise<string> {
  let result = await marked(html);
  result = fixMarkdownImagePaths(result);
  // diagram/mermaid transforms MUST run before copy-button injection so they
  // don't end up wrapped inside a prose-code-block div with a dangling button
  result = transformDiagramBlocks(result);
  result = transformMermaidBlocks(result);
  result = injectProseCodeCopyButtons(result);
  return result;
}

// Standard markdown ![alt](path) images end up with relative paths that break
// when served from a sub-directory. Rewrite any img src that starts with a
// bare filename or relative path to be root-relative via /public/assets/...
// We only touch paths that don't already start with http(s):// or /.
function fixMarkdownImagePaths(html: string): string {
  return html.replace(
    /<img([^>]+)src="([^"]+)"([^>]*)>/gi,
    (match, before, src, after) => {
      if (
        src.startsWith("http") ||
        src.startsWith("/") ||
        src.startsWith("data:") ||
        src.startsWith(".")
      ) {
        return match;
      }
      const fixed = "/" + src.replace(/^\.\//, "");
      return `<img${before}src="${fixed}"${after}>`;
    },
  );
}

async function walkDocs(
  dir: string,
  section = "",
): Promise<{ file: string; section: string }[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: { file: string; section: string }[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "announcements") {
      results.push(...(await walkDocs(path.join(dir, entry.name), entry.name)));
    } else if (entry.name.endsWith(".md") && entry.name !== "README.md") {
      results.push({ file: path.join(dir, entry.name), section });
    }
  }
  return results;
}

function extractHeadings(html: string): {
  id: string;
  text: string;
  level: number;
}[] {
  const headings: { id: string; text: string; level: number }[] = [];
  const regex = /<h([2-4])\s+id="([^"]*)"[^>]*>(.*?)<\/h\1>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, ""),
    });
  }
  return headings;
}

async function loadDocPages(): Promise<DocPage[]> {
  const docsDir = path.join(DATA, "docs");
  const files = await walkDocs(docsDir);

  const pages = await Promise.all(
    files.map(async ({ file, section }) => {
      const raw = await fs.readFile(file, "utf-8");
      const parsed = fm<{
        title?: string;
        description?: string;
        section?: string;
        order?: number;
        author?: string;
        date?: string;
      }>(raw);
      const fileSlug = path.basename(file, ".md");
      const titleSlug = parsed.attributes.title
        ? titleToSlug(parsed.attributes.title)
        : fileSlug;
      const bodyWithImages = resolveContentImages(
        parsed.body,
        `/public/assets/docs/${fileSlug}`,
      );
      let content = await renderMarkdown(bodyWithImages);
      const headings = extractHeadings(content);
      return {
        slug: titleSlug,
        fileSlug,
        title: parsed.attributes.title || fileSlug,
        description: parsed.attributes.description || "",
        section: parsed.attributes.section || section || "General",
        order: parsed.attributes.order ?? 99,
        author: parsed.attributes.author || "",
        date: parsed.attributes.date ? String(parsed.attributes.date) : "",
        content,
        headings,
      };
    }),
  );

  return pages.sort((a, b) => a.order - b.order);
}

// <(filename.ext)> — image embeds
// <(chart title="..." ...)> — inline bar chart
// <(statusgrid title="..." items="Label:100,Label:70")> — status table in a box
// <(progress label="..." value=75)> — single progress bar (kept for back-compat)
// <(flow title="..." steps="A->B:label,B->C:label")> — animated flow diagram
// <(counter value=42 label="things")> — animated counter
// ```diagram ... ``` — ASCII box diagram in code block
// modifiers for images (space-separated):
//   full, noround, alt="...", caption="..."
function resolveContentImages(html: string, assetBasePath: string): string {
  return html.replace(/<\(((?:[^)>]|\([^)]*\))+)\)>/g, (_match, inner) => {
    const raw = inner.trim();
    const parts = raw.split(/\s+/);
    const first = parts[0];
    if (!first) return "";

    // ── chart block ──────────────────────────────────────────────────────────
    // syntax: <(chart title="Migration timeline" bars="Phase 1:100,Phase 2:65,Phase 3:20")>
    if (first === "chart") {
      let title = "";
      let barsRaw = "";
      let caption = "";
      const kvRe = /(\w+)="([^"]*)"/g;
      let m: RegExpExecArray | null;
      while ((m = kvRe.exec(raw)) !== null) {
        if (m[1] === "title") title = m[2];
        if (m[1] === "bars") barsRaw = m[2];
        if (m[1] === "caption") caption = m[2];
      }
      const bars = barsRaw.split(",").map((b) => {
        const idx = b.lastIndexOf(":");
        return {
          label: b.slice(0, idx).trim(),
          value: parseInt(b.slice(idx + 1), 10) || 0,
        };
      });
      const maxVal = Math.max(...bars.map((b) => b.value), 1);
      const barsHtml = bars
        .map((b) => {
          const pct = Math.round((b.value / maxVal) * 100);
          return (
            `<div class="prose-chart-row">` +
            `<span class="prose-chart-label">${b.label}</span>` +
            `<div class="prose-chart-track">` +
            `<div class="prose-chart-bar" style="width:${pct}%"></div>` +
            `</div>` +
            `<span class="prose-chart-val">${b.value}%</span>` +
            `</div>`
          );
        })
        .join("");
      const titleHtml = title
        ? `<p class="prose-chart-title">${title}</p>`
        : "";
      const captionHtml = caption
        ? `<p class="prose-caption" style="text-align:left;">${caption}</p>`
        : "";
      return `<div class="prose-chart">${titleHtml}${barsHtml}${captionHtml}</div>`;
    }

    // ── status grid ───────────────────────────────────────────────────────────
    // syntax: <(statusgrid title="..." items="Label:100,Label:70,Label:30")>
    // value 100 = done, 60-99 = partial, <60 = wip
    if (first === "statusgrid") {
      let title = "";
      let itemsRaw = "";
      const kvRe2 = /(\w+)="([^"]*)"/g;
      let m2: RegExpExecArray | null;
      while ((m2 = kvRe2.exec(raw)) !== null) {
        if (m2[1] === "title") title = m2[2];
        if (m2[1] === "items") itemsRaw = m2[2];
      }
      const items = itemsRaw.split(",").map((s) => {
        const idx = s.lastIndexOf(":");
        const label = s.slice(0, idx).trim();
        const val = parseInt(s.slice(idx + 1), 10) || 0;
        let badgeClass = "wip";
        let badgeText = "in progress";
        if (val === 100) {
          badgeClass = "done";
          badgeText = "done";
        } else if (val >= 60) {
          badgeClass = "partial";
          badgeText = "partial";
        }
        return { label, badgeClass, badgeText };
      });
      const titleHtml = title
        ? `<div class="prose-status-grid-title">${title}</div>`
        : "";
      const rowsHtml = items
        .map(
          (it) =>
            `<div class="prose-status-row">` +
            `<span class="prose-status-label">${it.label}</span>` +
            `<span class="prose-status-badge ${it.badgeClass}">${it.badgeText}</span>` +
            `</div>`,
        )
        .join("");
      return `<div class="prose-status-grid">${titleHtml}${rowsHtml}</div>`;
    }

    // ── progress bar (kept for back-compat) ──────────────────────────────────
    if (first === "progress") {
      let label = "";
      let value = 0;
      const kvRe2 = /(\w+)="([^"]*)"/g;
      let m2: RegExpExecArray | null;
      while ((m2 = kvRe2.exec(raw)) !== null) {
        if (m2[1] === "label") label = m2[2];
      }
      const numMatch = raw.match(/value=(\d+)/);
      if (numMatch) value = parseInt(numMatch[1], 10);
      return (
        `<div class="prose-progress">` +
        `<div class="prose-progress-header">` +
        `<span class="prose-progress-label">${label}</span>` +
        `<span class="prose-progress-val">${value}%</span>` +
        `</div>` +
        `<div class="prose-progress-track">` +
        `<div class="prose-progress-fill" style="width:${value}%"></div>` +
        `</div>` +
        `</div>`
      );
    }
    // ── flow diagram (vertical flowchart) ──────────────────────────────────
    // syntax: <(flow title="Title" steps="A->B:label,C->D">)
    // Two formats:
    //   A->B:label  = transition from A to B with arrow label
    //   Entity:Action = single step (entity performs action)
    if (first === "flow") {
      let title = "";
      let stepsRaw = "";
      const kvRe3 = /(\w+)="([^"]*)"/g;
      let m3: RegExpExecArray | null;
      while ((m3 = kvRe3.exec(raw)) !== null) {
        if (m3[1] === "title") title = m3[2];
        if (m3[1] === "steps") stepsRaw = m3[2];
      }

      // Parse steps - each is either a transition (A->B:label) or action (Entity:Action)
      const steps = stepsRaw.split(",").map((s) => {
        const arrowIdx = s.indexOf("->");
        if (arrowIdx !== -1) {
          // Transition format: A->B:label
          const colonIdx = s.lastIndexOf(":");
          const from = s.slice(0, arrowIdx).trim();
          const to = s
            .slice(arrowIdx + 2, colonIdx === -1 ? undefined : colonIdx)
            .trim();
          const label = colonIdx === -1 ? "" : s.slice(colonIdx + 1).trim();
          return { type: "transition" as const, from, to, label, text: "" };
        } else {
          // Action format: Entity:Action or just Text
          return {
            type: "action" as const,
            from: "",
            to: "",
            label: "",
            text: s.trim(),
          };
        }
      });

      const titleHtml = title ? `<p class="prose-flow-title">${title}</p>` : "";

      // Build vertical flow items - always add arrows between nodes
      const items: string[] = [];
      steps.forEach((step, i) => {
        if (step.type === "transition") {
          // Transition: from -> arrow -> to
          items.push(
            `<div class="prose-flow-item"><div class="prose-flow-node prose-flow-node--entity">${step.from}</div></div>`,
          );
          items.push(
            `<div class="prose-flow-item"><div class="prose-flow-arrow-wrap">` +
              `<div class="prose-flow-arrow-line"></div>` +
              (step.label
                ? `<div class="prose-flow-arrow-label">${step.label}</div>`
                : "") +
              `<div class="prose-flow-arrow-head"></div>` +
              `</div></div>`,
          );
          items.push(
            `<div class="prose-flow-item"><div class="prose-flow-node prose-flow-node--entity">${step.to}</div></div>`,
          );
        } else {
          // Action: single node with arrow after (except last)
          items.push(
            `<div class="prose-flow-item"><div class="prose-flow-node">${step.text}</div></div>`,
          );
          if (i < steps.length - 1) {
            items.push(
              `<div class="prose-flow-item"><div class="prose-flow-arrow-wrap">` +
                `<div class="prose-flow-arrow-line"></div>` +
                `<div class="prose-flow-arrow-head"></div>` +
                `</div></div>`,
            );
          }
        }
      });

      const flowHtml = `<div class="prose-flow-vertical">${items.join("")}</div>`;
      return `<div class="prose-flow" data-flow-steps="${steps.length}">${titleHtml}${flowHtml}</div>`;
    }
    // ── animated counter ──────────────────────────────────────────────────────
    // syntax: <(counter value=42 label="API endpoints")>
    if (first === "counter") {
      let label = "";
      let value = 0;
      const kvRe4 = /(\w+)="([^"]*)"/g;
      let m4: RegExpExecArray | null;
      while ((m4 = kvRe4.exec(raw)) !== null) {
        if (m4[1] === "label") label = m4[2];
      }
      const numMatch = raw.match(/value=(\d+)/);
      if (numMatch) value = parseInt(numMatch[1], 10);
      const suffixMatch = raw.match(/suffix="([^"]*)"/);
      const suffix = suffixMatch ? suffixMatch[1] : "";
      return (
        `<div class="prose-counter" data-counter-to="${value}" data-counter-suffix="${suffix}">` +
        `<span class="prose-counter-val">0${suffix}</span>` +
        `<span class="prose-counter-label">${label}</span>` +
        `</div>`
      );
    }

    // ── image ─────────────────────────────────────────────────────────────────
    const modifiers = parts.slice(1);
    const isFull = modifiers.includes("full");
    const noRound = modifiers.includes("noround");

    let alt = "";
    let caption = "";
    for (const mod of modifiers) {
      const altMatch = mod.match(/^alt="([^"]*)"$/);
      const captionMatch = mod.match(/^caption="([^"]*)"$/);
      if (altMatch) alt = altMatch[1];
      if (captionMatch) caption = captionMatch[1];
    }

    // Use assetBasePath as-is. If it starts with '/', it's root-absolute (works on
    // GitHub Pages only when served from the domain root). If it's relative, keep it.
    // Callers that need relative paths (e.g. blog posts at /blog/slug/) should pass
    // a path like '../../public/assets/blog/slug' instead of '/public/assets/blog/slug'.
    const src = `${assetBasePath}/${first}`;
    const roundStyle = noRound ? "" : "border-radius:8px;";
    const widthStyle = isFull
      ? "width:100%;max-width:100%;"
      : "max-width:100%;";
    const imgHtml = `<img src="${src}" alt="${alt}" loading="lazy" class="prose-img img-loaded" style="${widthStyle}${roundStyle}display:block;">`;

    if (caption) {
      return `<figure class="prose-figure">${imgHtml}<figcaption class="prose-caption">${caption}</figcaption></figure>`;
    }
    return `<figure class="prose-figure">${imgHtml}</figure>`;
  });
}

// wrap prose <pre><code>...</code></pre> blocks with a copy button div
// matching the full pre+code pattern avoids touching bare <pre> tags in
// diagram or mermaid blocks (which have no inner <code> element)
function injectProseCodeCopyButtons(html: string): string {
  return html.replace(
    /<pre>(<code[\s\S]*?<\/code>)<\/pre>/g,
    (_, codeInner) => {
      const btn =
        `<button class="prose-copy-btn" aria-label="Copy code" type="button">` +
        `<iconify-icon icon="lucide:copy" width="11" height="11"></iconify-icon> Copy</button>`;
      return `<div class="prose-code-block">${btn}<pre>${codeInner}</pre></div>`;
    },
  );
}

// transform ```diagram code blocks into styled ASCII diagram containers
function transformDiagramBlocks(html: string): string {
  return html.replace(
    /<pre><code class="language-diagram">([\s\S]*?)<\/code><\/pre>/g,
    (_match, code) => {
      const decoded = code
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');
      return `<div class="prose-diagram"><pre>${decoded}</pre></div>`;
    },
  );
}

// transform ```mermaid code blocks into mermaid-renderable divs
// mermaid.js (loaded via CDN) picks up <pre class="mermaid"> and renders SVG client-side
// this runs BEFORE copy-button injection so the pre doesn't get a code wrapper
function transformMermaidBlocks(html: string): string {
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_match, code) => {
      // marked HTML-encodes graph source — decode before handing off to mermaid
      const decoded = code
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');
      return `<div class="prose-mermaid"><pre class="mermaid">${decoded}</pre></div>`;
    },
  );
}

async function loadAnnouncements(): Promise<Announcement[]> {
  const dir = path.join(DATA, "docs", "announcements");
  const exists = await fs.pathExists(dir);
  if (!exists) return [];

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));

  const posts = await Promise.all(
    files.map(async (file) => {
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      const parsed = fm<{
        title?: string;
        date?: string;
        author?: string;
        authorGithub?: string;
        pinned?: boolean;
      }>(raw);
      const slug = path.basename(file, ".md");

      // resolve images before passing to marked so the custom tags don't get escaped
      // Blog posts live at dist/blog/{slug}/index.html, so two levels up from root.
      // Using a relative path here means the image resolves correctly regardless of
      // whether the site is deployed at the domain root or a subpath like /home/.
      const bodyWithImages = resolveContentImages(
        parsed.body,
        `../../public/assets/blog/${slug}`,
      );
      let content = await renderMarkdown(bodyWithImages);
      const headings = extractHeadings(content);

      return {
        slug,
        title: parsed.attributes.title || slug,
        date: parsed.attributes.date ? String(parsed.attributes.date) : "",
        author: parsed.attributes.author || "",
        authorGithub: parsed.attributes.authorGithub || "",
        pinned: parsed.attributes.pinned === true,
        content,
        headings,
      };
    }),
  );

  return posts.sort((a, b) => Number(a.slug) - Number(b.slug));
}

async function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> {
  return ejs.renderFile(templatePath, data, { views: [TEMPLATES] });
}

async function build() {
  const banner = [
    "                                              ",
    "  /$$$$$$ /$$         /$$/$$         /$$      ",
    " /$$__  $|__/        | $|__/        | $$      ",
    "| $$  \\ $$/$$ /$$$$$$| $$/$$/$$$$$$$| $$   /$$",
    "| $$$$$$$| $$/$$__  $| $| $| $$__  $| $$  /$$/",
    "| $$__  $| $| $$  \\__| $| $| $$  \\ $| $$$$$$/ ",
    "| $$  | $| $| $$     | $| $| $$  | $| $$_  $$ ",
    "| $$  | $| $| $$     | $| $| $$  | $| $$ \\  $$",
    "|__/  |__|__|__/     |__|__|__/  |__|__/  \\__/",
    "                                              ",
  ];
  banner.forEach((line) => process.stdout.write(line + "\n"));
  console.log("Building...");

  await fs.emptyDir(DIST);

  // copy public assets into dist/public so paths like public/js/main.js work from root
  await fs.copy(PUBLIC, path.join(DIST, "public"));

  // also copy installer.sh to the dist root — GitHub Pages serves dist/ as the site root,
  // so this makes the script available at airlinklabs.github.io/home/installer.sh
  const installerSrc = path.join(PUBLIC, "installer.sh");
  if (await fs.pathExists(installerSrc)) {
    await fs.copy(installerSrc, path.join(DIST, "installer.sh"));
    console.log("  installer.sh -> dist root");
  }

  const pkg = await loadJson<PackageJson>(path.join(ROOT, "package.json"), {
    site: {},
    underConstruction: { enabled: false, message: "", badge: "" },
  });

  const siteData = await loadJson<Record<string, unknown>>(
    path.join(DATA, "site.json"),
    {},
  );
  const githubCache = await loadXmlCache(
    path.join(DATA, "github-cache", "cache.xml"),
  );
  const docPages = await loadDocPages();
  const announcements = await loadAnnouncements();

  // addons: prefer live-fetched registry data from cache, fall back to site.json
  const cacheAddons = (githubCache["addons"] as unknown[]) || [];
  const siteAddons = (siteData["addons"] as unknown[]) || [];
  const addons = cacheAddons.length > 0 ? cacheAddons : siteAddons;

  const base = {
    site: pkg.site,
    underConstruction: pkg.underConstruction,
    features: siteData["features"] || [],
    install: siteData["install"] || {},
    team: siteData["team"] || {},
    addons,
    githubCache,
    docPages,
    announcements,
    featureIcon,
  };

  // index.html
  const indexHtml = inlineIcons(
    await renderTemplate(path.join(TEMPLATES, "index.ejs"), {
      ...base,
      rootPrefix: "",
    }),
  );
  await fs.outputFile(path.join(DIST, "index.html"), indexHtml);
  console.log("  index.html");

  // docs/index.html
  const docsIndexHtml = inlineIcons(
    await renderTemplate(path.join(TEMPLATES, "docs", "index.ejs"), {
      ...base,
      rootPrefix: "../",
      firstDoc: docPages[0] || null,
    }),
  );
  await fs.outputFile(path.join(DIST, "docs", "index.html"), docsIndexHtml);
  console.log("  docs/index.html");

  // each doc page — output at slug/ (title-derived kebab-case)
  for (const doc of docPages) {
    const docHtml = inlineIcons(
      await renderTemplate(path.join(TEMPLATES, "docs", "doc.ejs"), {
        ...base,
        rootPrefix: "../../",
        currentDoc: doc,
      }),
    );
    await fs.outputFile(
      path.join(DIST, "docs", doc.slug, "index.html"),
      docHtml,
    );
    console.log(`  docs/${doc.slug}/index.html`);
  }

  // blog/index.html — announcements list, newest first
  const blogIndexHtml = inlineIcons(
    await renderTemplate(path.join(TEMPLATES, "blog", "index.ejs"), {
      ...base,
      rootPrefix: "../../",
      announcements: [...announcements].reverse(),
    }),
  );
  await fs.outputFile(path.join(DIST, "blog", "index.html"), blogIndexHtml);
  console.log("  blog/index.html");

  // each announcement page
  for (const post of announcements) {
    const postHtml = inlineIcons(
      await renderTemplate(path.join(TEMPLATES, "blog", "post.ejs"), {
        ...base,
        rootPrefix: "../../../",
        post,
      }),
    );
    await fs.outputFile(
      path.join(DIST, "blog", post.slug, "index.html"),
      postHtml,
    );
    console.log(`  blog/${post.slug}/index.html`);
  }

  // 404.html — GitHub Pages serves this for any unmatched path
  const notFoundHtml = inlineIcons(
    await renderTemplate(path.join(TEMPLATES, "404.ejs"), {
      ...base,
      rootPrefix: "",
    }),
  );
  await fs.outputFile(path.join(DIST, "404.html"), notFoundHtml);
  console.log("  404.html");

  // write screenshot placeholder text files into the source tree (not dist)
  // so the developer knows what screenshots to drop in
  await writePlaceholders();

  console.log("\nDone → dist/");
}

async function writePlaceholders() {
  const entries = [
    {
      p: "public/assets/screenshots/dashboard.txt",
      d: "Admin dashboard — online nodes, total nodes, total instances, avg density. Update notice if new version is available.",
    },
    {
      p: "public/assets/screenshots/console.txt",
      d: "Live console — WebSocket terminal output. CPU/RAM/disk bar at top. Start/stop/restart buttons.",
    },
    {
      p: "public/assets/screenshots/file-manager.txt",
      d: "File manager — directory listing with sizes and dates. Upload/new-file/new-folder buttons.",
    },
    {
      p: "public/assets/screenshots/server-list.txt",
      d: "Server list — table of all servers with owner, node, status badge, RAM/CPU limits.",
    },
    {
      p: "public/assets/screenshots/nodes.txt",
      d: "Nodes admin — list of connected nodes, green/red status dot, instance count per node.",
    },
    {
      p: "public/assets/features/server-management/PLACEHOLDER.txt",
      d: "Server management admin view — all servers across all nodes.",
    },
    {
      p: "public/assets/features/console/PLACEHOLDER.txt",
      d: "Live console — terminal output with resource usage bar.",
    },
    {
      p: "public/assets/features/file-manager/PLACEHOLDER.txt",
      d: "File manager — directory listing with edit/upload controls.",
    },
    {
      p: "public/assets/features/nodes/PLACEHOLDER.txt",
      d: "Nodes page — node list with status and instance counts.",
    },
    {
      p: "public/assets/features/users/PLACEHOLDER.txt",
      d: "Users admin — user list with email, username, admin toggle.",
    },
    {
      p: "public/assets/features/addons/PLACEHOLDER.txt",
      d: "Addons page — installed addons with enable/disable toggles and marketplace tab.",
    },
    {
      p: "public/assets/features/api/PLACEHOLDER.txt",
      d: "API keys page — list of keys with name, permissions, creation date.",
    },
    {
      p: "public/assets/features/migrations/PLACEHOLDER.txt",
      d: "Any page powered by a migrated addon table.",
    },
    {
      p: "public/assets/addons/modrinth-store/PLACEHOLDER.txt",
      d: "Modrinth Store addon — mod search results inside the panel.",
    },
    {
      p: "public/assets/addons/parachute/PLACEHOLDER.txt",
      d: "Parachute addon — Google Drive backup list for a server.",
    },
  ];

  for (const e of entries) {
    const full = path.join(ROOT, e.p);
    if (!(await fs.pathExists(full))) {
      await fs.ensureDir(path.dirname(full));
      await fs.writeFile(full, e.d + "\n");
    }
  }
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});

// ~ https://github.com/thavanish edited this shitty code
