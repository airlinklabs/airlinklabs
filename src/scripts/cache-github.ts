// Made by https://github.com/bthavanish
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const CACHE_DIR = path.join(ROOT, "data", "github-cache");
const CACHE_FILE = path.join(CACHE_DIR, "cache.xml");
const DB_FILE = path.join(ROOT, "public", "assets", "github.db");

const GH_TOKEN =
  process.env.GITHUB_TOKEN || process.env.TOKEN || process.env.GH_TOKEN || "";
const ORG_NAME = "AirlinkLabs";
const PANEL_REPO = process.env.PANEL_REPO || "AirlinkLabs/panel";
const DAEMON_REPO = process.env.DAEMON_REPO || "AirlinkLabs/daemon";
const ADDONS_REPO = "airlinklabs/addons";

async function ghFetch(url: string): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GH_TOKEN) headers["Authorization"] = `Bearer ${GH_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return res.json();
}

// Escape characters that are invalid inside XML text/attribute values
function esc(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchAddons() {
  try {
    const contents = (await ghFetch(
      `https://api.github.com/repos/${ADDONS_REPO}/contents`,
    )) as { type: string; name: string }[];
    const folders = contents.filter(
      (i) => i.type === "dir" && !i.name.startsWith("."),
    );

    const results = await Promise.all(
      folders.slice(0, 30).map(async (f) => {
        const base = `https://raw.githubusercontent.com/${ADDONS_REPO}/main/${f.name}`;
        try {
          const infoRes = await fetch(`${base}/info.json`);
          if (!infoRes.ok) return null;
          const info = (await infoRes.json()) as Record<string, unknown>;
          const installRes = await fetch(`${base}/install.json`);
          const install = installRes.ok
            ? ((await installRes.json()) as Record<string, unknown>)
            : {};
          return {
            id: String(info["name"] ? f.name : f.name),
            name: String(info["name"] || f.name),
            version: String(info["version"] || ""),
            description: String(info["description"] || ""),
            longDescription: String(
              info["longDescription"] || info["description"] || "",
            ),
            author: String(info["author"] || ""),
            tags: (info["tags"] as string[]) || [],
            status: String(info["status"] || "working"),
            icon: String(info["icon"] || ""),
            features: (info["features"] as string[]) || [],
            github: String(
              info["github"] ||
                `https://github.com/${ADDONS_REPO}/tree/main/${f.name}`,
            ),
            installNote: String(install["note"] || ""),
            installSteps:
              (install["steps"] as { title: string; commands: string[] }[]) ||
              [],
          };
        } catch {
          return null;
        }
      }),
    );

    return results.filter(Boolean) as NonNullable<(typeof results)[number]>[];
  } catch (err) {
    console.warn("  Addons registry fetch failed:", (err as Error).message);
    return [];
  }
}

