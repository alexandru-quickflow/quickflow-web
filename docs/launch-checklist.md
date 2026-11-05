# Launch checklist

This is the runbook ADR-0003 asks for. Three places in the repository point at
it and none of them could, until now:

- `functions/api/contact.ts`, for the rate limiting rule.
- `docs/adr/0003-rate-limiting-at-the-edge.md`: "It has to be written down in
  the runbook and checked at launch."
- `astro.config.mjs`, for the measured cost of leaving CSS unminified.

It is in the repository rather than in the project folder on purpose. The one
control that protects the contact form lives in a dashboard, outside version
control, and it was never created. A runbook that lives outside version control
is how that happens twice.

Last worked through: 30 October 2026, during the pre-launch audit.

---

## 1. What only exists in a dashboard

This list is the dangerous one. Everything here is invisible to anyone reading
the code, is not restored by redeploying, and does not come back if the
Cloudflare Pages project is recreated. Nothing may be added to it quietly.

### 1.1 The rate limiting rule on the contact endpoint

**Status on 30 October 2026: created, not at the rate this document asked for,
and confirmed working against the live domain.** The rate below is what the
account's plan actually permits, and the difference is worth understanding before
anyone "fixes" it.

Six posts fired back to back at `quickflow.dev/api/contact`:

```
1 -> 400  the function's own answer
2 -> 400  the function's own answer
3 -> 429  error code: 1015
4 -> 429  error code: 1015
5 -> 429  error code: 1015
6 -> 429  error code: 1015
```

`1015` is Cloudflare's own rate limiting code, so the block comes from the edge
and the function is never reached. That is what this rule was for. The posts
carried a deliberately invalid Turnstile token, so the test cost no email.

One consequence, named rather than fixed: the third request gets Cloudflare's
bare page, not the site's. A visitor whose first submission fails and who
immediately tries twice more lands on it. Ten seconds is short and the form is
not something people submit in bursts, so this is accepted for now. If it ever
shows up in a real complaint, the fix is a counter in the function rather than a
longer window, which the plan refuses anyway.

| Setting | Value |
|---|---|
| Path | `/api/contact` |
| Method | `POST` |
| Characteristic | IP address, per colo |
| Rate | 2 requests per 10 seconds |
| Block duration | 10 seconds |
| Action | Block |

**Why not five per hour, as planned.** The API refuses any period other than 10
seconds on this plan: *"not entitled to use the period 3600, can only use a
period among [10]"*. Longer windows and longer block durations are a paid
feature. So the rule stops someone hammering the endpoint, but it does not cap
the number of submissions in an hour, which is what five-per-hour was for.

What that leaves: a determined sender can still post roughly twelve times a
minute from one address. Turnstile is what makes that expensive, not this rule.
If the volume ever becomes a real problem, the options are a paid plan, or a
counter in the function itself backed by KV. Neither is worth doing before
there is traffic to measure.

Why it matters, in one line: the endpoint emails a copy of the submission to
whatever address was typed into the form, so without a cap it is a mail relay
with a public address.

Since the audit, the visitor's copy is sent only when Turnstile verified a
human, so the rule is a cap on volume rather than the only thing standing
between the endpoint and a stranger's inbox. Both are needed. Neither replaces
the other.

**The sentence above about Turnstile making volume expensive was false until 1
November 2026.** The handler ran the check only when a token was present, so a
post that simply left the field out skipped it and the mail went: measured on
the live endpoint, no token, HTTP 200, a real email delivered. Omitting a field
is what a script does and a browser never does, which made it the one request
shape that was never checked. The guard now branches on the secret rather than
on the token, a missing token is refused exactly like a bad one, and twelve
posts a minute is again a thing only a person in a browser can do.

### 1.2 Environment variables in the Cloudflare Pages project

**Status on 30 October 2026: the three required ones are set on Production and
verified through the API, which lists a secret by name and type and never by
value. Preview is deliberately empty.**

Variables apply at build time, so a deployment built before they existed cannot
see them however correct the project looks. The deployment serving the site had
`env_vars: []` while the project already listed all three. Check the deployment,
not the project.

| Name | Required | What goes missing without it |
|---|---|---|
| `RESEND_API_KEY` | yes | the form refuses to send and says so, in both languages |
| `PUBLIC_TURNSTILE_SITE_KEY` | yes | no widget renders, so no token is ever sent |
| `TURNSTILE_SECRET_KEY` | yes | nothing is verified, so no visitor ever gets their copy |
| `PUBLIC_CF_BEACON_TOKEN` | no, and deliberately unset | nothing. See section 4 |

