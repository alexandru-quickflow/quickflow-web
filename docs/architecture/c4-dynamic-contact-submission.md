# Dynamic Diagram: contact form submission

The only request flow in the system with more than one step. Covers the happy
path and names where each failure from the spec, section 3.1, is handled.

```mermaid
C4Dynamic
  title Dynamic diagram for a contact form submission

  Person(visitor, "Prospective client")
  Container(pages, "Static site", "Astro 7", "Contact page")
  Container(fn, "Contact function", "Pages Function", "Validates and forwards")
  System_Ext(edge, "Cloudflare edge", "Rate limiting rule")
  System_Ext(turnstile, "Turnstile", "Bot verification")
  System_Ext(resend, "Resend", "Email delivery")

  Rel(visitor, pages, "1. Fills in name, email, what they want built, rough budget")
  Rel(pages, fn, "2. POSTs the form with the Turnstile token", "HTTPS")
  Rel(edge, fn, "3. Allows the request if under 5 per hour per IP")
  Rel(fn, turnstile, "4. Verifies the token", "JSON/HTTPS")
  Rel(fn, resend, "5. Sends the enquiry to alexandru@quickflow.dev")
  Rel(fn, resend, "6. Sends one copy to the address given")
  Rel(fn, visitor, "7. Returns a confirmation, or an error with the typed text preserved")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## Failure handling

| Failure | Where it is handled | What the visitor sees |
|---|---|---|
| Required field empty | Step 2, in the browser, and again in the function | An error next to each field, with the typed text kept |
| Turnstile token missing or invalid | Step 4 | A generic failure with the email address offered as an alternative |
| More than 5 submissions per hour from one IP | Step 3, at the edge, before the function runs | A Cloudflare block page |
| Someone else's address typed in, to relay mail | Step 6, exactly one copy per submission, plus the rate limit at step 3 | Normal confirmation. The abuse is bounded, not detected |
| Resend unavailable | Step 5 | A message saying it could not be sent, the typed text kept, and the email address as a fallback. The function does not pretend to have received it |

The last row is a correction made during the spec review. The first draft said
the submission would be stored and sent later, which contradicted section 5 of
the same document: nothing is stored.

## Progressive enhancement

Without JavaScript, step 2 is a plain form POST and step 7 is a full page
response. With JavaScript, the same endpoint is called with fetch and step 7
updates the page in place. The endpoint behaves identically either way, which is
why there is only one flow to draw (ADR-0001).
