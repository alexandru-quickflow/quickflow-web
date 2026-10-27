# ADR-0005: One Playwright test, on the form only

**Status**: Accepted
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