**The two Turnstile keys are a pair.** Setting one without the other is the
worst of the three states: the widget renders, the visitor solves it, and the
function cannot check it, so every submission is treated as unverified and no
copy is ever sent. There is no error anywhere; it just quietly stops.

`.env.example` documents all four and is the file to copy to `.dev.vars` for
local work.

### 1.3 Resend

**The verified domain is `send.quickflow.dev`, not the apex.** Resend's current
setup puts three records under that subdomain: a DKIM TXT at
`resend._domainkey.send.quickflow.dev`, and two CNAMEs, `send` and `rsend`,
pointing at `forge.rmta.net`. Nothing is added at the apex, which matters more
than it looks: the apex already carries one SPF record for Google Workspace, and
a second SPF record on the same name invalidates both and breaks ordinary mail.

The `From` address in the function is `noreply@send.quickflow.dev` and has to
stay on the verified domain. Sending from the apex is refused with 403, which the
function turns into the same answer it gives when the key is missing. A correct key
then looks exactly like a missing one, which is how an afternoon goes.

`_dmarc.quickflow.dev` carries `v=DMARC1; p=none; rua=mailto:alexandru@quickflow.dev`,
added 30 October 2026 and confirmed through Google Public DNS as well as through
the Cloudflare API. Monitoring only: it enforces nothing, so it cannot bounce
legitimate mail, and it covers `send.quickflow.dev` through the organisational
policy. The aggregate reports arrive as daily XML attachments from the larger
receivers; dropping the `rua` part stops them and leaves the record valid.

### 1.4 Web Analytics in the Pages project

Two switches, almost the same name, and only one of them is the one the site
controls.

| Where | What it does |
|---|---|
| `PUBLIC_CF_BEACON_TOKEN` | the site adds the beacon itself, and both privacy pages rewrite themselves to match |
| Pages project, Settings, Web Analytics | Cloudflare injects the beacon into every response, whatever the site says |

**The second one was on for about an hour on 30 October 2026.** It injected
`static.cloudflareinsights.com/beacon.min.js` into every page, on the custom
domain and on `pages.dev` alike, while both privacy pages went on saying the site
has no analytics script at all. It is off now and the pages are true again.

Two things made it hard to see, and both are worth remembering:

- `curl` never showed it. The injection only applies to requests that look like a
  browser, so every check made with `curl` came back clean while a real browser
  loaded the beacon on the same URL.
- Clearing the setting was not enough. The running deployment kept injecting
  until a new one replaced it, confirmed with a `cache: 'no-store'` fetch that
  returned `cf-cache-status: DYNAMIC` and the beacon still in the HTML.

So the check is: a real browser, on the real domain, after a new deployment.

### 1.5 The `robots.txt` the site serves is not the one in this repository

Found 31 October 2026, while working out why Search Console had not read the
sitemap. It was not the cause, and it is worth more than the thing it was not
the cause of.

`public/robots.txt` is 7 lines. The file served at `quickflow.dev/robots.txt`
is 137. Cloudflare prepends its own managed block, and the repository's file
follows it unchanged at the bottom. Nothing in this repository says so, and a
redeploy does not restore it.

What the managed block adds:

- `Content-Signal: search=yes,ai-train=no,use=reference`, a reservation of
  rights with the EU copyright directive named in the preamble above it.
- 31 `Disallow: /` groups, one per crawler.
- A second `User-agent: *` group, so the served file now has two. Google merges
  groups that match the same agent and both say `Allow: /`, so this is harmless
  today. It would not be if the two ever disagreed.

**The distinction that matters, because it is the whole trade.** The blocked
list is training and bulk scraping: GPTBot, ClaudeBot, Google-Extended, CCBot,
Bytespider, anthropic-ai, and so on. The crawlers that fetch a page to answer a
question somebody is asking right now are not blocked, and were checked by name
on 31 October: OAI-SearchBot, ChatGPT-User, Claude-User, Claude-SearchBot,
PerplexityBot. Googlebot and Bingbot are not blocked either.

So the site can be read and cited when a reader asks an assistant something it
answers, and cannot be swept into a training set. For a site whose job is to be
found, that is the right way round, and it is the configuration as it stands
rather than anything that was chosen here deliberately.

Two things on the list are search crawlers rather than training ones,
`Baiduspider` and `PetalBot`. They are Chinese and Huawei search, neither of
which is a market this site is written for, so they stay blocked by default
rather than by decision. Worth knowing before anybody calls it a mistake.

