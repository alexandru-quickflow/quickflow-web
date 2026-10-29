// The handful of strings the chrome needs in both languages: skip link, menu,
// footer. Page copy does not live here, it lives in the page, because copy
// written per language reads better than copy assembled from keys.

import type { Locale } from './routes';

interface Ui {
	skip: string;
	navLabel: string;
	navLabelMobile: string;
	menu: string;
	home: string;
	switchTo: (language: string) => string;
	footerWho: string;
	footerLanguages: string;
	footerContact: string;
	footerBuilt: string;
	legal: string;
}

export const ui: Record<Locale, Ui> = {
	en: {
		skip: 'Skip to content',
		navLabel: 'Main',
		navLabelMobile: 'Main, mobile',
		menu: 'Menu',
		home: 'Quick Flow, home',
		switchTo: (language) => `Read this page in ${language}`,
		footerWho: 'Alexandru Trofaniuc, Bucharest',
		footerLanguages: 'Romanian, Russian, English',
		footerContact: 'Contact',
		footerBuilt: 'Built with no framework on the client',
		legal:
			'Quick Flow SRL, Bucharest, Romania. Fiscal code 44089760, trade register J2021006561401. The registered office is on the terms page.',
	},
	ro: {
		skip: 'Sari la conținut',
		navLabel: 'Principal',
		navLabelMobile: 'Principal, mobil',
		menu: 'Meniu',
		home: 'Quick Flow, acasă',
		switchTo: (language) => `Citește pagina în ${language}`,
		footerWho: 'Alexandru Trofaniuc, București',
		footerLanguages: 'Română, rusă, engleză',
		footerContact: 'Contact',
		footerBuilt: 'Construit fără framework pe client',
		legal:
			'Quick Flow SRL, București, România. CUI 44089760, nr. reg. com. J2021006561401. Sediul social e pe pagina de termeni.',
	},
};
