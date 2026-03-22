import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '../../');
const CACHE_DIR  = path.join(ROOT, 'data', 'github-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'cache.xml');

const GH_TOKEN    = process.env.GH_TOKEN    || '';
const PANEL_REPO  = process.env.PANEL_REPO  || 'AirlinkLabs/panel';
const DAEMON_REPO = process.env.DAEMON_REPO || 'AirlinkLabs/daemon';
const ADDONS_REPO = 'airlinklabs/addons';

async function ghFetch(url: string): Promise<unknown> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (GH_TOKEN) headers['Authorization'] = `Bearer ${GH_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return res.json();
}

// Escape characters that are invalid inside XML text/attribute values
function esc(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

async function fetchAddons() {
  try {
    const contents = await ghFetch(`https://api.github.com/repos/${ADDONS_REPO}/contents`) as { type: string; name: string }[];
    const folders  = contents.filter(i => i.type === 'dir' && !i.name.startsWith('.'));

    const results = await Promise.all(folders.slice(0, 30).map(async (f) => {
      const base = `https://raw.githubusercontent.com/${ADDONS_REPO}/main/${f.name}`;
      try {
        const infoRes = await fetch(`${base}/info.json`);
        if (!infoRes.ok) return null;
        const info = await infoRes.json() as Record<string, unknown>;
        const installRes = await fetch(`${base}/install.json`);
        const install = installRes.ok ? await installRes.json() as Record<string, unknown> : {};
        return {
          id:              String(info['name']            ? f.name                                           : f.name),
          name:            String(info['name']            || f.name),
          version:         String(info['version']         || ''),
          description:     String(info['description']     || ''),
          longDescription: String(info['longDescription'] || info['description'] || ''),
          author:          String(info['author']          || ''),
          tags:            (info['tags']     as string[]) || [],
          status:          String(info['status']          || 'working'),
          icon:            String(info['icon']            || ''),
          features:        (info['features'] as string[]) || [],
          github:          String(info['github']          || `https://github.com/${ADDONS_REPO}/tree/main/${f.name}`),
          installNote:     String(install['note']         || ''),
          installSteps:    (install['steps'] as { title: string; commands: string[] }[]) || [],
        };
      } catch {
        return null;
      }
    }));

    return results.filter(Boolean) as NonNullable<(typeof results)[number]>[];
  } catch (err) {
    console.warn('  Addons registry fetch failed:', (err as Error).message);
    return [];
  }
}

