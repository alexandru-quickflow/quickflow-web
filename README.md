# quickflow-web

The Quick Flow website. Astro, static output, deployed to Cloudflare Pages at
[quickflow.dev](https://quickflow.dev).

## Running it

```bash
npm install
npm run dev
```

Build and preview the production output:

```bash
npm run build
npm run preview
```

## Local environment

The contact form needs two secrets. Create `.dev.vars` in the project root, which
is gitignored:

```
RESEND_API_KEY=re_...
TURNSTILE_SECRET_KEY=0x...
```

Without them the pages still build and render. Only the form fails.

## Layout

```
src/
├── pages/          routes, ro at the root and en under /en
├── layouts/
├── components/
├── i18n/           translation strings
└── styles/
functions/
└── api/contact.ts  the only server-side code
docs/
├── spec.md                  approved spec v2, frozen
├── anexa-tehnica.md         stack decisions taken before estimating
├── adr/                     decision records
└── architecture/            C4 diagrams
tests/                       one Playwright spec, on the form
```

## Documents outside this repository

`D:\Google Drive\work\Projects\quickflow\` holds the client-facing side: lead
notes, discovery notes, the services research, both spec versions, the estimate,
the work plan and the change request log.

## Deployment

Pushing to `main` deploys to production. Any other branch gets a preview URL.

Three pieces of configuration live in the Cloudflare dashboard and are not in
this repository: the rate limiting rule on `/api/contact`, the Web Analytics
token, and the two environment variables above. See `CLAUDE.md`.
