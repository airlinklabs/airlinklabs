// Made by https://github.com/bthavanish
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const OUTPUT = path.join(ROOT, "public", "assets", "licenses.json");
const GITHUB_REPOS = ["panel", "daemon", "addons", "home"];
const ORG = "AirlinkLabs";

const GH_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

interface NpmDep {
  name: string;
  version: string;
  license: string;
  repository: string;
  description: string;
}

interface RepoLicense {
  name: string;
  license: string;
  url: string;
  description: string;
}

interface CdnDep {
  name: string;
  version: string;
  license: string;
  url: string;
}

const CDN_DEPS: CdnDep[] = [
  {
    name: "mermaid",
    version: "11",
    license: "MIT",
    url: "https://github.com/mermaid-js/mermaid/blob/develop/LICENSE",
  },
];

async function ghApi(endpoint: string): Promise<any> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://api.github.com${endpoint}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GH_TOKEN) headers["Authorization"] = `Bearer ${GH_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.warn(`  warn: GitHub API ${res.status}: ${endpoint}`);
    return null;
  }
  return res.json();
}

async function ghGetFile(
  repo: string,
  filePath: string,
): Promise<Record<string, unknown> | null> {
  const data = await ghApi(`/repos/${ORG}/${repo}/contents/${filePath}`);
  if (!data || !data.content) return null;
  try {
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function ghGetLicense(
  repo: string,
): Promise<{ spdx: string; url: string } | null> {
  const data = await ghApi(`/repos/${ORG}/${repo}`);
  if (!data) return null;
  return {
    spdx: data?.license?.spdx_id || data?.license?.name || "UNKNOWN",
    url: `https://github.com/${ORG}/${repo}/blob/main/LICENSE`,
  };
}

async function fetchNpmLicense(
  pkg: string,
): Promise<{ license: string; version: string; description: string } | null> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const latest = data["dist-tags"]?.latest;
    const versionData = latest ? data.versions?.[latest] : null;
    let license = "UNKNOWN";
    if (versionData?.license) {
      license = Array.isArray(versionData.license)
        ? versionData.license.join(", ")
        : versionData.license;
    } else if (data.license) {
      license = Array.isArray(data.license)
        ? data.license.join(", ")
        : typeof data.license === "string"
          ? data.license
          : "UNKNOWN";
    }
    return {
      license,
      version: latest || "",
      description: data.description || "",
    };
  } catch {
    return null;
  }
}

function extractDeps(pkgJson: Record<string, unknown>): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const field of ["dependencies", "devDependencies"]) {
    const section = pkgJson[field] as Record<string, string> | undefined;
    if (section) {
      for (const [name, version] of Object.entries(section)) {
        if (!deps[name]) deps[name] = version;
      }
    }
  }
  return deps;
}

async function run_() {
  console.log("cache-licenses: fetching live licenses via GitHub API + npm...");

  if (!GH_TOKEN) {
    console.warn(
      "  warn: GITHUB_TOKEN/GH_TOKEN not set — rate limited to 60 req/hr",
    );
  }

  // 1. Fetch repo licenses + their package.json deps
  const allRepos: RepoLicense[] = [];
  const allDeps: NpmDep[] = [];
  const seenDeps = new Set<string>();

  for (const repo of GITHUB_REPOS) {
    console.log(`  fetching ${ORG}/${repo}...`);

    // Repo license
    const lic = await ghGetLicense(repo);
    if (lic) {
      allRepos.push({
        name: repo,
        license: lic.spdx,
        url: lic.url,
        description: "",
      });
      console.log(`    license: ${lic.spdx}`);
    } else {
      console.warn(`    warn: could not fetch license for ${repo}`);
    }

    // Package.json
    const pkgJson = await ghGetFile(repo, "package.json");
    if (!pkgJson) {
      console.warn(`    skip: could not fetch package.json for ${repo}`);
      continue;
    }

    const deps = extractDeps(pkgJson);
    const depNames = Object.keys(deps);
    console.log(`    ${depNames.length} dependencies — fetching licenses...`);

    // Fetch license for each dep from npm registry (batch of 5)
    for (let i = 0; i < depNames.length; i++) {
      const name = depNames[i];
      if (seenDeps.has(name)) continue;
      seenDeps.add(name);

      const info = await fetchNpmLicense(name);
      if (info) {
        allDeps.push({
          name,
          version: info.version,
          license: info.license,
          repository: `https://www.npmjs.com/package/${name}`,
          description: info.description,
        });
      }

      // Progress indicator
      if ((i + 1) % 20 === 0) {
        console.log(`    ... ${i + 1}/${depNames.length} deps done`);
      }
    }
  }

  // 2. Site's own npm deps (this project's package.json)
  const sitePkg = fs.readJsonSync(path.join(ROOT, "package.json"));
  const siteDeps = extractDeps(sitePkg);
  const siteDepNames = Object.keys(siteDeps).filter((n) => !seenDeps.has(n));
  if (siteDepNames.length) {
    console.log(`  fetching ${siteDepNames.length} site dependencies...`);
    for (const name of siteDepNames) {
      seenDeps.add(name);
      const info = await fetchNpmLicense(name);
      if (info) {
        allDeps.push({
          name,
          version: info.version,
          license: info.license,
          repository: `https://www.npmjs.com/package/${name}`,
          description: info.description,
        });
      }
    }
  }

  // 3. Sort deps alphabetically
  allDeps.sort((a, b) => a.name.localeCompare(b.name));

  const output = {
    generatedAt: new Date().toISOString(),
    repos: allRepos,
    npm: allDeps,
    cdn: CDN_DEPS,
  };

  await fs.ensureDir(path.dirname(OUTPUT));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2), "utf-8");
  console.log(
    `  wrote ${OUTPUT} — ${allRepos.length} repos, ${allDeps.length} npm deps, ${CDN_DEPS.length} CDN (${(JSON.stringify(output).length / 1024).toFixed(1)} KB)`,
  );
}

run_().catch((err) => {
  console.error("cache-licenses failed:", err);
  process.exit(1);
});
