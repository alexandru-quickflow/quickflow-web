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
			i18n: {
				defaultLocale: 'en',
				locales: { en: 'en', ro: 'ro-RO' },
			},
		}),
		icon(),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
