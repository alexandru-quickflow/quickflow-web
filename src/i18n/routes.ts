// The one place that knows where a page lives in each language.
//
// English is the default locale, so it sits at the root with no prefix, and
// Romanian lives under /ro/. Slugs are translated, not shared: a Romanian slug
// on an English page ranks for nothing, and the reverse is just as true. The
// one exception is /stripe-escrow-marketplace, which keeps its slug in both,
// because the phrase people type into Google is English even when the page
// they want to read is not.

/** Russian is here for one page. Roughly half the commercial searches in
 *  Moldova are in Russian, the competition on them is close to nothing, and the
 *  question that page answers is asked in Russian as often as in Romanian. It
 *  buys a locale rather than a translation of the site: `paths` holds what each
 *  page has, and a page missing from a language is missing from its menus too,
 *  so nothing else had to be written three times. */
export const LOCALES = ['en', 'ro', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type PageId =
	| 'home'
	| 'migration'
	| 'marketplace'
	| 'courses'
	| 'internal'
	| 'prototype'
	| 'audit'
	| 'websites'
	| 'work'
	| 'contact'
	| 'privacy'
	| 'terms'
	| 'thanks'
	| 'escrow'
	| 'moldova'
	| 'kyc';

/** A page can be missing from a language. Not every subject is worth a page in
 *  both: the Moldova page answers a question asked in Romanian, by people whose
 *  company is in a country Stripe does not cover, and an English translation of
 *  it would rank for nothing and serve nobody.
 *
 *  Missing means missing everywhere, which is the point of keeping it in this
 *  table rather than in the page: no hreflang pointing at a 404, no nav item
 *  linking to one, and a language switcher that sends a reader somewhere real.
 *  Everything that reads this map filters by language first. */
export const paths: Record<PageId, Partial<Record<Locale, string>>> = {
	home: { en: '/', ro: '/ro/' },
	migration: {
		en: '/services/bubble-to-code-migration/',
		ro: '/ro/servicii/migrare-bubble/',
	},
	marketplace: {
		en: '/services/marketplace-payments/',
		ro: '/ro/servicii/marketplace-plati/',
	},
	courses: {
		en: '/services/course-platforms/',
		ro: '/ro/servicii/platforme-cursuri/',
	},
	internal: {
		en: '/services/internal-apps/',
		ro: '/ro/servicii/aplicatii-interne/',
	},
	prototype: {
		en: '/prototype-in-five-days/',
		ro: '/ro/prototip-in-cinci-zile/',
	},
	// Deliberately outside the header. A seventh nav item fits at 1280 and
	// collides with the language switcher at 1024, and this page is reached
	// from the home page, the migration page and the footer instead.
	audit: {
		en: '/bubble-performance-audit/',
		ro: '/ro/audit-performanta-bubble/',
	},
	// The Romanian slug carries both terms because both are searched for
	// separately, and the Romanian market is the one where that matters.
	websites: {
		en: '/landing-page-and-website/',
		ro: '/ro/landing-page-si-site-de-prezentare/',
	},
	work: { en: '/work/', ro: '/ro/portofoliu/' },
	contact: { en: '/contact/', ro: '/ro/contact/' },
	privacy: { en: '/privacy/', ro: '/ro/confidentialitate/' },
	terms: { en: '/terms/', ro: '/ro/termeni/' },
	thanks: { en: '/thank-you/', ro: '/ro/multumesc/' },
	escrow: { en: '/stripe-escrow-marketplace/', ro: '/ro/stripe-escrow-marketplace/' },
	// Romanian only. Stripe does not operate in Moldova, which is a fact worth a
	// page in the language the question is asked in and worth nothing in English.
	moldova: { ro: '/ro/stripe-moldova-marketplace/', ru: '/ru/stripe-moldova-marketplace/' },
	// The slug is the same in both languages, like the escrow page and for the
	// same reason: the phrase people type into Google is English even when the
	// page they want to read is not.
	kyc: {
		en: '/stripe-connect-kyc-onboarding/',
		ro: '/ro/stripe-connect-kyc-onboarding/',
	},
};

/** The path to a page in a language, or undefined when the page does not exist
 *  in it. Callers that render a link check this rather than indexing `paths`
 *  twice. */
export function pathIn(id: PageId, locale: Locale): string | undefined {
	return paths[id][locale];
}

/** The items of a nav list that exist in this language. The Moldova page shows
 *  up in the Romanian footer and nowhere in the English one, without either
 *  list having to know why. */
export function inLocale<T extends { id: PageId }>(items: T[], locale: Locale): T[] {
	return items.filter((item) => paths[item.id][locale] !== undefined);
}

/** The pages in the header, in order, per language: the four services, then
 *  the portfolio and the way to write. Six items, and six is the ceiling: a
 *  seventh fits at 1280 and collides with the language switcher at 1024. The
 *  two products with a price on them, the audit and the prototype, are reached
 *  from the home page and the footer instead. */
export const nav: Record<Locale, { id: PageId; label: string }[]> = {
	en: [
		{ id: 'migration', label: 'Migration' },
		{ id: 'marketplace', label: 'Marketplace' },
		{ id: 'courses', label: 'Courses' },
		{ id: 'internal', label: 'Internal apps' },
		{ id: 'work', label: 'Work' },
		{ id: 'contact', label: 'Contact' },
	],
	ro: [
		{ id: 'migration', label: 'Migrare' },
		{ id: 'marketplace', label: 'Marketplace' },
		{ id: 'courses', label: 'Cursuri' },
		{ id: 'internal', label: 'Aplicații interne' },
		{ id: 'work', label: 'Portofoliu' },
		{ id: 'contact', label: 'Contact' },
	],
	// Empty on purpose. One page exists in Russian, so a header menu would be a
	// row of links to pages that are not written in the language the reader
	// asked for. The page says where the rest of the site is, in a sentence.
	ru: [],
};

/** What the switcher says, and what a screen reader hears. */
export const localeNames: Record<Locale, { short: string; full: string }> = {
	en: { short: 'EN', full: 'English' },
	ro: { short: 'RO', full: 'Română' },
	ru: { short: 'RU', full: 'Русский' },
};

/** Google wants a region-less code for English and a specific one for the
 *  Romanian, which is written for Romania. */
export const hreflang: Record<Locale, string> = { en: 'en', ro: 'ro-RO', ru: 'ru' };

/** Astro gives the path with or without a trailing slash depending on how the
 *  link was written, so every comparison goes through this first. */
function normalize(pathname: string): string {
	if (pathname === '/' || pathname === '') return '/';
	return pathname.replace(/\/+$/, '');
}

export function localeOf(pathname: string): Locale {
	const here = normalize(pathname);
	const prefixed = LOCALES.find(
		(l) => l !== DEFAULT_LOCALE && (here === `/${l}` || pathname.startsWith(`/${l}/`)),
	);
	return prefixed ?? DEFAULT_LOCALE;
}

/** The languages this page is not written in, in the order they are shown. The
 *  switcher used to ask for "the other one", which stopped being a question
 *  with an answer the day a third language arrived. */
export function otherLocales(lang: Locale): Locale[] {
	return LOCALES.filter((l) => l !== lang);
}

export function pageIdOf(pathname: string): PageId | undefined {
	const here = normalize(pathname);
	return (Object.keys(paths) as PageId[]).find((id) =>
		LOCALES.some((l) => {
			const path = paths[id][l];
			return path !== undefined && normalize(path) === here;
		})
	);
}

/** Every language this page exists in, this one included, for the hreflang
 *  block and for the switcher. A page with no twin yet returns only itself,
 *  which is the honest answer: a hreflang pointing at a 404 is worse than
 *  no hreflang at all. */
export function alternates(pathname: string): { locale: Locale; href: string }[] {
	const id = pageIdOf(pathname);
	if (!id) return [{ locale: localeOf(pathname), href: normalize(pathname) || '/' }];
	return LOCALES.flatMap((locale) => {
		const href = paths[id][locale];
		return href === undefined ? [] : [{ locale, href }];
	});
}

/** Where the switcher sends a reader who asks for another language: the twin
 *  page if this one has one, otherwise that language's home page.
 *
 *  Hiding the switcher on a page with no twin would be worse. A reader who
 *  lands on a Romanian-only page from a search result would have no way back to
 *  the English site at all, and a control that disappears on one page out of
 *  thirty reads as a bug rather than as an answer. `translated` says which of
 *  the two kinds of link it is, so the label can say so too.
 *
 *  Undefined when there is neither: Russian is one page, not a version of the
 *  site, so offering RU on the contact page would promise a Russian site that
 *  does not exist. A language shows up in the switcher where it has something
 *  to show. */
export function switcherTarget(
	pathname: string,
	to: Locale,
): { locale: Locale; href: string; translated: boolean } | undefined {
	const twin = alternates(pathname).find((a) => a.locale === to);
	if (twin) return { ...twin, translated: true };
	const home = paths.home[to];
	return home === undefined ? undefined : { locale: to, href: home, translated: false };
}

/** The footer is an index, not a copy of the header. The header stops at six
 *  items for a measured reason; the footer has room for all twelve pages and
 *  groups them by what they are rather than by what fits.
 *
 *  Every page with content on it belongs here: the ids in `paths`, less the
 *  home page, which the mark links to, and the thank-you page, which is
 *  noindex. Twelve in English, thirteen in Romanian, because the Moldova page
 *  exists in one language and `inLocale` drops it from the other list without
 *  either column having to know.
 *
 *  It said twelve while listing eleven until 30 October, because the escrow
 *  page was missing from it. That page is reached from seven others, so it was
 *  never orphaned, but it was the one piece of content the index did not index.
 *  Anything added to `paths` belongs in a column here or has a reason written
 *  down for why it does not. */
export const footerNav: Record<
	Locale,
	{ title: string; items: { id: PageId; label: string }[] }[]
> = {
	en: [
		{
			title: 'Services',
			items: [
				{ id: 'migration', label: 'Bubble to code migration' },
				{ id: 'marketplace', label: 'Marketplace with payments' },
				{ id: 'courses', label: 'Course platforms' },
				{ id: 'internal', label: 'Internal apps' },
				{ id: 'websites', label: 'Landing page and site' },
				{ id: 'escrow', label: 'Stripe and escrow' },
				{ id: 'kyc', label: 'Stripe Connect KYC' },
			],
		},
		{
			title: 'Ways in',
			items: [
				{ id: 'audit', label: 'Performance audit, 350' },
				{ id: 'prototype', label: 'Prototype, 1,800' },
			],
		},
		{
			title: 'Quick Flow',
			items: [
				{ id: 'work', label: 'Work' },
				{ id: 'contact', label: 'Contact' },
				{ id: 'terms', label: 'Terms' },
				{ id: 'privacy', label: 'Privacy' },
			],
		},
	],
	ro: [
		{
			title: 'Servicii',
			items: [
				{ id: 'migration', label: 'Migrare de pe Bubble pe cod' },
				{ id: 'marketplace', label: 'Marketplace cu plăți' },
				{ id: 'courses', label: 'Platforme de cursuri' },
				{ id: 'internal', label: 'Aplicații interne' },
				{ id: 'websites', label: 'Landing page și site' },
				{ id: 'escrow', label: 'Stripe și escrow' },
				{ id: 'moldova', label: 'Stripe în Moldova' },
				{ id: 'kyc', label: 'KYC la Stripe Connect' },
			],
		},
		{
			title: 'Intrări',
			items: [
				{ id: 'audit', label: 'Audit de performanță, 350' },
				{ id: 'prototype', label: 'Prototip, 1.800' },
			],
		},
		{
			title: 'Quick Flow',
			items: [
				{ id: 'work', label: 'Portofoliu' },
				{ id: 'contact', label: 'Contact' },
				{ id: 'terms', label: 'Termeni' },
				{ id: 'privacy', label: 'Confidențialitate' },
			],
		},
	],
	// Empty for the same reason as the header. What the Russian footer keeps is
	// what is not a link to a page: the address to write to, the identification
	// line Legea 365/2002 asks for, and the ANPC mark.
	ru: [],
};

/** The one profile that is confirmed. The home page schema used to carry a
 *  comment saying there would be no sameAs until there was a URL to put in it. */
export const PROFILE = 'https://www.linkedin.com/in/alexandrutr/';
