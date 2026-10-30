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

**Status on 30 October 2026: created, but not at the rate this document asked
for.** The rate below is what the account's plan actually permits, and the
difference is worth understanding before anyone "fixes" it.

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

### 1.2 Environment variables in the Cloudflare Pages project

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

The sending domain has to be verified before anything leaves, which means SPF,
DKIM and DMARC records for `quickflow.dev` in Cloudflare DNS. The `From` address
in the function is `noreply@quickflow.dev`.

---

## 2. Before every deploy

```bash
cd /d/dev/quickflow-web && npm test
npm run build
npx astro preview --host 0.0.0.0 --port 4322   # stop it with: npx astro preview stop
```

`npm test` is two suites and takes about five seconds. `test:handler` calls the
contact function directly, since nothing serves Pages Functions locally, and
`test:form` drives both contact pages in a browser against the built site. If
the second one starts its own preview server it builds first; if one is already
running on 4322 it uses that, so run it before the scripts below rather than in
the middle of them.

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

**If this ever reverses**, three things change together: the stamp on both home
pages, `SELF_JS` in `src/content/proof.ts`, and the comparison row on both
migration pages. Both privacy pages change themselves; they read the same
variable.

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

---

## 5. After the first deploy

- Request the live pages once and confirm the Turnstile widget renders on both
  contact pages. It is absent from any build made without the site key, which
  is how the audited build looked.
- Send one real submission in each language and confirm both emails arrive.
- POST to `/api/contact` six times in an hour from one address and confirm the
  sixth is blocked at the edge, not by the function. That is the only way to
  know the rule in section 1.1 is actually on.
- Check `robots.txt` and `sitemap-index.xml` are served, and that the two
  thank-you pages are not in the sitemap.

---

## 6. Once a month, after launch

One item, and ADR-0004 is the reason for it. There is no error monitoring on
this site, which is the right call at this size and has one consequence: **a
failing contact form is silent.** If the Resend key expires, nothing anywhere
says so until a visitor complains or the owner tests it.

So, once a month: send the form, in either language, and confirm both emails
arrive. ADR-0004 calls this mitigation weak and accepts it knowingly. It is only
weak if it is actually done.

Revisit the whole arrangement when the blog goes live with dynamic routes, or
when the form starts feeding anything beyond an inbox.
