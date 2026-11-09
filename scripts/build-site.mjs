// Builds the GitHub Pages copy of the repo in _site.
// Every HTML page gets a robots noindex tag in that copy only, so the email
// files in the repo stay exactly as they go into Pardot.
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "_site");
const SKIP = new Set([".git", ".github", ".gitignore", "_site", "node_modules", "scripts", "README.md"]);
const NOINDEX = '<meta name="robots" content="noindex, nofollow">';
const HEAD_TAG = /<head(\s[^>]*)?>/i; // matches <head> but not <header>

rmSync(OUT, { recursive: true, force: true });
for (const name of readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  cpSync(join(ROOT, name), join(OUT, name), { recursive: true });
}

const pages = [];
walk(OUT);
console.log(`Built ${pages.length} page(s):`);
for (const page of pages) console.log(`  /${page}`);

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.toLowerCase().endsWith(".html")) addNoindex(path);
  }
}

function addNoindex(file) {
  const raw = readFileSync(file, "utf8");
  pages.push(relative(OUT, file).replaceAll("\\", "/"));
  // Drop any robots tag the email brings, so the site copy is always noindex.
  const html = raw.replace(/<meta[^>]+name=["']?robots["']?[^>]*>\s*/gi, "");
  const out = HEAD_TAG.test(html)
    ? html.replace(HEAD_TAG, (tag) => `${tag}\n${NOINDEX}`)
    : `${NOINDEX}\n${html}`;
  writeFileSync(file, out);
}
