#!/usr/bin/env tsx
/**
 * Convert .md docs to .mdx with proper component imports.
 *
 * Handles these custom markdown syntax patterns:
 *   <(chart title="..." bars="Label:100,Label:70")>       → <BarChart>
 *   <(statusgrid title="..." items="Label:100,Label:70")>  → <StatusGrid>
 *   <(flow title="..." steps="A->B:label,B->C:label")>    → <FlowDiagram>
 *   <(counter value=42 label="...")>                       → <Counter>
 *   <(progress label="..." value=75)>                      → <ProgressBar>
 *   <(image.png alt="..." caption="...")>                  → <ImageFigure>
 *
 * Usage: npx tsx scripts/convert-docs.ts
 */

import fs from "node:fs";
import path from "node:path";

const DOCS_DIR = path.resolve(import.meta.dirname, "../src/content/docs");

// ── Regex for the custom <(...)> syntax ──────────────────────────────────────
// Matches <( ... )> — lazy match up to the first )> closing delimiter
// Handles -> arrows in flow steps which contain > characters
const CUSTOM_SYNTAX_RE = /<\((.*?)\)>/g;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse key="value" and key=value pairs from a raw attribute string. */
function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // key="value" (with nested quotes handled)
  const quotedRe = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = quotedRe.exec(raw)) !== null) {
    attrs[m[1]] = m[2];
  }
  // key=value (unquoted numbers/booleans)
  const unquotedRe = /(\w+)=(\d+)\b/g;
  while ((m = unquotedRe.exec(raw)) !== null) {
    if (!(m[1] in attrs)) attrs[m[1]] = m[2];
  }
  return attrs;
}

/** Parse "Label:100,Label:70" into [{label, value}]. */
function parseBarItems(raw: string): { label: string; value: number }[] {
  return raw.split(",").map((b) => {
    const idx = b.lastIndexOf(":");
    return {
      label: b.slice(0, idx).trim(),
      value: parseInt(b.slice(idx + 1), 10) || 0,
    };
  });
}

/** Parse flow steps string into Step objects. */
function parseFlowSteps(raw: string) {
  return raw.split(",").map((s) => {
    const arrowIdx = s.indexOf("->");
    if (arrowIdx !== -1) {
      const colonIdx = s.lastIndexOf(":");
      const from = s.slice(0, arrowIdx).trim();
      const to = s
        .slice(arrowIdx + 2, colonIdx === -1 ? undefined : colonIdx)
        .trim();
      const label = colonIdx === -1 ? "" : s.slice(colonIdx + 1).trim();
      return { type: "transition", from, to, label };
    }
    return { type: "action", text: s.trim() };
  });
}

/** Detect which component types are used in the content. */
function detectComponents(content: string): Set<string> {
  const components = new Set<string>();
  const re = /<\((.*?)\)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const first = m[1].trim().split(/\s+/)[0];
    if (first === "chart") components.add("BarChart");
    else if (first === "statusgrid") components.add("StatusGrid");
    else if (first === "flow") components.add("FlowDiagram");
    else if (first === "counter") components.add("Counter");
    else if (first === "progress") components.add("ProgressBar");
    else if (/\.\w+$/.test(first)) components.add("ImageFigure");
  }
  return components;
}

/** Build the import block for detected components, with correct relative paths. */
function buildImports(components: Set<string>, filePath: string): string {
  if (components.size === 0) return "";
  const compsDir = path.resolve(DOCS_DIR, "..", "components");
  const fromDir = path.dirname(filePath);
  const relPrefix = path.relative(fromDir, compsDir).split(path.sep).join("/");
  const imports: string[] = [];
  const importNames: [string, string][] = [
    ["BarChart", "BarChart.astro"],
    ["StatusGrid", "StatusGrid.astro"],
    ["FlowDiagram", "FlowDiagram.astro"],
    ["Counter", "Counter.astro"],
    ["ProgressBar", "ProgressBar.astro"],
    ["ImageFigure", "ImageFigure.astro"],
  ];
  for (const [name, file] of importNames) {
    if (components.has(name)) {
      imports.push(`import ${name} from "${relPrefix}/${file}";`);
    }
  }
  return imports.join("\n");
}

// ── Convert a single file ────────────────────────────────────────────────────

interface ConvertResult {
  file: string;
  converted: boolean;
  components: string[];
}

