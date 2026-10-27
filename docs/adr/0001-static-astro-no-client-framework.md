# ADR-0001: Static Astro with no client framework

**Status**: Accepted
**Date**: 2026-10-27
**Deciders**: Alexandru Trofaniuc

## Context

The site is six pages of text in two languages. The approved spec
(`docs/spec.md`, section 1) sets LCP under 1 second on mobile as a success
criterion, measured with Lighthouse on the production URL.

Exactly one part of the site is dynamic: the contact form. The spec rules out an
admin panel, a database and any logged-in area.

The default stack for an app in this shop is Astro with React islands. That
default was not applied here, which is why this record exists.

## Decision

Astro 7 with static output. No React, Vue, Svelte or any client framework, and
no Astro islands. The contact form is a plain `<form>` that POSTs, with
JavaScript added only as an enhancement.

## Consequences

**Good**: the site ships close to zero JavaScript, which makes the LCP target a
property of the architecture rather than something to optimise for later. Builds
take under a second. The form keeps working with JavaScript disabled or broken.

**Bad**: any future feature that genuinely needs client state has nowhere to go
without adding an island and revisiting this. Form validation messages have to
be written by hand instead of coming from a library.

**Revisit when**: a feature needs client-side state that survives interaction,
for example a portfolio filter with more than a handful of items, or a pricing
configurator. Adding a single island is a smaller change than migrating the
site, so this decision does not have to be reversed wholesale.