function buildXml(data: {
  generatedAt:   string;
  stats:         Record<string, number>;
  versions:      Record<string, string>;
  contributors:  { login: string; avatar_url: string; html_url: string; contributions: number; name: string; bio: string; company: string }[];
  panelCommits:  Record<string, unknown>[];
  daemonCommits: Record<string, unknown>[];
  addons:        ReturnType<typeof fetchAddons> extends Promise<infer T> ? T : never;
}): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<cache>');

  lines.push(`  <generatedAt>${esc(data.generatedAt)}</generatedAt>`);

  // Stats
  lines.push('  <stats>');
  for (const [k, v] of Object.entries(data.stats)) {
    lines.push(`    <${k}>${v}</${k}>`);
  }
  lines.push('  </stats>');

  // Versions
  lines.push('  <versions>');
  for (const [k, v] of Object.entries(data.versions)) {
    lines.push(`    <${k}>${esc(v)}</${k}>`);
  }
  lines.push('  </versions>');

  // Contributors
  lines.push('  <contributors>');
  for (const c of data.contributors) {
    lines.push('    <contributor>');
    lines.push(`      <login>${esc(c.login)}</login>`);
    lines.push(`      <name>${esc(c.name)}</name>`);
    lines.push(`      <bio>${esc(c.bio)}</bio>`);
    lines.push(`      <company>${esc(c.company)}</company>`);
    lines.push(`      <avatarUrl>${esc(c.avatar_url)}</avatarUrl>`);
    lines.push(`      <htmlUrl>${esc(c.html_url)}</htmlUrl>`);
    lines.push(`      <contributions>${c.contributions}</contributions>`);
    lines.push('    </contributor>');
  }
  lines.push('  </contributors>');

  // Commits — shared helper for both repos
  function writeCommits(tag: string, commits: Record<string, unknown>[]) {
    lines.push(`  <${tag}>`);
    for (const raw of commits) {
      const commit = raw['commit'] as Record<string, unknown>;
      const author = commit['author'] as Record<string, unknown>;
      const ghAuthor = raw['author'] as Record<string, unknown> | null;
      lines.push('    <commit>');
      lines.push(`      <sha>${esc(raw['sha'])}</sha>`);
      lines.push(`      <htmlUrl>${esc(raw['html_url'])}</htmlUrl>`);
      lines.push(`      <message>${esc(author ? String(commit['message'] || '') : '')}</message>`);
      lines.push('      <author>');
      lines.push(`        <name>${esc(author?.['name'])}</name>`);
      lines.push(`        <date>${esc(author?.['date'])}</date>`);
      lines.push(`        <avatarUrl>${esc(ghAuthor?.['avatar_url'] ?? '')}</avatarUrl>`);
      lines.push('      </author>');
      lines.push('    </commit>');
    }
    lines.push(`  </${tag}>`);
  }

  writeCommits('panelCommits', data.panelCommits);
  writeCommits('daemonCommits', data.daemonCommits);

  // Addons
  lines.push('  <addons>');
  for (const a of data.addons) {
    lines.push('    <addon>');
    lines.push(`      <id>${esc(a.id)}</id>`);
    lines.push(`      <name>${esc(a.name)}</name>`);
    lines.push(`      <version>${esc(a.version)}</version>`);
    lines.push(`      <author>${esc(a.author)}</author>`);
    lines.push(`      <status>${esc(a.status)}</status>`);
    lines.push(`      <description>${esc(a.description)}</description>`);
    lines.push(`      <longDescription>${esc(a.longDescription)}</longDescription>`);
    lines.push(`      <icon>${esc(a.icon)}</icon>`);
    lines.push(`      <github>${esc(a.github)}</github>`);
    lines.push(`      <installNote>${esc(a.installNote)}</installNote>`);
    lines.push('      <tags>');
    for (const t of a.tags) lines.push(`        <tag>${esc(t)}</tag>`);
    lines.push('      </tags>');
    lines.push('      <features>');
    for (const f of a.features) lines.push(`        <feature>${esc(f)}</feature>`);
    lines.push('      </features>');
    lines.push('      <installSteps>');
    for (const step of a.installSteps) {
      lines.push('        <step>');
      lines.push(`          <title>${esc(step.title)}</title>`);
      lines.push('          <commands>');
      for (const cmd of step.commands ?? []) lines.push(`            <command>${esc(cmd)}</command>`);
      lines.push('          </commands>');
      lines.push('        </step>');
    }
    lines.push('      </installSteps>');
    lines.push('    </addon>');
  }
  lines.push('  </addons>');

  lines.push('</cache>');

  return lines.join('\n');
}

