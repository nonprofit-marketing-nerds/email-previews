// Creates a MarkUp for every published email that doesn't have one yet and
// records the links in markups.json, so Claude can read the MarkUp link back.
//
// An email is any <client>/<email>/index.html. Its preview link is
// <site>/<client>/<email>/ and never changes, so later edits show up in the
// same MarkUp.
//
// Env: MARKUP_API_KEY (required unless DRY_RUN=1), DRY_RUN=1 to only report.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const API = "https://api.markup.io/api/v2";
const API_VERSION = "2023-02-22";
const KEY = process.env.MARKUP_API_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";
const REGISTRY_FILE = join(ROOT, "markups.json");
const CONFIG = JSON.parse(readFileSync(join(ROOT, "markup.config.json"), "utf8"));
const SITE = CONFIG.site.replace(/\/+$/, "");
const NOT_CLIENTS = new Set(["node_modules", "scripts"]);

const registry = existsSync(REGISTRY_FILE) ? JSON.parse(readFileSync(REGISTRY_FILE, "utf8")) : {};
const emails = findEmails();
const missing = emails.filter((email) => !registry[email.key]);

console.log(`${emails.length} email(s) found, ${missing.length} without a MarkUp.`);
if (missing.length === 0) process.exit(0);
if (!KEY && !DRY_RUN) {
  console.log("::warning::MARKUP_API_KEY is not set, so no MarkUp was created.");
  process.exit(0);
}

const created = [];
let failed = 0;
for (const email of missing) {
  const client = CONFIG.clients[email.client] ?? {};
  const name = `${client.label ?? email.client.toUpperCase()}: ${email.title}`.slice(0, 150);
  const folderId = client.folderId || CONFIG.defaultFolderId || undefined;
  if (DRY_RUN) {
    console.log(`[dry run] would create "${name}" for ${email.previewUrl}${folderId ? ` in folder ${folderId}` : ""}`);
    continue;
  }
  try {
    await waitUntilLive(email.previewUrl);
    const markup = await createMarkup({ url: email.previewUrl, name, parentFolderId: folderId });
    registry[email.key] = {
      name,
      previewUrl: email.previewUrl,
      markupUrl: markup.markupUrl,
      markupId: markup.id,
      createdAt: new Date().toISOString(),
    };
    created.push(registry[email.key]);
    console.log(`Created ${markup.markupUrl} for ${email.previewUrl}`);
  } catch (error) {
    failed++;
    console.log(`::error::Could not create a MarkUp for ${email.key}: ${error.message}`);
  }
}

if (created.length) {
  const sorted = Object.fromEntries(Object.keys(registry).sort().map((key) => [key, registry[key]]));
  writeFileSync(REGISTRY_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  writeSummary(created);
}
process.exit(failed ? 1 : 0);

function findEmails() {
  const found = [];
  for (const client of readdirSync(ROOT)) {
    if (client.startsWith(".") || client.startsWith("_") || NOT_CLIENTS.has(client)) continue;
    const clientDir = join(ROOT, client);
    if (!statSync(clientDir).isDirectory()) continue;
    for (const slug of readdirSync(clientDir)) {
      const file = join(clientDir, slug, "index.html");
      if (!existsSync(file)) continue;
      found.push({
        key: `${client}/${slug}`,
        client,
        title: readTitle(file) || slug,
        previewUrl: `${SITE}/${client}/${slug}/`,
      });
    }
  }
  return found;
}

function readTitle(file) {
  const match = readFileSync(file, "utf8").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return match[1]
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// The deploy job finishes before this runs, but GitHub can take a few seconds
// more to serve a brand new page.
async function waitUntilLive(url) {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const res = await fetch(url, { redirect: "follow" }).catch(() => null);
    if (res?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  throw new Error(`${url} is not live after 5 minutes`);
}

async function createMarkup(body) {
  const res = await fetch(`${API}/markups/url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Markup-API-Version": API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MarkUp API ${res.status}: ${text.slice(0, 300)}`);
  const markup = JSON.parse(text).data;
  if (!markup?.markupUrl) throw new Error(`Unexpected MarkUp response: ${text.slice(0, 300)}`);
  return markup;
}

function writeSummary(rows) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const lines = ["### New MarkUps", "", "| Email | Preview | MarkUp |", "| --- | --- | --- |"];
  for (const row of rows) lines.push(`| ${row.name} | ${row.previewUrl} | ${row.markupUrl} |`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}
