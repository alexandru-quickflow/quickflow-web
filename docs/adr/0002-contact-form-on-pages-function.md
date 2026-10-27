# ADR-0002: Contact form on a Cloudflare Pages Function

**Status**: Accepted
**Date**: 2026-10-27
**Deciders**: Alexandru Trofaniuc

## Context

The contact form is the only server-side behaviour on the site. It has to
validate input, send the submission to alexandru@quickflow.dev, send a copy to
the sender, and handle the failure cases listed in the spec, section 3.1:
missing fields, a dead email provider, and the form being abused to relay mail
to third parties.

The site is statically hosted on Cloudflare Pages. ADR-0001 rules out a server
runtime for the pages themselves.

## Decision Drivers

- No recurring cost for 20 lines of code
- The owner keeps the submission path under his own account
- Must work with a static site

## Considered Options

### Option 1: Cloudflare Pages Function plus Resend

- **Pros**: lives in the same repository and on the same host as the site, free
  at this volume, no third party holds the submissions, secrets stay in the
  Pages project environment.
- **Cons**: the failure cases have to be written and tested by hand. Resend
  needs SPF, DKIM and DMARC records in DNS before the domain can send.

### Option 2: Netlify Forms or Formspree

- **Pros**: no code at all, spam filtering included, a dashboard of submissions.
- **Cons**: a monthly cost and a third-party dependency for the single most
  important interaction on the site. Submissions live in someone else's account.
  On Netlify Forms it would also mean hosting the site on Netlify, against the
  rest of the stack.

### Option 3: A mailto link instead of a form

- **Pros**: nothing to build or maintain.
- **Cons**: opens a mail client the visitor may not have configured, collects
  none of the qualifying fields the spec asks for (what they want built, rough
  budget), and loses every visitor who will not compose an email.

## Decision

A Cloudflare Pages Function at `functions/api/contact.ts`, sending through
Resend.

## Consequences

**Good**: no recurring cost, no third party in the path, secrets in the Pages
environment and nowhere else. The function is small enough to read in one
sitting.

**Bad**: the error paths are our responsibility, including what the visitor sees
when Resend is down. Domain verification in DNS has to be done before the form
can be tested end to end, which makes it a scheduling dependency for M4.

**Revisit when**: submissions need to be stored, searched or routed to more than
one place. At that point the function stays and gains a D1 table or a webhook,
rather than being replaced.
