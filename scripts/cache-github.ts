// Made by https://github.com/bthavanish
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../");

const GH_TOKEN =
  process.env.GITHUB_TOKEN || process.env.TOKEN || process.env.GH_TOKEN || "";
const ORG_NAME = "AirlinkLabs";
const PANEL_REPO = process.env.PANEL_REPO || "AirlinkLabs/panel";
const DAEMON_REPO = process.env.DAEMON_REPO || "AirlinkLabs/daemon";

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

async function run() {
  console.log("cache-github: fetching data...");

  if (!GH_TOKEN) {
    console.warn(
      "Warning: GH_TOKEN not set — unauthenticated requests are rate-limited (60/hr).",
    );
    console.warn("Run with: GH_TOKEN=ghp_yourtoken npm run cache");
  }

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

    // Tag commits with repo name + fetch stats for each
    for (const c of commits as Record<string, unknown>[]) {
      c["_repo"] = repoName.replace(`${ORG_NAME}/`, "");
      // Fetch commit stats (additions/deletions/files)
      try {
        const sha = c["sha"] as string;
        const detail = (await ghFetch(
          `https://api.github.com/repos/${repoName}/commits/${sha}`,
        )) as Record<string, unknown>;
        const stats = detail?.["stats"] as Record<string, unknown> | undefined;
        if (stats) {
          c["_additions"] = stats["additions"] || 0;
          c["_deletions"] = stats["deletions"] || 0;
          c["_files"] = stats["total"] || 0;
        }
      } catch {
        /* skip stats on failure */
      }
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
    public_repos: number;
    followers: number;
    twitter_username: string;
    blog: string;
    location: string;
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
      public_repos: (profile["public_repos"] as number) || 0,
      followers: (profile["followers"] as number) || 0,
      twitter_username: String(profile["twitter_username"] || ""),
      blog: String(profile["blog"] || ""),
      location: String(profile["location"] || ""),
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
        additions: Number(raw["_additions"] || 0),
        deletions: Number(raw["_deletions"] || 0),
        files_changed: Number(raw["_files"] || 0),
      };
    }),
    contributors: contributors.map((c) => ({
      login: c.login,
      name: c.name,
      avatar_url: c.avatar_url,
      html_url: c.html_url,
      contributions: c.contributions,
      bio: c.bio,
      company: c.company,
      public_repos: c.public_repos,
      followers: c.followers,
      twitter_username: c.twitter_username,
      blog: c.blog,
      location: c.location,
    })),
    repos: [
      panelRepo
        ? {
            name: PANEL_REPO,
            description: String(
              (panelRepo as Record<string, unknown>)?.["description"] || "",
            ),
            stars: panelStars,
            forks: panelForks,
            open_issues: panelIssues,
            language: String(
              (panelRepo as Record<string, unknown>)?.["language"] || "",
            ),
            topics:
              ((panelRepo as Record<string, unknown>)?.[
                "topics"
              ] as string[]) || [],
            default_branch: String(
              (panelRepo as Record<string, unknown>)?.["default_branch"] ||
                "main",
            ),
            created_at: String(
              (panelRepo as Record<string, unknown>)?.["created_at"] || "",
            ),
            updated_at: String(
              (panelRepo as Record<string, unknown>)?.["updated_at"] || "",
            ),
            license: String(
              (
                (panelRepo as Record<string, unknown>)?.["license"] as Record<
                  string,
                  unknown
                >
              )?.["spdx_id"] || "",
            ),
          }
        : null,
      daemonRepo
        ? {
            name: DAEMON_REPO,
            description: String(
              (daemonRepo as Record<string, unknown>)?.["description"] || "",
            ),
            stars: daemonStars,
            forks: daemonForks,
            open_issues: daemonIssues,
            language: String(
              (daemonRepo as Record<string, unknown>)?.["language"] || "",
            ),
            topics:
              ((daemonRepo as Record<string, unknown>)?.[
                "topics"
              ] as string[]) || [],
            default_branch: String(
              (daemonRepo as Record<string, unknown>)?.["default_branch"] ||
                "main",
            ),
            created_at: String(
              (daemonRepo as Record<string, unknown>)?.["created_at"] || "",
            ),
            updated_at: String(
              (daemonRepo as Record<string, unknown>)?.["updated_at"] || "",
            ),
            license: String(
              (
                (daemonRepo as Record<string, unknown>)?.["license"] as Record<
                  string,
                  unknown
                >
              )?.["spdx_id"] || "",
            ),
          }
        : null,
    ].filter(Boolean),
    stats: {
      total_stars: panelStars + daemonStars,
      total_forks: panelForks + daemonForks,
      open_issues: panelIssues + daemonIssues,
      total_contributors: contributors.length,
      total_commits: allCommits.length,
      total_repos: orgRepos.length,
    },
    generatedAt: new Date().toISOString(),
  };
  const jsonFile = path.join(ROOT, "public", "assets", "github-data.json");
  await fs.ensureDir(path.dirname(jsonFile));
  await fs.writeFile(jsonFile, JSON.stringify(jsonData), "utf-8");
  console.log(
    `  github-data.json (${(JSON.stringify(jsonData).length / 1024).toFixed(1)} KB)`,
  );

  console.log(
    `\nWrote github-data.json — stars:${panelStars + daemonStars} forks:${panelForks + daemonForks} issues:${panelIssues + daemonIssues} contributors:${contributors.length}`,
  );

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
