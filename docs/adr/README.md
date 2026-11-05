# Architecture Decision Records

Decision records for quickflow-web, the Quick Flow website.

Foundational stack decisions were taken before estimation, in
`docs/anexa-tehnica.md`, and are recorded here. ADRs added later cover decisions
taken during development.

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [0001](0001-static-astro-no-client-framework.md) | Static Astro with no client framework | Accepted | 2026-10-27 |
| [0002](0002-contact-form-on-pages-function.md) | Contact form on a Cloudflare Pages Function | Accepted | 2026-10-27 |
| [0003](0003-rate-limiting-at-the-edge.md) | Rate limiting at the edge, not in code | Accepted | 2026-10-27 |
| [0004](0004-no-sentry.md) | No error monitoring service | Accepted | 2026-10-27 |
| [0005](0005-single-playwright-test.md) | One Playwright test, on the form only | Accepted | 2026-10-27 |
| [0006](0006-page-views-counted-on-the-server.md) | Page views counted on the server | Accepted | 2026-11-05 |

## Creating a new ADR

1. Copy `template.md` to `NNNN-title-with-dashes.md`
2. Fill it in
3. Add a row to the index above

Accepted ADRs are not edited. A changed decision gets a new ADR that supersedes
the old one, and the old one's status becomes Superseded.

## Status values

- **Proposed**: under discussion
- **Accepted**: decided, implementing
- **Superseded**: replaced by a later ADR
- **Rejected**: considered and not adopted
