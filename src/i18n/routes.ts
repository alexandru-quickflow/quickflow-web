// The one place that knows where a page lives in each language.
//
// English is the default locale, so it sits at the root with no prefix, and
// Romanian lives under /ro/. Slugs are translated, not shared: a Romanian slug
// on an English page ranks for nothing, and the reverse is just as true. The
// one exception is /stripe-escrow-marketplace, which keeps its slug in both,
// because the phrase people type into Google is English even when the page
// they want to read is not.

export const LOCALES = ['en', 'ro'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type PageId =
	| 'home'
	| 'migration'
	| 'marketplace'
	| 'internal'
	| 'prototype'
	| 'audit'
	| 'work'
	| 'contact'
	| 'privacy'
	| 'thanks'
	| 'escrow';

export const paths: Record<PageId, Record<Locale, string>> = {
	home: { en: '/', ro: '/ro/' },
	migration: {
		en: '/services/bubble-to-code-migration',
		ro: '/ro/servicii/migrare-bubble',
	},
	marketplace: {
		en: '/services/marketplace-payments',
		ro: '/ro/servicii/marketplace-plati',
	},
	internal: {
		en: '/services/internal-apps',
		ro: '/ro/servicii/aplicatii-interne',
	},
	prototype: {
		en: '/prototype-in-five-days',
		ro: '/ro/prototip-in-cinci-zile',
	},
	// Deliberately outside the header. A seventh nav item fits at 1280 and
	// collides with the language switcher at 1024, and this page is reached
	// from the home page, the migration page and the footer instead.
	audit: {
		en: '/bubble-performance-audit',
		ro: '/ro/audit-performanta-bubble',
	},
	work: { en: '/work', ro: '/ro/portofoliu' },
	contact: { en: '/contact', ro: '/ro/contact' },
	privacy: { en: '/privacy', ro: '/ro/confidentialitate' },
	thanks: { en: '/thank-you', ro: '/ro/multumesc' },
	escrow: { en: '/stripe-escrow-marketplace', ro: '/ro/stripe-escrow-marketplace' },
};

/** The pages in the header, in order, per language: the three services in
 *  their own hierarchy, then the one product with a price on the label, then
 *  the portfolio and the way to write. */
export const nav: Record<Locale, { id: PageId; label: string }[]> = {
	en: [
		{ id: 'migration', label: 'Migration' },
		{ id: 'marketplace', label: 'Marketplace' },
		{ id: 'internal', label: 'Internal apps' },
		{ id: 'prototype', label: 'Prototype' },
		{ id: 'work', label: 'Work' },
		{ id: 'contact', label: 'Contact' },
	],
	ro: [
		{ id: 'migration', label: 'Migrare' },
		{ id: 'marketplace', label: 'Marketplace' },
		{ id: 'internal', label: 'Aplicații interne' },
		{ id: 'prototype', label: 'Prototip' },
		{ id: 'work', label: 'Portofoliu' },
		{ id: 'contact', label: 'Contact' },
	],
};

/** What the switcher says, and what a screen reader hears. */
export const localeNames: Record<Locale, { short: string; full: string }> = {
	en: { short: 'EN', full: 'English' },
	ro: { short: 'RO', full: 'Română' },
};

/** Google wants a region-less code for English and a specific one for the
 *  Romanian, which is written for Romania. */
export const hreflang: Record<Locale, string> = { en: 'en', ro: 'ro-RO' };

/** Astro gives the path with or without a trailing slash depending on how the
 *  link was written, so every comparison goes through this first. */
function normalize(pathname: string): string {
	if (pathname === '/' || pathname === '') return '/';
	return pathname.replace(/\/+$/, '');
}

export function localeOf(pathname: string): Locale {
	return normalize(pathname) === '/ro' || pathname.startsWith('/ro/') ? 'ro' : 'en';
}

export function pageIdOf(pathname: string): PageId | undefined {
	const here = normalize(pathname);
	return (Object.keys(paths) as PageId[]).find((id) =>
		LOCALES.some((l) => normalize(paths[id][l]) === here)
	);
}

/** Every language this page exists in, this one included, for the hreflang
 *  block and for the switcher. A page with no twin yet returns only itself,
 *  which is the honest answer: a hreflang pointing at a 404 is worse than
 *  no hreflang at all. */
export function alternates(pathname: string): { locale: Locale; href: string }[] {
	const id = pageIdOf(pathname);
	if (!id) return [{ locale: localeOf(pathname), href: normalize(pathname) || '/' }];
	return LOCALES.map((locale) => ({ locale, href: paths[id][locale] }));
}
