// Checkable facts, in both languages.
//
// The inventory of this site says the same thing on every page: almost nothing
// here is an opinion. It is a number the reader can reproduce, a rule with a
// source, a phase with a state, a word to avoid and the word to write instead.
// That is the only asset this studio has in quantity, so it is the one the
// design is built around.
//
// Every entry carries where it came from and when it was last re-checked. The
// date is not decoration: it is re-verified at the source before each release,
// and if it cannot be re-verified the claim comes off the site.

import type { Locale } from '../i18n/routes';

export interface Proof {
	id: string;
	/** The claim, short enough to set large. */
	claim: string;
	/** The number itself, with its unit, or null when the proof is a rule. */
	value?: string;
	unit?: string;
	/** How the reader checks it without trusting me. */
	howToCheck: string;
	source: { label: string; href: string };
	verifiedOn: string;
}

export const VERIFIED_ON: Record<Locale, string> = {
	en: '27 October 2026',
	ro: '27 octombrie 2026',
	ru: '27 октября 2026',
};

/** What this page itself ships, measured the way the snippet below measures it,
 *  because the reader is told to run that snippet and the two have to agree.
 *
 *  The build emits one file: 19,170 bytes, 5,612 gzipped, 4,994 brotli. Over
 *  1024 and rounded, which is what the snippet does, both come to 5.
 *
 *  It said 6 until 30 October, from adding up 422 bytes of our own script and
 *  5,383 for the inertial scroller, gzipped, which is 5,805 and rounds up. But
 *  those are two files weighed apart and the build bundles them into one,
 *  which compresses a little better than the two of them do separately. So the
 *  number here was arrived at honestly and was still one kilobyte above what
 *  anybody doing what this page asks would see. On a page that hands out the
 *  check, that gap costs more than rounding up protects.
 *
 *  It said 0 KB until 2026-10-28, which was true until the scroller arrived
 *  and false for one build afterwards.
 *
 *  Re-measure before every release, from dist, not from the parts. The
 *  Cloudflare Web Analytics beacon would add 10,264 bytes on the wire, which
 *  is why it stays off: see docs/launch-checklist.md. */
export const SELF_JS = '5 KB';

/** The rate limiting rule on the contact endpoint, which lives in a Cloudflare
 *  dashboard and not in this repository. It is here so that the two privacy
 *  pages describe the same rule as each other and as the thing that is actually
 *  running.
 *
 *  They did not. Both pages said five an hour until 30 October 2026, which was
 *  the planned rate and never the real one: the plan refuses any period other
 *  than ten seconds. Measured against the live domain on 30 October, the third
 *  post in ten seconds is blocked at the edge with Cloudflare's 1015.
 *
 *  If the rule is ever changed, change it here in the same sitting.
 *  docs/launch-checklist.md section 1.1 is the record. */
export const RATE_LIMIT = { posts: 2, seconds: 10 } as const;

/** Pasted into the reader's own console, on their own app. The one thing on
 *  the site that needs no translation.
 *
 *  Every line is under 32 characters, and that number is the measurement, not
 *  a preference. The block renders at 12px in JetBrains Mono, which is 7.27px
 *  a character, and on a 320px phone it has 243px of room inside its padding:
 *  33 characters. The comment here used to say "under 58 characters a line so
 *  it never needs sideways scrolling on a phone", which was wrong twice. One
 *  line was 62. And 58 would have needed a phone 457px wide, so even the rule
 *  it set itself would not have fitted. The reader saw 41 of up to 62
 *  characters and had to drag the one piece of proof the page hands them.
 *
 *  It costs more lines than it would take written out, and it is worth it
 *  here: this is the block the page tells a reader to copy, and the argument
 *  for measuring rather than looking is badly made in a box that has to be
 *  dragged sideways. Re-measure if the type size or the padding changes. */
export const weightSnippet = `const kb = n =>
  Math.round(n / 1024) + ' KB';
const size = a => a.reduce(
  (t, x) =>
    t + x.encodedBodySize,
  0
);

const all = performance
  .getEntries()
  .filter(x =>
    x.encodedBodySize);
const js = all.filter(x =>
  /\\.js(\\?|$)/.test(x.name));
const nav = all.find(x =>
  x.entryType === 'navigation');
const ms =
  Math.round(nav.loadEventEnd);

console.table({
  total: kb(size(all)),
  javascript: kb(size(js)),
  load: ms + ' ms',
});`;

/** No Russian entry, and that is not an oversight. Russian is one page on this
 *  site, the Moldova page, and it carries its own date rather than the proof
 *  inventory the home and migration pages are built around. Anything that needs
 *  a proof in a language passes 'en' or 'ro'. */
export const proofs: Record<Locale, Proof[]> = {
	en: [
		{
			id: 'bubble-weight',
			claim:
				'The Bubble runtime ships over a megabyte of JavaScript before the first word is read, on every public page of every app.',
			value: '1,371',
			unit: 'KB',
			howToCheck:
				'Open the console on your own app, paste the code below, press Enter. It takes thirty seconds and the number is yours, not mine.',
			source: {
				label: 'manual.bubble.io, performance',
				href: 'https://manual.bubble.io/help-guides/optimizing-performance',
			},
			verifiedOn: VERIFIED_ON.en,
		},
		{
			id: 'stripe-escrow',
			claim:
				'Stripe does not offer escrow. Escrow services are on its restricted businesses list, and applications that use the word get rejected.',
			howToCheck:
				'Search for "Escrow services" in the official restricted businesses list. Stripe publishes it, not me.',
			source: {
				label: 'stripe.com, restricted businesses',
				href: 'https://stripe.com/legal/restricted-businesses',
			},
			verifiedOn: VERIFIED_ON.en,
		},
	],
	ro: [
		{
			id: 'bubble-weight',
			claim:
				'Runtime-ul Bubble trimite peste un megabyte de JavaScript înainte de primul cuvânt citit, pe orice pagină publică a oricărei aplicații.',
			value: '1.371',
			unit: 'KB',
			howToCheck:
				'Deschide consola pe aplicația ta, lipește codul de mai jos, apasă Enter. Durează treizeci de secunde și numărul e al tău, nu al meu.',
			source: {
				label: 'manual.bubble.io, performanță',
				href: 'https://manual.bubble.io/help-guides/optimizing-performance',
			},
			verifiedOn: VERIFIED_ON.ro,
		},
		{
			id: 'stripe-escrow',
			claim:
				'Stripe nu oferă escrow. Serviciile de escrow sunt pe lista lui de activități restricționate, iar aplicațiile care folosesc cuvântul sunt respinse.',
			howToCheck:
				'Caută „Escrow services” în lista oficială de activități restricționate. E publicată de Stripe, nu de mine.',
			source: {
				label: 'stripe.com, activități restricționate',
				href: 'https://stripe.com/legal/restricted-businesses',
			},
			verifiedOn: VERIFIED_ON.ro,
		},
	],
};

/** The two proofs by id, for the page that wants one of them by name. */
export function proof(locale: Locale, id: string): Proof {
	const found = proofs[locale].find((p) => p.id === id);
	if (!found) throw new Error(`No proof "${id}" in ${locale}`);
	return found;
}
