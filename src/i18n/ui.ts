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
	switchToHome: (language: string) => string;
	footerWho: string;
	footerLanguages: string;
	footerContact: string;
	legal: string;
	salAlt: string;
}

export const ui: Record<Locale, Ui> = {
	en: {
		skip: 'Skip to content',
		navLabel: 'Main',
		navLabelMobile: 'Main, mobile',
		menu: 'Menu',
		home: 'Quick Flow, home',
		switchTo: (language) => `Read this page in ${language}`,
		switchToHome: (language) => `This page is not translated. Go to the ${language} home page`,
		footerWho: 'Alexandru Trofaniuc, Bucharest',
		footerLanguages: 'Romanian, Russian, English',
		footerContact: 'Contact',
		// The same two identifiers the terms page gives, named the way that
		// page names them. This line said "CUI" in English, which is the
		// Romanian term and means nothing to an English reader, and abbreviated
		// the register differently from its Romanian twin for no reason.
		legal: 'Quick Flow SRL · Fiscal code 44089760 · Trade register J2021006561401',
		salAlt: 'ANPC, alternative dispute resolution for consumers',
	},
	ro: {
		skip: 'Sari la conținut',
		navLabel: 'Principal',
		navLabelMobile: 'Principal, mobil',
		menu: 'Meniu',
		home: 'Quick Flow, acasă',
		switchTo: (language) => `Citește pagina în ${language}`,
		switchToHome: (language) => `Pagina asta nu e tradusă. Mergi la pagina principală în ${language}`,
		footerWho: 'Alexandru Trofaniuc, București',
		footerLanguages: 'Română, rusă, engleză',
		footerContact: 'Contact',
		legal: 'Quick Flow SRL · CUI 44089760 · Nr. reg. com. J2021006561401',
		salAlt: 'ANPC, Soluționarea Alternativă a Litigiilor',
	},
	// One page is written in Russian, so this is the chrome around one page.
	// The identification line is not translated: it is a company name and two
	// registry numbers, and a reader who needs to check them checks them against
	// the registry, which writes them this way.
	ru: {
		skip: 'Перейти к содержанию',
		navLabel: 'Основное',
		navLabelMobile: 'Основное, мобильное',
		menu: 'Меню',
		home: 'Quick Flow, главная',
		switchTo: (language) => `Читать страницу на ${language}`,
		switchToHome: (language) => `Эта страница не переведена. Перейти на главную на ${language}`,
		footerWho: 'Александру Трофанюк, Бухарест',
		footerLanguages: 'Румынский, русский, английский',
		footerContact: 'Контакты',
		legal: 'Quick Flow SRL · CUI 44089760 · Nr. reg. com. J2021006561401',
		salAlt: 'ANPC, альтернативное разрешение споров в Румынии',
	},
};