| Where | Cloudflare dashboard, AI Crawl Control |
|---|---|
| Setting | managed `robots.txt` on, `ai-train` disallowed |
| In the API | `GET /zones/{zone}/bot_management`, `is_robots_txt_managed` |

**If someone edits `public/robots.txt` expecting it to be the whole file, they
are editing the last 7 lines of 137.** That is the trap this section exists for.
The file's own comment says "Everything here is meant to be read, including by
machines", which stopped being the whole truth the moment the managed block
appeared above it.

### 1.6 The two uptime monitors

Created 31 October 2026. UptimeRobot, free plan, five-minute interval. They
exist in that account and nowhere else: not in this repository, not restored by
a redeploy, and not visible to anyone reading the code.

| Monitor | URL | Keyword | Incident when |
|---|---|---|---|
| `quickflow.dev` | `/` | `Quick Flow` | keyword does not exist |
| `quickflow.dev formular` | `/contact/` | `data-sitekey` | keyword does not exist |

**Keyword monitors rather than a status check, on purpose.** A 200 is not proof
the page rendered; Cloudflare can answer with its own page and the site can
deploy broken while still returning 200. `Quick Flow` is the brand name, which
appears five times on the home page and survives a copy rewrite, unlike a
headline or a title.

The second one is the one worth having. `data-sitekey` is in the HTML only when
the deployment was built with the Turnstile variables present, which is exactly
the state section 1.2 describes: the form renders without a widget, nobody gets
their copy, and nothing anywhere says so. Section 6's monthly send catches that
in up to a month and the weekly workflow in up to a week. This catches it in
five minutes.

**The alerting was tested end to end, not assumed.** On 31 October the second
monitor was pointed at `/terms/`, a real page that genuinely has no
`data-sitekey`, and left there. It went down in 7 seconds, was confirmed
independently from four locations, and the email was sent 48 seconds after the
first detection. Then it was pointed back. The incident is still in the history,
dated, which is the evidence that alerting worked on the day it was set up.

Two limits, named rather than discovered:

- **Every check location is in North America.** N. Virginia, Ohio, Ashburn,
  Dallas. Visitors reach this site through Cloudflare's Bucharest PoP, which is
  what `CF-RAY: ...-OTP` reports. A total outage is visible from anywhere, but a
  regional fault in Europe would leave both monitors green while nobody in
  Romania could load the site. Adding a location is a paid feature.
- **SSL expiry monitoring is also paid, and is not on.** The certificate is
  issued and renewed by Cloudflare. If a renewal ever failed, the `curl -fsS` in
  `.github/workflows/liveness.yml` fails on an invalid certificate, so it would
  surface there within a week rather than within five minutes.

### 1.7 The page view counter's dataset binding

`functions/_middleware.ts` counts page views into Workers Analytics Engine
(ADR-0006). The binding is set in the Pages project, not in this repository,
because the project has no Wrangler file.

| Where | Value |
|---|---|
| Pages project, Settings, Bindings, Analytics engine | variable `PAGEVIEWS`, dataset `quickflow_pageviews`, production |
| Pages project, Settings, Runtime, Fail open / closed | **Fail open** |

Without the binding the counter writes nothing and the site works as before,
which also means nothing complains when it goes missing. After a deployment,
open a page in a real browser and check that a row arrives:

```sql
SELECT timestamp, blob1 AS path, blob2 AS source, blob3 AS country,
       blob4 AS device, blob5 AS kind
FROM quickflow_pageviews
WHERE timestamp > NOW() - INTERVAL '1' HOUR
ORDER BY timestamp DESC
```

Fail open matters because the Functions allowance, 100,000 requests a day, is
shared by every project on the account. Fail closed would turn a busy day into
an error page on every URL. `public/_routes.json` keeps images, fonts and CSS
away from the Function so only page requests spend it.

---

## 2. Before every deploy

```bash
cd /d/dev/quickflow-web && npm test
npm run build
npx astro preview --host 0.0.0.0 --port 4322   # stop it with: npx astro preview stop
```

`npm test` is two npm scripts and takes about five seconds. `test:handler` is
`node --test` over every `.test.mjs` in `tests/`, which is two files: the
contact function, called directly because nothing serves Pages Functions
locally, and the routing table's trailing-slash invariant. `test:form` drives
both contact pages in a browser against the built site. If
the second one starts its own preview server it builds first; if one is already
running on 4322 it uses that, so run it before the scripts below rather than in
the middle of them.

