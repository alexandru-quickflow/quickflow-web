import test from 'node:test';
import assert from 'node:assert/strict';

import { paths, alternates, LOCALES } from '../src/i18n/routes.ts';

/**
 * The routing table's one invariant: every path ends with a slash.
 *
 * It is not a style rule. The build emits a directory per page, so the server
 * answers `/contact` with a 308 to `/contact/`, and `paths` is where every
 * link, every language switcher target and every hreflang in the site comes
 * from. While the slugs here had no trailing slash, three things were true at
 * once and none of them was visible from the page:
 *
 *   every internal link paid a redirect before the page began loading;
 *   every hreflang pointed at a URL that redirects, which is not the canonical
 *     URL Google asks hreflang to name, so the language clusters were built on
 *     annotations it is entitled to drop;
 *   the canonical tag, which is computed from the request path rather than from
 *     this table, disagreed with the hreflang on the same page.
 *
 * The last one is why this went unseen for so long: the two were generated from
 * different sources, so nothing compared them. A test is cheaper than
 * remembering, and a page added in a hurry is exactly when this gets forgotten.
 */

test('every path in the table ends with a slash', () => {
	for (const [id, byLocale] of Object.entries(paths)) {
		for (const [locale, path] of Object.entries(byLocale)) {
			assert.ok(
				path.endsWith('/'),
				`paths.${id}.${locale} is '${path}', which the server answers with a ` +
					`308 to '${path}/'. Add the slash.`,
			);
		}
	}
});

test('every path is absolute, so a link cannot resolve against the page it is on', () => {
	for (const [id, byLocale] of Object.entries(paths)) {
		for (const [locale, path] of Object.entries(byLocale)) {
			assert.ok(path.startsWith('/'), `paths.${id}.${locale} is '${path}', not absolute.`);
		}
	}
});

test('the hreflang block names canonical URLs, never redirecting ones', () => {
	// Every page in the table, asked the way the layout asks: by pathname.
	for (const byLocale of Object.values(paths)) {
		for (const path of Object.values(byLocale)) {
			for (const twin of alternates(path)) {
				assert.ok(
					twin.href.endsWith('/'),
					`alternates('${path}') offers '${twin.href}', which redirects. ` +
						`An hreflang pointing at a redirect is not pointing at the canonical URL.`,
				);
			}
		}
	}
});

test('a page present in a language is reachable in exactly that set of languages', () => {
	// The table is the only thing that knows a page is missing from a language,
	// and alternates() is what the switcher and the hreflang block both read.
	// They have to agree, or the switcher sends a reader to a 404 that the
	// hreflang already told Google about.
	for (const [id, byLocale] of Object.entries(paths)) {
		const declared = LOCALES.filter((l) => byLocale[l] !== undefined);
		for (const path of Object.values(byLocale)) {
			const offered = alternates(path).map((a) => a.locale);
			assert.deepEqual(
				offered,
				declared,
				`paths.${id} exists in [${declared}] but alternates('${path}') offers [${offered}].`,
			);
		}
	}
});
