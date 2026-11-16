# Email previews

Live preview links for Claude-built emails, so the team and clients can review them in MarkUp with working links. It replaces the Really Good Emails preview link.

## How it works

1. Claude builds the email HTML from the approved launch plan. Images stay hosted in Pardot files.
2. The HTML is saved in this repo as `<client>/<email>/index.html`, for example `dmec/co-email-1/index.html`.
3. GitHub publishes it about a minute later at
   `https://nonprofit-marketing-nerds.github.io/email-previews/dmec/co-email-1/`
4. Right after it's live, GitHub creates a MarkUp for that link and saves the MarkUp link in `markups.json`, under the email's folder name (for example `dmec/co-email-1`). This only happens the first time an email is published.
5. Client edits are made in the same file. The preview link and the MarkUp stay the same, so the MarkUp shows the new version.
6. Once approved, the same HTML goes into Pardot to test and schedule.

## Rules

- **One folder per client, one folder per email.** Use short lowercase names with hyphens: `dmec/co-email-2/`, `aces/fall-appeal-1/`.
- **The file is the final email.** Don't add anything that is only for the preview. What is in the repo is what goes into Pardot.
- **No images in this repo.** Use the Pardot file URLs.
- **Everything here is public.** The repo is public, so anyone can browse the email files and `markups.json` on GitHub. Search engines are told not to index the preview pages (the publish step adds a `noindex` tag to the site copy only).
- **Pardot links don't work here.** Unsubscribe, email preferences, view online and merge fields only work in a Pardot test send.

## After an edit

GitHub can keep serving the old version for up to 10 minutes. If MarkUp still shows the old email, wait a few minutes and reload.

## Repo layout

- `<client>/<email>/index.html`: the emails.
- `index.html`: a blank landing page, so the site root doesn't list anything.
- `markups.json`: the MarkUp link for each email. GitHub updates it; don't edit it by hand unless a MarkUp was deleted.
- `markup.config.json`: for each client, the label used in MarkUp names, the platform that sends its emails (`pardot`, `neon-one` or `other`; the email-preview skill uses it for its checks), and an optional MarkUp folder ID (empty means the workspace root).
- `scripts/build-site.mjs`: builds the published copy and adds the `noindex` tag.
- `scripts/create-markups.mjs`: creates the MarkUp for each new email. Run it with `DRY_RUN=1` to see what it would do.
- `.github/workflows/pages.yml`: publishes on every push to `main`, then creates the MarkUps. It needs the `MARKUP_API_KEY` repo secret; without it the site still publishes and the MarkUp step is skipped.
