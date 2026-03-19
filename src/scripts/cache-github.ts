import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '../../');
const CACHE_FILE = path.join(ROOT, 'data', 'github-cache', 'cache.json');

const GH_TOKEN   = process.env.GH_TOKEN   || '';
const PANEL_REPO = process.env.PANEL_REPO || 'AirlinkLabs/panel';
const DAEMON_REPO= process.env.DAEMON_REPO|| 'AirlinkLabs/daemon';
const ADDONS_REPO= 'airlinklabs/addons';

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
          id:              f.name,
          name:            info['name']            || f.name,
          version:         info['version']         || '',
          description:     info['description']     || '',
          longDescription: info['longDescription'] || info['description'] || '',
          author:          info['author']          || '',
          tags:            info['tags']            || [],
          status:          info['status']          || 'working',
          icon:            info['icon']            || '',
          features:        info['features']        || [],
          github:          info['github']          || `https://github.com/${ADDONS_REPO}/tree/main/${f.name}`,
          installNote:     install['note']         || '',
          installSteps:    install['steps']        || [],
        };
      } catch {
        return null;
      }
    }));

    return results.filter(Boolean);
  } catch (err) {
    console.warn('  Addons registry fetch failed:', (err as Error).message);
    return [];
  }
}

async function run() {
  console.log('cache-github: fetching data...');

  if (!GH_TOKEN) {
    console.warn('Warning: GH_TOKEN not set — unauthenticated requests are rate-limited (60/hr).');
    console.warn('Run with: GH_TOKEN=ghp_yourtoken npm run cache');
  }
  await fs.ensureDir(path.dirname(CACHE_FILE));

  const [panelRepo, daemonRepo, panelContribs, daemonContribs, panelCommits, daemonCommits] = await Promise.all([
    ghFetch(`https://api.github.com/repos/${PANEL_REPO}`).catch(() => null),
    ghFetch(`https://api.github.com/repos/${DAEMON_REPO}`).catch(() => null),
    ghFetch(`https://api.github.com/repos/${PANEL_REPO}/contributors?per_page=100`).catch(() => []),
    ghFetch(`https://api.github.com/repos/${DAEMON_REPO}/contributors?per_page=100`).catch(() => []),
    ghFetch(`https://api.github.com/repos/${PANEL_REPO}/commits?per_page=15`).catch(() => []),
    ghFetch(`https://api.github.com/repos/${DAEMON_REPO}/commits?per_page=15`).catch(() => []),
  ]);

  // merge contributors from both repos
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

  // fetch user profiles
  const logins = Array.from(contribMap.keys());
  const contributors = [];
  for (const login of logins) {
    let profile: Record<string, unknown> = {};
    try {
      profile = await ghFetch(`https://api.github.com/users/${login}`) as Record<string, unknown>;
      process.stdout.write(`  profile: ${login}\n`);
    } catch { /* keep empty */ }

    const c = contribMap.get(login)!;
    contributors.push({
      login,
      avatar_url:    c['avatar_url']  || '',
      html_url:      c['html_url']    || `https://github.com/${login}`,
      contributions: c['contributions'] || 0,
      name:          profile['name']  || login,
      bio:           profile['bio']   || '',
      company:       profile['company'] || '',
    });
  }
  contributors.sort((a, b) => (b.contributions as number) - (a.contributions as number));

  const panelStars  = ((panelRepo  as Record<string,unknown>)?.['stargazers_count'] as number) || 0;
  const daemonStars = ((daemonRepo as Record<string,unknown>)?.['stargazers_count'] as number) || 0;
  const addons = await fetchAddons();

  const [panelPkg, daemonPkg] = await Promise.all([
    fetch(`https://raw.githubusercontent.com/${PANEL_REPO}/main/package.json`).then(r => r.ok ? r.json() as Promise<{ version: string }> : null).catch(() => null),
    fetch(`https://raw.githubusercontent.com/${DAEMON_REPO}/main/package.json`).then(r => r.ok ? r.json() as Promise<{ version: string }> : null).catch(() => null),
  ]);

  const cache = {
    generatedAt: new Date().toISOString(),
    stats: {
      panelStars,
      daemonStars,
      totalStars: panelStars + daemonStars,
      contributors: contributors.length,
    },
    versions: {
      panel:  panelPkg?.version  || '',
      daemon: daemonPkg?.version || '',
    },
    contributors,
    panelCommits:  panelCommits  || [],
    daemonCommits: daemonCommits || [],
    addons,
  };

  await fs.writeJson(CACHE_FILE, cache, { spaces: 2 });
  console.log(`\nWrote cache.json — stars: ${cache.stats.totalStars}, contributors: ${cache.stats.contributors}, addons: ${addons.length}`);
}

run().catch(err => {
  console.error('Cache failed:', err);
  process.exit(1);
});
