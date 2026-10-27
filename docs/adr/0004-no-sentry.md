# ADR-0004: No error monitoring service

**Status**: Accepted
**Date**: 2026-10-27
**Deciders**: Alexandru Trofaniuc

## Context

Sentry is part of the standard stack in this shop. Here the entire server-side
surface is one function that sends an email, and the pages are static HTML with
almost no JavaScript (ADR-0001).

## Decision

No Sentry and no equivalent. Cloudflare's own logs cover the function.

## Consequences

**Good**: one fewer account, one fewer DSN to keep out of the repository, and no
client-side script on a site whose main performance claim is that it ships
almost no JavaScript.

**Bad**: a failing form submission is only visible if someone goes looking in
the Cloudflare dashboard. There is no alert. If the Resend key expires, the form
fails silently until a visitor complains or the owner tests it.

**Mitigation**: the runbook (stage 09) includes a monthly manual form
submission. This is weak and it is accepted knowingly, because the alternative
costs more than the failure it prevents at this stage.

**Revisit when**: the blog goes live with dynamic routes, or the form starts
feeding anything beyond an inbox. Either one makes silent failure expensive
enough to pay for monitoring.