function convertFile(filePath: string): ConvertResult {
  const raw = fs.readFileSync(filePath, "utf-8");

  // Split frontmatter from body
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return { file: filePath, converted: false, components: [] };

  const frontmatter = fmMatch[1];
  let body = fmMatch[2];

  // Check if there's any custom syntax to convert
  const components = detectComponents(body);
  const hasCustomSyntax = components.size > 0;

  if (!hasCustomSyntax) {
    return { file: filePath, converted: false, components: [] };
  }

  // Replace custom syntax with MDX components
  body = body.replace(CUSTOM_SYNTAX_RE, (_match, inner: string) => {
    const raw = inner.trim();
    const parts = raw.split(/\s+/);
    const first = parts[0];
    const attrs = parseAttrs(raw);

    // ── chart → <BarChart> ───────────────────────────────────────────────
    if (first === "chart") {
      const bars = parseBarItems(attrs.bars ?? "");
      const barsStr = JSON.stringify(bars);
      const titleProp = attrs.title ? ` title="${attrs.title}"` : "";
      const captionProp = attrs.caption ? ` caption="${attrs.caption}"` : "";
      return `<BarChart${titleProp} bars={${barsStr}}${captionProp} />`;
    }

    // ── statusgrid → <StatusGrid> ────────────────────────────────────────
    if (first === "statusgrid") {
      const items = parseBarItems(attrs.items ?? "");
      const itemsStr = JSON.stringify(items);
      const titleProp = attrs.title ? ` title="${attrs.title}"` : "";
      return `<StatusGrid${titleProp} items={${itemsStr}} />`;
    }

    // ── progress → <ProgressBar> ─────────────────────────────────────────
    if (first === "progress") {
      const label = attrs.label ?? "";
      const value = attrs.value ?? "0";
      return `<ProgressBar label="${label}" value={${value}} />`;
    }

    // ── flow → <FlowDiagram> ─────────────────────────────────────────────
    if (first === "flow") {
      const steps = parseFlowSteps(attrs.steps ?? "");
      const stepsStr = JSON.stringify(steps);
      const titleProp = attrs.title ? ` title="${attrs.title}"` : "";
      return `<FlowDiagram${titleProp} steps={${stepsStr}} />`;
    }

    // ── counter → <Counter> ──────────────────────────────────────────────
    if (first === "counter") {
      const value = attrs.value ?? "0";
      const label = attrs.label ?? "";
      const suffix = attrs.suffix ? ` suffix="${attrs.suffix}"` : "";
      return `<Counter value={${value}} label="${label}"${suffix} />`;
    }

    // ── image file → <ImageFigure> ───────────────────────────────────────
    if (/\.\w+$/.test(first)) {
      const src = `/assets/docs/${first}`;
      const mods = parts.slice(1);
      const alt = mods.find((m) => m.startsWith("alt="))?.slice(4) ?? "";
      const caption =
        mods.find((m) => m.startsWith("caption="))?.slice(8) ?? "";
      const full = mods.includes("full") ? " full" : "";
      const captionProp = caption ? ` caption="${caption}"` : "";
      return `<ImageFigure src="${src}" alt="${alt}"${captionProp}${full} />`;
    }

    return _match;
  });

  // Build import block
  const importComponents = detectComponents(body);
  const importBlock = buildImports(importComponents, filePath);

  // Assemble MDX content
  const output = `---\n${frontmatter}\n---\n\n${importBlock ? importBlock + "\n\n" : ""}${body}`;

  // Write .mdx file
  const mdxPath = filePath.replace(/\.md$/, ".mdx");
  fs.writeFileSync(mdxPath, output, "utf-8");

  return {
    file: path.relative(DOCS_DIR, filePath),
    converted: true,
    components: [...importComponents].sort(),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function findAllMd(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllMd(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function main() {
  console.log("Scanning docs in:", DOCS_DIR);
  const files = findAllMd(DOCS_DIR);
  console.log(`Found ${files.length} markdown files\n`);

  const results: ConvertResult[] = [];
  let converted = 0;
  let skipped = 0;

  for (const file of files) {
    const result = convertFile(file);
    results.push(result);
    if (result.converted) {
      converted++;
      const rel = result.file;
      console.log(`  ✓ ${rel}`);
      console.log(`    → ${rel.replace(/\.md$/, ".mdx")}`);
      console.log(`    components: ${result.components.join(", ")}`);
    } else {
      skipped++;
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Total files:  ${files.length}`);
  console.log(`Converted:    ${converted}`);
  console.log(`Skipped:      ${skipped} (no custom syntax)`);

  if (converted > 0) {
    console.log(
      `\nConverted files now have .mdx extensions with proper imports.`,
    );
    console.log(`Original .md files are preserved.`);
  }
}

main();