function buildXml(data: {
  generatedAt: string;
  stats: Record<string, number>;
  versions: Record<string, string>;
  contributors: {
    login: string;
    avatar_url: string;
    html_url: string;
    contributions: number;
    name: string;
    bio: string;
    company: string;
  }[];
  allCommits: Record<string, unknown>[];
  addons: ReturnType<typeof fetchAddons> extends Promise<infer T> ? T : never;
}): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<cache>");

  lines.push(`  <generatedAt>${esc(data.generatedAt)}</generatedAt>`);

  // Stats
  lines.push("  <stats>");
  for (const [k, v] of Object.entries(data.stats)) {
    lines.push(`    <${k}>${v}</${k}>`);
  }
  lines.push("  </stats>");

  // Versions
  lines.push("  <versions>");
  for (const [k, v] of Object.entries(data.versions)) {
    lines.push(`    <${k}>${esc(v)}</${k}>`);
  }
  lines.push("  </versions>");

  // Contributors
  lines.push("  <contributors>");
  for (const c of data.contributors) {
    lines.push("    <contributor>");
    lines.push(`      <login>${esc(c.login)}</login>`);
    lines.push(`      <name>${esc(c.name)}</name>`);
    lines.push(`      <bio>${esc(c.bio)}</bio>`);
    lines.push(`      <company>${esc(c.company)}</company>`);
    lines.push(`      <avatarUrl>${esc(c.avatar_url)}</avatarUrl>`);
    lines.push(`      <htmlUrl>${esc(c.html_url)}</htmlUrl>`);
    lines.push(`      <contributions>${c.contributions}</contributions>`);
    lines.push("    </contributor>");
  }
  lines.push("  </contributors>");

  // Commits — write all commits
  lines.push("  <commits>");
  for (const raw of data.allCommits) {
    const commit = raw["commit"] as Record<string, unknown>;
    const author = commit["author"] as Record<string, unknown>;
    const ghAuthor = raw["author"] as Record<string, unknown> | null;
    const repo = (raw["_repo"] as string) || "";
    lines.push("    <commit>");
    lines.push(`      <sha>${esc(raw["sha"])}</sha>`);
    lines.push(`      <repo>${esc(repo)}</repo>`);
    lines.push(`      <htmlUrl>${esc(raw["html_url"])}</htmlUrl>`);
    lines.push(
      `      <message>${esc(author ? String(commit["message"] || "") : "")}</message>`,
    );
    lines.push("      <author>");
    lines.push(`        <name>${esc(author?.["name"])}</name>`);
    lines.push(`        <date>${esc(author?.["date"])}</date>`);
    lines.push(
      `        <avatarUrl>${esc(ghAuthor?.["avatar_url"] ?? "")}</avatarUrl>`,
    );
    lines.push("      </author>");
    lines.push("    </commit>");
  }
  lines.push("  </commits>");

  // Addons
  lines.push("  <addons>");
  for (const a of data.addons) {
    lines.push("    <addon>");
    lines.push(`      <id>${esc(a.id)}</id>`);
    lines.push(`      <name>${esc(a.name)}</name>`);
    lines.push(`      <version>${esc(a.version)}</version>`);
    lines.push(`      <author>${esc(a.author)}</author>`);
    lines.push(`      <status>${esc(a.status)}</status>`);
    lines.push(`      <description>${esc(a.description)}</description>`);
    lines.push(
      `      <longDescription>${esc(a.longDescription)}</longDescription>`,
    );
    lines.push(`      <icon>${esc(a.icon)}</icon>`);
    lines.push(`      <github>${esc(a.github)}</github>`);
    lines.push(`      <installNote>${esc(a.installNote)}</installNote>`);
    lines.push("      <tags>");
    for (const t of a.tags) lines.push(`        <tag>${esc(t)}</tag>`);
    lines.push("      </tags>");
    lines.push("      <features>");
    for (const f of a.features)
      lines.push(`        <feature>${esc(f)}</feature>`);
    lines.push("      </features>");
    lines.push("      <installSteps>");
    for (const step of a.installSteps) {
      lines.push("        <step>");
      lines.push(`          <title>${esc(step.title)}</title>`);
      lines.push("          <commands>");
      for (const cmd of step.commands ?? [])
        lines.push(`            <command>${esc(cmd)}</command>`);
      lines.push("          </commands>");
      lines.push("        </step>");
    }
    lines.push("      </installSteps>");
    lines.push("    </addon>");
  }
  lines.push("  </addons>");

  lines.push("</cache>");

  return lines.join("\n");
}

