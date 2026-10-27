# ADR-0003: Rate limiting at the edge, not in code

**Status**: Accepted
**Date**: 2026-10-27
**Deciders**: Alexandru Trofaniuc

## Context

The contact form sends a copy of the submission to the address typed into the
email field. That makes it usable as a mail relay: submit repeatedly with
someone else's address and the site sends them mail. The spec, section 3.1,
requires one copy per submission and a cap of five submissions per hour from the
same IP.

Turnstile (ADR-0002) stops bots but not a determined person with a browser.

## Decision

The cap is a Cloudflare rate limiting rule on `/api/contact`, configured in the
dashboard. The function itself does not count requests.

## Consequences

**Good**: blocked requests never reach the function, so they cost nothing and
cannot be worked around by anything the function does wrong. One rule, no state
to store, no counter to keep correct.

**Bad**: the limit lives in dashboard configuration rather than in the
repository, so it is invisible to anyone reading the code and is not restored by
redeploying. It has to be written down in the runbook and checked at launch.

**Revisit when**: the rule proves too blunt, for example if it blocks several
people behind one office IP. The fix would be a per-email counter in KV, which
means state and therefore a real trade-off.
