// Made by https://github.com/bthavanish
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const OUTPUT = path.join(ROOT, "public", "assets", "licenses.json");
const GITHUB_REPOS = ["panel", "daemon", "addons", "home"];
const ORG = "AirlinkLabs";

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

function run(cmd: string): string | null {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8", timeout: 60_000 });
  } catch {
    return null;
  }
}

function ghGetFile(
  repo: string,
  filePath: string,
): Record<string, unknown> | null {
  const raw = run(
    `gh api repos/${ORG}/${repo}/contents/${filePath} --jq '.content'`,
  );
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw.trim(), "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function ghGetLicense(repo: string): { spdx: string; url: string } | null {
  const raw = run(`gh api repos/${ORG}/${repo} --jq '.license'`);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return {
      spdx: data?.spdx_id || data?.name || "UNKNOWN",
      url: `https://github.com/${ORG}/${repo}/blob/main/LICENSE`,
    };
  } catch {
    return null;
  }
}

function fetchNpmLicense(
  pkg: string,
): { license: string; version: string; description: string } | null {
  const raw = run(
    `npm view ${pkg} license version description --json 2>/dev/null`,
  );
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    let license = "UNKNOWN";
    if (typeof data === "string") {
      license = data;
    } else if (data.license) {
      license = Array.isArray(data.license)
        ? data.license.join(", ")
        : data.license;
    }
    return {
      license,
      version: data.version || "",
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
  console.log("cache-licenses: fetching live licenses via gh api + npm...");

  const ghCheck = run("gh auth status");
  if (ghCheck === null && !process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.warn("  warn: gh CLI not authenticated — skipping repo licenses");
  }

  // 1. Fetch repo licenses + their package.json deps
  const allRepos: RepoLicense[] = [];
  const allDeps: NpmDep[] = [];
  const seenDeps = new Set<string>();

  for (const repo of GITHUB_REPOS) {
    console.log(`  fetching ${ORG}/${repo}...`);

    // Repo license
    const lic = ghGetLicense(repo);
    if (lic) {
      allRepos.push({
        name: repo,
        license: lic.spdx,
        url: lic.url,
        description: "",
      });
    }

    // Package.json
    const pkgJson = ghGetFile(repo, "package.json");
    if (!pkgJson) {
      console.warn(`    skip: could not fetch package.json for ${repo}`);
      continue;
    }

    const deps = extractDeps(pkgJson);
    const depNames = Object.keys(deps);
    console.log(`    ${depNames.length} dependencies`);

    // Fetch license for each dep from npm registry
    for (const name of depNames) {
      if (seenDeps.has(name)) continue;
      seenDeps.add(name);

      const info = fetchNpmLicense(name);
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

  // 2. Site's own npm deps (this project's package.json)
  const siteDeps = extractDeps(
    fs.readJsonSync(path.join(ROOT, "package.json")),
  );
  const siteDepNames = Object.keys(siteDeps).filter((n) => !seenDeps.has(n));
  if (siteDepNames.length) {
    console.log(`  fetching ${siteDepNames.length} site dependencies...`);
    for (const name of siteDepNames) {
      seenDeps.add(name);
      const info = fetchNpmLicense(name);
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
