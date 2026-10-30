// How long the work has been going on, derived rather than typed.
//
// The site said "eight years inside Bubble" in four sentences and carried an 8
// as a figure on both home pages, next to "since 2017" in three other places.
// 2026 minus 2017 is nine. The 8 was true when it was written and nothing told
// anybody when it stopped being true, which is the whole failure mode: a number
// about elapsed time, typed once, ages on its own every January while the page
// around it looks finished.
//
// So one place knows the year and everything else is computed from it at build
// time. Every deploy recomputes it. It can still go stale, but only if a year
// passes with no deploy at all, and then every other dated thing on the site is
// stale too.

import type { Locale } from '../i18n/routes';

/** First paid Bubble work, at Zeroqode. The figure on the home page and the
 *  sentences in the about section all come from this one number. */
export const BUBBLE_SINCE = 2017;

/** Came into tech as a UI designer. */
export const DESIGN_SINCE = 2014;

/** Started delivering on code rather than no-code. */
export const CODE_SINCE = 2025;

/** Whole years since a starting year, as of the build. */
export function yearsSince(year: number): number {
	return new Date().getFullYear() - year;
}

// Spelled out, because the prose says "nine years" and not "9 years": a
// numeral mid-sentence reads as a statistic, and these sentences are not
// statistics. Written out to 2032, after which the numeral is the honest
// fallback and the gap is loud enough to notice in a proof-read.
const WORDS: Record<Locale, Record<number, string>> = {
	en: {
		8: 'eight',
		9: 'nine',
		10: 'ten',
		11: 'eleven',
		12: 'twelve',
		13: 'thirteen',
		14: 'fourteen',
		15: 'fifteen',
	},
	ro: {
		8: 'opt',
		9: 'nouă',
		10: 'zece',
		11: 'unsprezece',
		12: 'doisprezece',
		13: 'treisprezece',
		14: 'paisprezece',
		15: 'cincisprezece',
	},
};

/** The number of years in Bubble, written out, for running text. */
export function bubbleYearsInWords(lang: Locale): string {
	const n = yearsSince(BUBBLE_SINCE);
	return WORDS[lang][n] ?? String(n);
}

/** The same number as a figure, for the three facts on the home page. */
export function bubbleYears(): string {
	return String(yearsSince(BUBBLE_SINCE));
}
