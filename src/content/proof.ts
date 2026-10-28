// Checkable facts.
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

export const VERIFIED_ON = '27 octombrie 2026';

/** What this page itself ships, measured on the production build with the same
 *  snippet the reader is handed below. Not measured on the dev server, which
 *  injects its own client script. Re-measure before every release: the day this
 *  page needs a script, the number on it has to change too. The Cloudflare
 *  Web Analytics beacon in the technical annex is exactly such a script, so
 *  this is 0 KB only as long as the beacon stays off. */
export const SELF_JS = '0 KB';

/** Pasted into the reader's own console, on their own app. Kept under 58
 *  characters a line so it never needs sideways scrolling on a phone. */
export const weightSnippet = `const r = performance.getEntriesByType('resource');
const n = performance.getEntriesByType('navigation')[0];
const kb = x => Math.round(x / 1024) + ' KB';
const sum = a => a.reduce((t, x) => t + x.encodedBodySize, 0);
const js = r.filter(x => /\\.js(\\?|$)/.test(x.name));

console.table({
  total: kb(sum(r) + n.encodedBodySize),
  javascript: kb(sum(js)),
  load: Math.round(n.loadEventEnd) + ' ms',
});`;

export const proofs: Proof[] = [
	{
		id: 'bubble-weight',
		claim: 'Runtime-ul Bubble trimite peste un megabyte de JavaScript înainte de primul cuvânt citit, pe orice pagină publică a oricărei aplicații.',
		value: '1.371',
		unit: 'KB',
		howToCheck:
			'Deschide consola pe aplicația ta, lipește codul de mai jos, apasă Enter. Durează treizeci de secunde și numărul e al tău, nu al meu.',
		source: {
			label: 'manual.bubble.io, performanță',
			href: 'https://manual.bubble.io/help-guides/optimizing-performance',
		},
		verifiedOn: VERIFIED_ON,
	},
	{
		id: 'stripe-escrow',
		claim: 'Stripe nu oferă escrow. Serviciile de escrow sunt pe lista lui de activități restricționate, iar aplicațiile care folosesc cuvântul sunt respinse.',
		howToCheck:
			'Caută „Escrow services” în lista oficială de activități restricționate. E publicată de Stripe, nu de mine.',
		source: {
			label: 'stripe.com, activități restricționate',
			href: 'https://stripe.com/legal/restricted-businesses',
		},
		verifiedOn: VERIFIED_ON,
	},
];