`npm test`, `probe.mjs` and `responsive.mjs` also run on every push, in
`.github/workflows/checks.yml`. The three generators below do not, because
their output is binary and depends on the versions of brotli, freetype and the
AVIF encoder on the machine that ran them. That workflow does not gate the
deploy: Pages builds from the same push, in parallel, so a red run tells you
within two minutes that a bad deploy happened rather than preventing it. Making
it a gate means pull requests, or deploying from the workflow instead of from
the git integration.

`.github/workflows/liveness.yml` is the other one, and it runs weekly against
the live domain rather than against a build. Section 6 is what it is for.

Then the three scripts, in this order. What each one should say:

### `python -I scripts/fonts.py`

The last line has to read **"every character in the build has a glyph in every
face"**. The number that matters is the subset size, 178, not the number of
characters in the build, which moves with the copy.

If the subset did not change, `git checkout -- public/fonts/`. The binaries only
belong in a commit when the subset itself moved.

### `node scripts/probe.mjs`

**If the first line is not `self-test`, stop.** Nothing the probe prints after
that is worth reading. The line reports that the three planted defects were all
caught; the figure in brackets is the number of contrast failures on the planted
page, which is 1.

Good: `29 pages, 14 of 14 language pairs matching` and `No contrast failures, no
overflow, both languages level`.

### `node scripts/responsive.mjs`

29 pages across 12 widths, 348 measurements. The three actionable categories all
have to be **0**: past the viewport edge, out past its parent, tap target under
24px.

The middle one compared widths until 30 October and so could not see the shape
of the defect that mattered most: a child narrower than its parent, laid out
beyond the parent's edge anyway. Five twelve-column grids whose eleven 64px
gaps needed 704px inside a 688px plate had collapsed every track to zero and
were putting the right-hand column off the side of the screen at 768 and 834,
on eight pages, in both languages. It compares edges now.

Two categories are not zero and are not defects: around 45 boxes of "text with
no room", all two-character labels that have exactly the room they need, and
around 530 pieces of text under 11.5px, which are `.spec` and `.stamp`, the
label vocabulary. Do not fix them.

### `python -I scripts/images.py`

Redraws every raster the site serves as AVIF and WebP beside its original, and
writes what each one measures to `src/content/images.json`, which is where
`Shot.astro` reads the width and height from. Run it after adding or replacing
any picture under `public/`, and commit what it writes: a picture with no AVIF
beside it still loads, from the original, but a picture missing from the
manifest fails the build on purpose rather than guessing a size.

It leaves `public/og` alone. Those are fetched by whatever renders a link
preview, which asks for the PNG it was pointed at.

### `python -I scripts/og.py`

Redraws the 29 share images from the headlines in `dist/`. If `git status` shows
no change under `public/og/`, no headline has drifted away from its share image.
If it does show changes, a headline moved and the new images belong in the
commit. Run `npm run build` again afterwards so `public/og` is copied into
`dist`.

---

## 3. What no script can see

Each of these has already cost something.

`npm test` now covers the wiring of the form, which used to be on this list:
what it posts, what it does with every answer including the one where sending
fails, and who receives email in each case. What is left here is everything
that needs a real inbox, a real key, or a person looking.

- **Read two or three pages on a phone, not in a probe.** Three of the five
  known blind spots were found this way and one of them cannot be found any
  other way. The audit found a fourth: a word welded to the link after it, on
  fourteen pages.
- **Send the form in both languages, with JavaScript on.** Check the owner's
  copy arrives, the visitor's copy arrives, and the thank-you page is in the
  language the form was in.
- **Send the form once with JavaScript off.** The owner's copy must arrive. The
  visitor's copy must not: that is the fix, not a fault.
- **Submit with the required fields empty, with JavaScript on and off.** With
  JavaScript, the errors appear next to the fields and focus moves to the first
  one. Without, the plain error page appears with the text preserved.
- **Open a `select` on the contact page** and check the option list is dark.
  It is a system window, not part of the DOM, so nothing here can measure it.

---

## 4. Decisions that have a number attached

These are settled. They are here so nobody has to rediscover the number.

### Analytics stays off

Decided 30 October 2026, measured, not assumed.

| | On the wire |
|---|---|
| The whole site's JavaScript | 5,612 bytes gzipped |
| `beacon.min.js` | 10,264 bytes gzipped |

