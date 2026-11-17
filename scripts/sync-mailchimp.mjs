// Keeps a saved template in each Mailchimp client's account in sync with the
// published email, so the version the client approved is ready in Mailchimp.
// One template per email: created the first time, updated when the HTML
// changes. It never creates or sends a campaign.
//
// Clients with "platform": "mailchimp" in markup.config.json are synced. Each
// needs its own key in MAILCHIMP_API_KEY_<CLIENT> (for example
// MAILCHIMP_API_KEY_ACES); without it that client is skipped with a warning.
//
// Env: DRY_RUN=1 to only report. MAILCHIMP_API_BASE overrides the API host
// (tests only).
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CONFIG = JSON.parse(readFileSync(join(ROOT, "markup.config.json"), "utf8"));
const REGISTRY_FILE = join(ROOT, "mailchimp.json");
const DRY_RUN = process.env.DRY_RUN === "1";

const registry = existsSync(REGISTRY_FILE) ? JSON.parse(readFileSync(REGISTRY_FILE, "utf8")) : {};
const clients = Object.entries(CONFIG.clients ?? {})
  .filter(([, settings]) => settings?.platform === "mailchimp")
  .map(([client]) => client);

const synced = [];
let failed = 0;

for (const client of clients) {
  const envName = `MAILCHIMP_API_KEY_${client.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const key = process.env[envName];
  const pending = listEmails(client).filter((email) => registry[email.key]?.sha !== email.sha);
  console.log(`${client}: ${pending.length} email(s) to copy to Mailchimp.`);
  if (pending.length === 0) continue;
  if (!key && !DRY_RUN) {
    console.log(`::warning::${envName} is not set, so ${pending.length} ${client} email(s) weren't copied to Mailchimp.`);
    continue;
  }

  for (const email of pending) {
    const existing = registry[email.key];
    if (DRY_RUN) {
      console.log(`[dry run] would ${existing ? "update" : "create"} the Mailchimp template "${email.name}" for ${email.key}`);
      continue;
    }
    try {
      const body = { name: email.name, html: email.html };
      let template;
      if (existing?.templateId) {
        template = await mailchimp(key, "PATCH", `/templates/${existing.templateId}`, body).catch((error) => {
          if (error.status === 404) return null; // deleted in Mailchimp: make a new one
          throw error;
        });
      }
      const action = template ? "updated" : existing?.templateId ? "recreated" : "created";
      template ??= await mailchimp(key, "POST", "/templates", body);
      registry[email.key] = {
        templateId: template.id,
        name: template.name ?? email.name,
        sha: email.sha,
        updatedAt: new Date().toISOString(),
      };
      synced.push({ key: email.key, ...registry[email.key], action });
      console.log(`Mailchimp template ${template.id} "${template.name ?? email.name}" ${action} for ${email.key}`);
    } catch (error) {
      failed++;
      console.log(`::error::Could not copy ${email.key} to Mailchimp: ${error.message}`);
    }
  }
}

if (synced.length) {
  const sorted = Object.fromEntries(Object.keys(registry).sort().map((key) => [key, registry[key]]));
  writeFileSync(REGISTRY_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = ["### Mailchimp templates", "", "| Email | Template | Action |", "| --- | --- | --- |"];
    for (const row of synced) lines.push(`| ${row.key} | ${row.name} (${row.templateId}) | ${row.action} |`);
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  }
}
process.exit(failed ? 1 : 0);

function listEmails(client) {
  const dir = join(ROOT, client);
  if (!existsSync(dir)) return [];
  const emails = [];
  for (const slug of readdirSync(dir)) {
    const file = join(dir, slug, "index.html");
    if (!existsSync(file)) continue;
    const html = readFileSync(file, "utf8");
    emails.push({
      key: `${client}/${slug}`,
      html,
      sha: createHash("sha256").update(html).digest("hex"),
      name: (readTitle(html) || slug).slice(0, 100),
    });
  }
  return emails;
}

function readTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
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

// API keys end in the account's data center (for example "-us21"), which is
// also the API host: https://us21.api.mailchimp.com/3.0
async function mailchimp(key, method, path, body) {
  const dc = /-([a-z]+\d+)$/.exec(key)?.[1];
  const base = process.env.MAILCHIMP_API_BASE || (dc ? `https://${dc}.api.mailchimp.com/3.0` : "https://api.mailchimp.com/3.0");
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 200);
    try {
      const json = JSON.parse(text);
      detail = [json.title, json.detail].filter(Boolean).join(": ");
    } catch {}
    const error = new Error(`Mailchimp API ${res.status} ${detail}`.trim());
    error.status = res.status;
    throw error;
  }
  return JSON.parse(text);
}
