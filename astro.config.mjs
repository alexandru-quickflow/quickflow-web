// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	site: 'https://quickflow.dev',
	i18n: {
		defaultLocale: 'ro',
		locales: ['ro', 'en'],
		routing: {
			prefixDefaultLocale: false,
		},
	},
	integrations: [
		sitemap({
			i18n: {
				defaultLocale: 'ro',
				locales: { ro: 'ro-RO', en: 'en' },
			},
		}),
		icon(),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
