import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const OUTPUT = path.join(ROOT, "public", "assets", "licenses.json");
const GITHUB_REPOS = ["panel", "daemon", "addons", "home"];

interface NpmLicense {
  name: string;
  version: string;
  license: string;
  repository: string;
}

interface RepoLicense {
  name: string;
  license: string;
  url: string;
}

interface CdnLicense {
  name: string;
  version: string;
  license: string;
  url: string;
}

// CDN dependencies loaded at runtime (not in package.json)
const CDN_DEPS: CdnLicense[] = [
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
  } catch (err) {
    console.warn(`  warn: command failed: ${cmd}`);
    console.warn(`        ${(err as Error).message.split("\n")[0]}`);
    return null;
  }
}

function getNpmLicenses(): NpmLicense[] {
  // Try license-checker first
  const raw = run("npx license-checker --json --production");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<
        string,
        { licenses?: string; version?: string; repository?: string }
      >;
      return Object.entries(parsed).map(([key, val]) => {
        // key format: "package@version" or "@scope/package@version"
        const atIdx = key.lastIndexOf("@");
        const name = key.slice(0, atIdx);
        const version = key.slice(atIdx + 1);
        return {
          name,
          version: version || val.version || "",
          license: Array.isArray(val.licenses)
            ? val.licenses.join(", ")
            : val.licenses || "UNKNOWN",
          repository: val.repository || "",
        };
      });
    } catch {
      console.warn("  warn: failed to parse license-checker output");
    }
  }

  // Fallback: read package-lock.json
  console.log("  fallback: reading package-lock.json...");
  return readPackageLockLicenses();
}

function readPackageLockLicenses(): NpmLicense[] {
  const lockPath = path.join(ROOT, "package-lock.json");
  if (!fs.existsSync(lockPath)) {
    console.warn("  warn: package-lock.json not found");
    return [];
  }

  const lock = fs.readJsonSync(lockPath) as {
    packages?: Record<string, { version?: string; license?: unknown }>;
  };
  const packages = lock.packages || {};
  const results: NpmLicense[] = [];

  for (const [key, val] of Object.entries(packages)) {
    if (!key || key === "") continue;
    const parts = key.split("node_modules/");
    const name = parts[parts.length - 1];
    if (!name) continue;

    const license = Array.isArray(val.license)
      ? val.license.join(", ")
      : typeof val.license === "string"
        ? val.license
        : "UNKNOWN";

    results.push({
      name,
      version: val.version || "",
      license,
      repository: "",
    });
  }

  return results;
}

function getRepoLicenses(): RepoLicense[] {
  const results: RepoLicense[] = [];

  for (const repo of GITHUB_REPOS) {
    const raw = run(`gh api repos/AirlinkLabs/${repo}`);
    if (!raw) {
      console.warn(`  skip: could not fetch license for AirlinkLabs/${repo}`);
      continue;
    }

    try {
      const data = JSON.parse(raw) as {
        license?: { spdx_id?: string; name?: string } | null;
        html_url?: string;
      };
      const licenseName =
        data.license?.spdx_id || data.license?.name || "UNKNOWN";
      const url = `https://github.com/AirlinkLabs/${repo}/blob/main/LICENSE`;
      results.push({ name: repo, license: licenseName, url });
    } catch {
      console.warn(`  warn: failed to parse license for ${repo}`);
    }
  }

  return results;
}

async function run_() {
  console.log("cache-licenses: starting...");

  const npm = getNpmLicenses();
  console.log(`  npm: ${npm.length} packages`);

  let repos: RepoLicense[] = [];
  const ghCheck = run("gh auth status");
  if (ghCheck !== null || process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
    console.log("  fetching GitHub repo licenses...");
    repos = getRepoLicenses();
  } else {
    console.warn("  warn: gh CLI not authenticated — skipping repo licenses");
  }
  console.log(`  repos: ${repos.length} repos`);

  const output = {
    generatedAt: new Date().toISOString(),
    npm,
    repos,
    cdn: CDN_DEPS,
  };

  await fs.ensureDir(path.dirname(OUTPUT));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2), "utf-8");
  console.log(
    `  wrote ${OUTPUT} (${(JSON.stringify(output).length / 1024).toFixed(1)} KB)`,
  );
}

run_().catch((err) => {
  console.error("cache-licenses failed:", err);
  process.exit(1);
});