async function run() {
  console.log("cache-github: fetching data...");

  if (!GH_TOKEN) {
    console.warn(
      "Warning: GH_TOKEN not set — unauthenticated requests are rate-limited (60/hr).",
    );
    console.warn("Run with: GH_TOKEN=ghp_yourtoken npm run cache");
  }

  await fs.ensureDir(CACHE_DIR);

  // Fetch all repos in the org
  let orgRepos: { full_name: string }[] = [];
  try {
    orgRepos = (await ghFetch(
      `https://api.github.com/orgs/${ORG_NAME}/repos?per_page=100`,
    )) as { full_name: string }[];
    console.log(`  Found ${orgRepos.length} repos in ${ORG_NAME}`);
  } catch {
    // Fallback to known repos
    orgRepos = [{ full_name: PANEL_REPO }, { full_name: DAEMON_REPO }];
  }

  // Also fetch panel/daemon repo info for stats
  const [panelRepo, daemonRepo] = await Promise.all([
    ghFetch(`https://api.github.com/repos/${PANEL_REPO}`).catch(() => null),
    ghFetch(`https://api.github.com/repos/${DAEMON_REPO}`).catch(() => null),
  ]);

  // Fetch commits and contributors from all repos
  const allCommits: Record<string, unknown>[] = [];
  const contribMap = new Map<string, Record<string, unknown>>();

  for (const repo of orgRepos.slice(0, 10)) {
    const repoName = repo.full_name;
    console.log(`  Fetching commits from ${repoName}...`);

    const [commits, contribs] = await Promise.all([
      ghFetch(
        `https://api.github.com/repos/${repoName}/commits?per_page=10`,
      ).catch(() => []),
      ghFetch(
        `https://api.github.com/repos/${repoName}/contributors?per_page=100`,
      ).catch(() => []),
    ]);

    // Tag commits with repo name
    for (const c of commits as Record<string, unknown>[]) {
      c["_repo"] = repoName.replace(`${ORG_NAME}/`, "");
      allCommits.push(c);
    }

    // Merge contributors
    for (const c of contribs as Record<string, unknown>[]) {
      const login = c["login"] as string;
      if (!login || login.includes("[bot]")) continue;
      if (contribMap.has(login)) {
        const ex = contribMap.get(login)!;
        ex["contributions"] =
          (ex["contributions"] as number) + (c["contributions"] as number);
      } else {
        contribMap.set(login, { ...c });
      }
    }
  }

  // Sort commits by date descending
  allCommits.sort((a, b) => {
    const aDate = (a["commit"] as Record<string, unknown>)?.["author"] as
      Record<string, unknown> | undefined;
    const bDate = (b["commit"] as Record<string, unknown>)?.["author"] as
      Record<string, unknown> | undefined;
    return ((bDate?.["date"] as string) || "").localeCompare(
      (aDate?.["date"] as string) || "",
    );
  });

  // Fetch full GitHub profiles for each contributor
  const contributors: {
    login: string;
    avatar_url: string;
    html_url: string;
    contributions: number;
    name: string;
    bio: string;
    company: string;
  }[] = [];
  for (const login of contribMap.keys()) {
    let profile: Record<string, unknown> = {};
    try {
      profile = (await ghFetch(
        `https://api.github.com/users/${login}`,
      )) as Record<string, unknown>;
      process.stdout.write(`  profile: ${login}\n`);
    } catch {
      /* leave profile empty */
    }

    const c = contribMap.get(login)!;
    contributors.push({
      login,
      avatar_url: String(c["avatar_url"] || ""),
      html_url: String(c["html_url"] || `https://github.com/${login}`),
      contributions: (c["contributions"] as number) || 0,
      name: String(profile["name"] || login),
      bio: String(profile["bio"] || ""),
      company: String(profile["company"] || ""),
    });
  }
  contributors.sort((a, b) => b.contributions - a.contributions);

  const p = panelRepo as Record<string, unknown> | null;
  const d = daemonRepo as Record<string, unknown> | null;

  const panelStars = (p?.["stargazers_count"] as number) || 0;
  const daemonStars = (d?.["stargazers_count"] as number) || 0;
  const panelForks = (p?.["forks_count"] as number) || 0;
  const daemonForks = (d?.["forks_count"] as number) || 0;
  const panelIssues = (p?.["open_issues_count"] as number) || 0;
  const daemonIssues = (d?.["open_issues_count"] as number) || 0;

  const addons = await fetchAddons();

  const [panelRelease, daemonRelease] = await Promise.all([
    ghFetch(`https://api.github.com/repos/${PANEL_REPO}/releases/latest`).catch(
      () => null,
    ),
    ghFetch(
      `https://api.github.com/repos/${DAEMON_REPO}/releases/latest`,
    ).catch(() => null),
  ]);

  const [panelPkg, daemonPkg] = await Promise.all([
    fetch(`https://raw.githubusercontent.com/${PANEL_REPO}/main/package.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ version: string }>) : null))
      .catch(() => null),
    fetch(`https://raw.githubusercontent.com/${DAEMON_REPO}/main/package.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ version: string }>) : null))
      .catch(() => null),
  ]);

  const xml = buildXml({
    generatedAt: new Date().toISOString(),
    stats: {
      panelStars,
      daemonStars,
      totalStars: panelStars + daemonStars,
      panelForks,
      daemonForks,
      totalForks: panelForks + daemonForks,
      panelIssues,
      daemonIssues,
      openIssues: panelIssues + daemonIssues,
      contributors: contributors.length,
    },
    versions: {
      panel: panelPkg?.version || "",
      daemon: daemonPkg?.version || "",
      panelRelease: String(
        (panelRelease as Record<string, unknown>)?.["tag_name"] || "",
      ),
      daemonRelease: String(
        (daemonRelease as Record<string, unknown>)?.["tag_name"] || "",
      ),
    },
    contributors,
    allCommits,
    addons,
  });

  await fs.writeFile(CACHE_FILE, xml, "utf-8");

  // ── Write SQLite db ──────────────────────────────────────────────────────
  await fs.ensureDir(path.dirname(DB_FILE));
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.exec(`
    DROP TABLE IF EXISTS commits;
    DROP TABLE IF EXISTS contributors;
    DROP TABLE IF EXISTS meta;
    CREATE TABLE commits (
      sha TEXT PRIMARY KEY,
      repo TEXT NOT NULL,
      message TEXT,
      author_name TEXT,
      author_date TEXT,
      author_avatar TEXT,
      html_url TEXT
    );
    CREATE TABLE contributors (
      login TEXT PRIMARY KEY,
      name TEXT,
      avatar_url TEXT,
      html_url TEXT,
      contributions INTEGER DEFAULT 0,
      bio TEXT,
      company TEXT
    );
    CREATE TABLE meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const insertCommit = db.prepare(
    "INSERT OR REPLACE INTO commits (sha, repo, message, author_name, author_date, author_avatar, html_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertContrib = db.prepare(
    "INSERT OR REPLACE INTO contributors (login, name, avatar_url, html_url, contributions, bio, company) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertMeta = db.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
  );

  // Write all commits with their repo tag
  for (const raw of allCommits) {
    const commit = raw["commit"] as Record<string, unknown>;
    const author = commit["author"] as Record<string, unknown>;
    const ghAuthor = raw["author"] as Record<string, unknown> | null;
    const repo = (raw["_repo"] as string) || "unknown";
    insertCommit.run(
      String(raw["sha"] || ""),
      repo,
      String(commit?.["message"] || ""),
      String(author?.["name"] || ""),
      String(author?.["date"] || ""),
      String(ghAuthor?.["avatar_url"] || ""),
      String(raw["html_url"] || ""),
    );
  }

  for (const c of contributors) {
    insertContrib.run(
      c.login,
      c.name,
      c.avatar_url,
      c.html_url,
      c.contributions,
      c.bio,
      c.company,
    );
  }

  insertMeta.run("generatedAt", new Date().toISOString());
  insertMeta.run("totalStars", String(panelStars + daemonStars));
  insertMeta.run("totalForks", String(panelForks + daemonForks));
  insertMeta.run("totalContributors", String(contributors.length));

  db.close();

  // ── Write JSON file for client-side consumption ────────────────────────────
  const jsonData = {
    commits: allCommits.map((raw) => {
      const commit = raw["commit"] as Record<string, unknown>;
      const author = commit?.["author"] as Record<string, unknown> | undefined;
      const ghAuthor = raw["author"] as Record<string, unknown> | null;
      return {
        sha: String(raw["sha"] || ""),
        repo: String(raw["_repo"] || ""),
        message: String(author?.["message"] || commit?.["message"] || ""),
        author_name: String(author?.["name"] || ""),
        author_date: String(author?.["date"] || ""),
        author_avatar: String(ghAuthor?.["avatar_url"] || ""),
        html_url: String(raw["html_url"] || ""),
      };
    }),
    contributors: contributors.map((c) => ({
      login: c.login,
      avatar_url: c.avatar_url,
      html_url: c.html_url,
      contributions: c.contributions,
    })),
    generatedAt: new Date().toISOString(),
  };
  const jsonFile = path.join(ROOT, "public", "assets", "github-data.json");
  await fs.ensureDir(path.dirname(jsonFile));
  await fs.writeFile(jsonFile, JSON.stringify(jsonData), "utf-8");
  console.log(
    `  github-data.json (${(JSON.stringify(jsonData).length / 1024).toFixed(1)} KB)`,
  );

  const summary = `stars:${panelStars + daemonStars} forks:${panelForks + daemonForks} issues:${panelIssues + daemonIssues} contributors:${contributors.length} addons:${addons.length}`;
  console.log(`\nWrote cache.xml + github.db + github-data.json — ${summary}`);
  await fs.writeFile(path.join(CACHE_DIR, "summary.txt"), summary, "utf-8");

  // Save bthavanish avatar for inline build
  const avatarDir = path.join(ROOT, "public", "assets");
  await fs.ensureDir(avatarDir);
  const bthavanishContrib = contributors.find((c) => c.login === "bthavanish");
  const avatarUrl =
    bthavanishContrib?.avatar_url ||
    "https://avatars.githubusercontent.com/u/bthavanish";
  try {
    const headers: Record<string, string> = {};
    if (GH_TOKEN) headers["Authorization"] = `Bearer ${GH_TOKEN}`;
    const res = await fetch(avatarUrl, { headers });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(path.join(avatarDir, "avatar-bthavanish.png"), buf);
      console.log(
        `  saved avatar-bthavanish.png (${(buf.length / 1024).toFixed(1)} KB)`,
      );
    }
  } catch (err) {
    console.warn("  warn: could not save bthavanish avatar");
  }
}

run().catch((err) => {
  console.error("Cache failed:", err);
  process.exit(1);
});