The beacon is almost twice the site's own JavaScript. The home page carries a
stamp that reads "This page ships 6 KB of JavaScript", the migration pages put
"6 KB" next to Bubble's "1,371 KB", and the snippet the site hands readers
counts `encodedBodySize`, which counts the beacon. Turning it on makes a reader
who does exactly what the site asks get roughly 16 and read 6.

Traffic is read from the Cloudflare dashboard instead. That is the host already
named on both privacy pages, and it adds no script, no cookie and no third
party.

Leaving `PUBLIC_CF_BEACON_TOKEN` unset is only half of this. The Pages project
has its own Web Analytics switch that ignores the variable entirely. Read section
1.4 before believing the site ships no third-party script.

**If this ever reverses**, three things change together: the stamp on both home
pages, `SELF_JS` in `src/content/proof.ts`, and the comparison row on both
migration pages. Both privacy pages change themselves; they read the same
variable.

**Counting moved to the server on 5 November 2026** (ADR-0006). The beacon
stays off and every number above stays true: the counter is a Pages Function
that runs after the page is served and puts nothing in it. What the dashboard
could not say, which visits are people and where they came from, the counter
now records. Section 1.7 has the binding it depends on.

### The mail service being down answers 422, not 502

Decided 30 October 2026.

502 describes the situation honestly and was useless. On the proxied domain
Cloudflare replaces a 5xx from a Pages Function with its own bare error page, so
the visitor got `error code: 502` instead of the function's own message telling
them to write to the address directly. Exactly the moment that message matters
most is the moment it disappeared. On `pages.dev` it was fine, which is why this
survived every check until the site ran on its own domain.

422 passes through, and is close enough to true: the submission was understood
and valid, the mail service could not take it. It stays a failure, so anything
watching status codes still sees one. 200 with an error body was rejected for
that reason alone.

Measured rather than assumed, in two directions. The handler test asserts 422
when the key is absent. And a 4xx from this function does reach the visitor on
the apex: a submission with a deliberately invalid Turnstile token returns the
function's own 400 and its own message on `quickflow.dev`, byte for byte the same
as on `pages.dev`. The 422 path itself cannot be exercised against production
without taking the live key away, so that half rests on the 400.

The status lives in one place, `MAIL_UNAVAILABLE` in `functions/api/contact.ts`,
with the reasoning next to it.

### The ANPC mark is SAL only, never SOL

Decided 30 October 2026, after checking rather than copying what other Romanian
sites carry.

The European ODR platform was switched off on 20 July 2025 and Regulation
524/2013 repealed with it. `ec.europa.eu/consumers/odr` now serves a relocation
notice. Ordinul ANPC 449/2022 was amended by 270/2026 for exactly that reason,
and asks for the SAL pictogram alone.

So: if anyone ever offers to "add the missing SOL icon", the answer is no. It
would be a link to nothing, on the one part of the site whose whole job is to
point a complaint somewhere real.

The file in `public/anpc/sal.png` is the one ANPC publishes, 201x50 and 4,520
bytes, sha256 `22c8a456...`. It is served unretouched and `scripts/images.py`
skips the folder, so no AVIF or WebP of it is ever generated. Re-encoding
somebody else's legal mark is not ours to do.

Both doubts this section used to record are closed, checked against the
consolidated text on legislatie.just.ro on 1 November 2026.

Art 2(2) as amended asks for 250x50 and the file ANPC serves is 201x50, so the
link is a 250x50 box and the mark sits inside it unscaled. Stretching somebody
else's trademark by 49 pixels to satisfy a rule about the space it occupies is
the wrong way round.

The menu bar was never in art 2(1). That alineat says only `pe prima pagină a
site-ului - home page`, which names the page and not the part of it, and it
said the same in the 2022 original. The menu bar lived in art 2(2), and art
2(2) is precisely what Ordinul 270/2026 rewrote on 19 May 2026: what is left of
it is the size and the link. The footer of every page includes the home page,
so the placement is already right.

### CSS minification stays off

Lightning CSS folds `animation` and `animation-timeline` into a shorthand no
browser accepts, which kills every scroll-driven animation on the site with no
error anywhere. It has happened, and it lasted days.

The measured cost of leaving it off: the stylesheet is 51,788 bytes raw and
9,821 gzipped. With comments and whitespace stripped it would be 39,225 raw and
8,969 gzipped. **852 bytes on the wire.** Under a kilobyte, against every
animation on the site. The decision is not close.

### The years are computed, not typed

`src/content/experience.ts` holds the one copy of 2014, 2017 and 2025, and the
elapsed count is derived from the current year at build time. The site said
"eight years" for a while after it had been nine. It can still go stale, but
only if a whole year passes with no deploy.