async function run() {
  console.log('cache-github: fetching data...');

  if (!GH_TOKEN) {
    console.warn('Warning: GH_TOKEN not set — unauthenticated requests are rate-limited (60/hr).');
    console.warn('Run with: GH_TOKEN=ghp_yourtoken npm run cache');
  }

  await fs.ensureDir(CACHE_DIR);

  const [panelRepo, daemonRepo, panelContribs, daemonContribs, panelCommits, daemonCommits] = await Promise.all([
    ghFetch(`https://api.github.com/repos/${PANEL_REPO}`).catch(() => null),
    ghFetch(`https://api.github.com/repos/${DAEMON_REPO}`).catch(() => null),
    ghFetch(`https://api.github.com/repos/${PANEL_REPO}/contributors?per_page=100`).catch(() => []),
    ghFetch(`https://api.github.com/repos/${DAEMON_REPO}/contributors?per_page=100`).catch(() => []),
    ghFetch(`https://api.github.com/repos/${PANEL_REPO}/commits?per_page=15`).catch(() => []),
    ghFetch(`https://api.github.com/repos/${DAEMON_REPO}/commits?per_page=15`).catch(() => []),
  ]);

  // Merge contributors from both repos, skip bots
  const contribMap = new Map<string, Record<string, unknown>>();
  for (const c of [...(panelContribs as Record<string, unknown>[]), ...(daemonContribs as Record<string, unknown>[])]) {
    const login = c['login'] as string;
    if (!login || login.includes('[bot]')) continue;
    if (contribMap.has(login)) {
      const ex = contribMap.get(login)!;
      ex['contributions'] = (ex['contributions'] as number) + (c['contributions'] as number);
    } else {
      contribMap.set(login, { ...c });
    }
  }

  // Fetch full GitHub profiles for each contributor
  const contributors: { login: string; avatar_url: string; html_url: string; contributions: number; name: string; bio: string; company: string }[] = [];
  for (const login of contribMap.keys()) {
    let profile: Record<string, unknown> = {};
    try {
      profile = await ghFetch(`https://api.github.com/users/${login}`) as Record<string, unknown>;
      process.stdout.write(`  profile: ${login}\n`);
    } catch { /* leave profile empty */ }

    const c = contribMap.get(login)!;
    contributors.push({
      login,
      avatar_url:    String(c['avatar_url']    || ''),
      html_url:      String(c['html_url']      || `https://github.com/${login}`),
      contributions: (c['contributions'] as number) || 0,
      name:          String(profile['name']    || login),
      bio:           String(profile['bio']     || ''),
      company:       String(profile['company'] || ''),
    });
  }
  contributors.sort((a, b) => b.contributions - a.contributions);

  const p = panelRepo  as Record<string, unknown> | null;
  const d = daemonRepo as Record<string, unknown> | null;

  const panelStars   = (p?.['stargazers_count']  as number) || 0;
  const daemonStars  = (d?.['stargazers_count']  as number) || 0;
  const panelForks   = (p?.['forks_count']       as number) || 0;
  const daemonForks  = (d?.['forks_count']       as number) || 0;
  const panelIssues  = (p?.['open_issues_count'] as number) || 0;
  const daemonIssues = (d?.['open_issues_count'] as number) || 0;

  const addons = await fetchAddons();

  const [panelRelease, daemonRelease] = await Promise.all([
    ghFetch(`https://api.github.com/repos/${PANEL_REPO}/releases/latest`).catch(() => null),
    ghFetch(`https://api.github.com/repos/${DAEMON_REPO}/releases/latest`).catch(() => null),
  ]);

  const [panelPkg, daemonPkg] = await Promise.all([
    fetch(`https://raw.githubusercontent.com/${PANEL_REPO}/main/package.json`).then(r => r.ok ? r.json() as Promise<{ version: string }> : null).catch(() => null),
    fetch(`https://raw.githubusercontent.com/${DAEMON_REPO}/main/package.json`).then(r => r.ok ? r.json() as Promise<{ version: string }> : null).catch(() => null),
  ]);

  const xml = buildXml({
    generatedAt: new Date().toISOString(),
    stats: {
      panelStars,
      daemonStars,
      totalStars:   panelStars  + daemonStars,
      panelForks,
      daemonForks,
      totalForks:   panelForks  + daemonForks,
      panelIssues,
      daemonIssues,
      openIssues:   panelIssues + daemonIssues,
      contributors: contributors.length,
    },
    versions: {
      panel:         panelPkg?.version   || '',
      daemon:        daemonPkg?.version  || '',
      panelRelease:  String((panelRelease  as Record<string, unknown>)?.['tag_name']  || ''),
      daemonRelease: String((daemonRelease as Record<string, unknown>)?.['tag_name']  || ''),
    },
    contributors,
    panelCommits:  (panelCommits  as Record<string, unknown>[]) || [],
    daemonCommits: (daemonCommits as Record<string, unknown>[]) || [],
    addons,
  });

  await fs.writeFile(CACHE_FILE, xml, 'utf-8');

  const summary = `stars:${panelStars + daemonStars} forks:${panelForks + daemonForks} issues:${panelIssues + daemonIssues} contributors:${contributors.length} addons:${addons.length}`;
  console.log(`\nWrote cache.xml — ${summary}`);
  await fs.writeFile(path.join(CACHE_DIR, 'summary.txt'), summary, 'utf-8');
}

run().catch(err => {
  console.error('Cache failed:', err);
  process.exit(1);
});
