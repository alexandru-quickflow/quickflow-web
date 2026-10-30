# ADR-0005: One Playwright test, on the form only

**Status**: Accepted, amended 2026-10-30
**Date**: 2026-10-27
**Deciders**: Alexandru Trofaniuc

## Context

The standard stack includes Vitest and Playwright. This site is static text with
one interactive element. There is no business logic, no data layer and no
computation to unit test. Writing tests for the pages would mean asserting that
text checked into the repository is still in the repository.

The estimate (`04-estimare.md`) allows 15 percent of the build for testing and
bugs, and the deadline is tight.

## Decision

One Playwright spec covering the contact form: a successful submission, and
validation when required fields are empty. No Vitest, no page snapshot tests, no
visual regression.

## Consequences

**Good**: the only part that can actually break is covered, and the suite runs
in seconds, so it will still be run a year from now.

**Bad**: a broken layout, a dead portfolio link or a missing translation will
not be caught by anything automated. Those depend on looking at the site, which
is in the launch checklist and nowhere else.

**Revisit when**: the site gains pages built from data rather than hand-written
files, for example the blog, where a build can produce a broken page without
anyone touching that page.

## Amendment, 30 October 2026

Written when the decision was made. Carried out three days later, during the
pre-launch audit, which found `tests/` empty: the spec this ADR describes had
never been written, so the one part that can actually break was covered by
nothing at all.

It exists now, in `tests/contact.spec.ts`, and it is one spec as decided: a
successful submission, and validation when the required fields are empty, in
both languages. Two things about carrying it out were not foreseen here.

**The spec cannot reach the function.** `astro preview` serves the static build
and does not run Cloudflare Pages Functions, so a browser test either needs
wrangler added to the project or has to fulfil the response itself. It fulfils
it. That makes the spec an honest test of the page: what it posts, what it does
with each answer, and what a reader who cannot see the screen is told. It is
not a test of what the handler decides.

**So the handler gets its own tests**, in `tests/contact-paths.test.mjs`, run by
`node --test`. This is not the Vitest this ADR rules out and it brings in no
dependency: Node runs the TypeScript directly. The reason it is justified now
and was not on 27 October is that the context has changed. This ADR says "there
is no business logic to unit test", and that was true. The handler now decides
whether a message is mailed to an address a stranger typed, which is the one
branch in this repository that can put mail in somebody else's inbox, and it is
exactly the kind of thing that must not be checked by reading it.

Both halves run from `npm test`, in about five seconds together, which keeps the
consequence this ADR cared about: a suite that will still be run a year from now.

The "Bad" above stands unchanged. A broken layout, a dead portfolio link or a
missing translation is still caught by nothing automated. The audit found
sixteen welded words and twelve unreadable placeholders that no check here could
see, and the launch checklist now says out loud which of those blind spots are
closed and which are still a person looking at the page.