### Every path in the routing table ends with a slash

Decided 31 October 2026, after measuring it against the live domain rather than
against the dev server, which is where this kind of thing hides.

The build emits a directory per page, so the server answers `/contact` with a
308 to `/contact/`. `src/i18n/routes.ts` held the slugs without the slash, and
that table is where every internal link, every language switcher target and
every hreflang in the site comes from. Three things were true at once, and none
of them was visible from reading a page:

- Every internal link paid a redirect before the page began loading. The header
  navigation, the footer index, every call to action.
- Every hreflang pointed at a URL that redirects. Google asks that hreflang name
  the canonical URL, and a redirecting target is a known reason for a language
  cluster not to form. The Romanian and Russian pages are the whole point of
  having the annotations, so this was the one place it could cost something real.
- The canonical tag disagreed with the hreflang on the same page. Canonical is
  computed from the request path, which carries the slash; hreflang came from the
  table, which did not.

The third one is why it lasted. The two were generated from different sources,
so nothing in the repository compared them, and `probe.mjs` checks that the two
language versions of a page match each other rather than that either one names
itself correctly.

The same bug had a second half in `functions/api/contact.ts`, which keeps its
own copy of the two confirmation paths on purpose. A no-JavaScript submission
got a 303 to `/thank-you`, which then answered 308 to `/thank-you/`. Two
redirects at the one moment on this site that converts.

**What the table looks like now:** 32 entries, all ending with a slash. Two of
them, `/` and `/ro/`, already did, which is why the home page looked fine while
every page under it did not.

`tests/routes.test.mjs` is what keeps this true, and it is the reason there is a
test rather than a note. It asserts the slash on every entry, that
`alternates()` never offers a redirecting href, and that the set of languages
the table declares for a page is exactly the set the switcher offers. It was
checked in the direction that matters: with one slash removed from one entry it
fails and names the key.

**Where to look if you are reading history.** The change landed inside two
commits whose messages are about something else, `8cd636f "Add the Connect KYC
page"` and `7628822 "Break field names at the underscore"`, because two
sessions were writing to the same checkout that afternoon and the slashes were
swept up by whichever committed next. `git log` will not explain the slashes to
anyone. This section is the only record, which is the argument for this file.

---

## 5. After the first deploy

**Worked through on 30 October 2026. Nothing is open.**

- The site key is in the HTML on both contact pages, and a real submission in
  each language produced a token and went through, so the widget renders and
  verifies on both.
- Both submissions delivered both emails, the owner's copy and the sender's copy.
- Zero third-party requests on the home page, measured in a browser rather than
  with `curl`. Section 1.4 is why that distinction is the whole point.
- `robots.txt` and `sitemap-index.xml` both answer 200, and neither thank-you
  page appears in the sitemap.
- A submission carrying a deliberately invalid Turnstile token gets the
  function's own 400 and its own message on the apex, identical to `pages.dev`.
  That is the evidence behind the 422 in section 4.

- The rate limiting rule blocks at the edge, with `error code: 1015`, from the
  third post in ten seconds. Measured on the live domain. Section 1.1 has it.

Section 6 is what keeps this true. A contact form that stops working is silent,
and the only thing standing between that and a lost enquiry is the monthly send.

---

## 6. Once a month, after launch

One item, and ADR-0004 is the reason for it. There is still no error
monitoring on this site, which is the right call at this size. Until 31
October 2026 that had one consequence, stated here as a flat fact: a failing
contact form was silent.

Two things now watch part of it, and neither replaces this one.

- The second uptime monitor in section 1.6 checks every five minutes that the
  contact page still carries a Turnstile site key, which is the state section
  1.2 describes and the one that silently stops every visitor copy.
- `.github/workflows/liveness.yml` checks weekly that the endpoint answers
  with its own 400 rather than Cloudflare's page, which also proves the
  Turnstile secret is set, since the branch is skipped without it.

Both of those cover the wiring. **What neither can reach is the Resend key.**
Sending for real needs a Turnstile token, and only a person in a browser
produces one, so no automated check can prove mail still leaves the building.
If that key expires, nothing anywhere says so until a visitor complains or the
owner tests it. That half is still silent, and this is what listens to it.

So, once a month: send the form, in either language, and confirm both emails
arrive. ADR-0004 calls this mitigation weak and accepts it knowingly. It is only
weak if it is actually done.

Revisit the whole arrangement when the blog goes live with dynamic routes, or
when the form starts feeding anything beyond an inbox.
