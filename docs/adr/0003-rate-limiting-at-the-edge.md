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

## Addendum, 30 October 2026

The decision stands: the cap belongs at the edge, not in the function. The
number in it does not survive contact with the plan.

Cloudflare refuses any rate limiting period other than ten seconds on this
account: *"not entitled to use the period 3600, can only use a period among
[10]"*. Five per hour was never available. What exists is two posts per ten
seconds per IP, which is the closest shape the plan allows, and it defends
against hammering rather than against volume.

This is not a new decision, so it is not a new ADR. It is the same decision
meeting a constraint nobody checked for when it was written, which is worth
recording where the next person will look. The operational detail is in
`docs/launch-checklist.md`, section 1.1.
