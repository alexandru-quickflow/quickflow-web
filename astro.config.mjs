// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	site: 'https://quickflow.dev',
	// English is the default locale, so it sits at the root and Romanian lives
	// under /ro/. The translated slugs are in src/i18n/routes.ts; this only
	// decides which language carries the prefix.
	i18n: {
		defaultLocale: 'en',
		locales: ['en', 'ro'],
		routing: {
			prefixDefaultLocale: false,
		},
	},
	integrations: [
		sitemap({
			// A page that tells robots noindex has no business being advertised in
			// the sitemap: the two instructions contradict each other, and Google
			// reports the pair as an error rather than picking one. Every route
			// that passes noindex to the layout belongs in this list, so when a
			// page gains or loses noindex, it changes here too. Currently just
			// the two form confirmations, which have no business in search.
			filter: (page) =>
				!['/ro/multumesc/', '/thank-you/'].some((noindex) => page.includes(noindex)),
			i18n: {
				defaultLocale: 'en',
				locales: { en: 'en', ro: 'ro-RO' },
			},
		}),
		icon(),
	],
	vite: {
		plugins: [tailwindcss()],
		build: {
			// CSS minification is off, deliberately. Lightning CSS merges
			// `animation: x linear both` and the `animation-timeline: view()`
			// that follows it into a single shorthand, `animation: linear both
			// x view()`, which no browser accepts. The declaration is then
			// dropped and every scroll-driven animation on the site silently
			// stops existing, with no warning anywhere. Measured cost of
			// leaving it unminified: see the launch checklist.
			cssMinify: false,
		},
	},
});
