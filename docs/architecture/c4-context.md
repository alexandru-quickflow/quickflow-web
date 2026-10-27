# System Context: quickflow-web

Level 1 of the C4 model. Who uses the site and what it talks to.

```mermaid
C4Context
  title System Context diagram for quickflow-web

  Person(visitor, "Prospective client", "Founder or small company looking for a developer")
  Person(owner, "Alexandru", "Owns the site, edits content, receives enquiries")

  System(site, "quickflow-web", "Bilingual portfolio and services site for Quick Flow")

  System_Ext(resend, "Resend", "Transactional email delivery")
  System_Ext(turnstile, "Cloudflare Turnstile", "Bot verification")
  System_Ext(calendly, "Calendly", "Call booking")
  System_Ext(analytics, "Cloudflare Web Analytics", "Cookieless traffic measurement")
  System_Ext(inbox, "Email inbox", "alexandru@quickflow.dev")

  Rel(visitor, site, "Reads pages, submits the contact form")
  Rel(visitor, calendly, "Books a 20 minute call")
  Rel(owner, site, "Publishes content", "git push")

  Rel(site, turnstile, "Verifies the submitter is human", "JSON/HTTPS")
  Rel(site, resend, "Sends the enquiry and a copy to the sender", "JSON/HTTPS")
  Rel(site, analytics, "Reports page views", "beacon/HTTPS")
  Rel(resend, inbox, "Delivers the enquiry", "SMTP")
  Rel(owner, inbox, "Reads enquiries")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## Notes

The site has no users in the authentication sense. Nobody signs in, and the spec
rules out any logged-in area.

Calendly sits outside the system boundary on purpose. The site only links to it,
it does not call its API, so a Calendly outage degrades the contact page without
breaking it. The spec, flow 3.2, requires the email address to be visible as
text next to that link for exactly this reason.

The email inbox is drawn as an external system because it is where an enquiry
actually lands. Treating it as part of the site hides the fact that a delivery
failure after Resend accepts the message is invisible to us (see ADR-0004).
