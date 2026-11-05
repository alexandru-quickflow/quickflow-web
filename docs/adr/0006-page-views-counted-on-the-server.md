# ADR-0006: Page views counted on the server

**Status**: Accepted
**Date**: 2026-11-05
**Deciders**: Alexandru Trofaniuc

## Context

On 30 October 2026 the Cloudflare Web Analytics beacon was turned off and kept
off: it is 10,264 bytes gzipped against 5,612 for the whole site, and the home
page tells readers it ships 6 KB of JavaScript (docs/launch-checklist.md,
"Analytics stays off"). Traffic was to be read from the Cloudflare dashboard.

A week of that showed what the dashboard cannot answer. From 30 October to
4 November the zone saw 120 to 216 unique visitors a day, and most of them were
scanners, crawlers and headless browsers. The adaptive dataset on the free plan
offers no referrer and no bot score, so it could not say whether any person
read the site or where one came from. That was the question the owner needed
answered.

The spec requires cookieless analytics and no cookie banner. It does not
require a beacon.

## Decision

A Pages Function middleware, `functions/_middleware.ts`, writes one data point
per page view to Workers Analytics Engine, after the page has been served. It
records the path, the referring host, the country, phone or computer, a robot
guess and the status. No IP address, no user agent string, no cookie and no
identifier. `public/_routes.json` keeps static files away from it.

## Consequences

**Good**: the page carries nothing new, so the 6 KB stamp, `SELF_JS` and the
Bubble comparison stay true. The data stays with Cloudflare, already named on
both privacy pages as the host. Free at this volume: Analytics Engine is not
billed today, and the free plan allows 100,000 data points and 100,000
Functions requests a day.

**Bad**: every page request now runs a Function, which adds its start-up time
to the first byte of the HTML. It is measured after deployment against the
spec's LCP under 1 second. The Functions allowance is shared with every project
on the account, hence Fail open. The robot guess is a heuristic: a headless
browser that sends real browser headers counts as a browser. With no identifier
there are no unique visitors, only page views and where they came from. The
binding lives in the dashboard, and if it disappears the counter goes silent
without an error.

**Revisit when**: LCP on mobile goes over 1 second because of the Function, the
account approaches the daily Functions allowance, or the owner wants unique
visitors, which would need an identifier and a new look at the privacy pages.
