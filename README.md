# Email previews

Live preview links for Claude-built emails, so the team and clients can review them in MarkUp with working links. It replaces the Really Good Emails preview link.

## How it works

1. Claude builds the email HTML from the approved launch plan. Images stay hosted in Pardot files.
2. The HTML is saved in this repo as `<client>/<email>/index.html`, for example `dmec/co-email-1/index.html`.
3. GitHub publishes it about a minute later at
   `https://nonprofit-marketing-nerds.github.io/email-previews/dmec/co-email-1/`
4. That link goes into MarkUp as a website.
5. Client edits are made in the same file. The link never changes.
6. Once approved, the same HTML goes into Pardot to test and schedule.

## Rules

- **One folder per client, one folder per email.** Use short lowercase names with hyphens: `dmec/co-email-2/`, `aces/fall-appeal-1/`.
- **The file is the final email.** Don't add anything that is only for the preview. What is in the repo is what goes into Pardot.
- **No images in this repo.** Use the Pardot file URLs.
- **Pages are public to anyone with the link.** Search engines are told not to index them (the publish step adds a `noindex` tag to the site copy only), but anyone with the URL can open it.
- **Pardot links don't work here.** Unsubscribe, email preferences, view online and merge fields only work in a Pardot test send.

## After an edit

GitHub can keep serving the old version for up to 10 minutes. If MarkUp still shows the old email, wait a few minutes and reload.

## Repo layout

- `<client>/<email>/index.html`: the emails.
- `index.html`: a blank landing page, so the site root doesn't list anything.
- `scripts/build-site.mjs`: builds the published copy and adds the `noindex` tag.
- `.github/workflows/pages.yml`: publishes on every push to `main`.
