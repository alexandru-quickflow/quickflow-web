// When each legal document last changed.
//
// This is not the same thing as VERIFIED_ON in proof.ts, and the two shared one
// constant until 30 October 2026. On that day the privacy notice was rewritten,
// the operator corrected, a legal basis added, retention capped and two rights
// added, and both privacy pages went on announcing 27 October, because moving
// the shared value would have made four audit pages claim a re-measurement that
// never happened. One value cannot mean both "the numbers were re-checked" and
// "this policy changed".
//
// So a document moves its own date and nothing else's. The last section of each
// privacy page tells the reader to watch this date for changes, which makes it
// the one line on the page that is not allowed to be approximate.

import type { Locale } from '../i18n/routes';

// No Russian entry: the privacy and terms pages are not written in Russian, and
// a date for a page that does not exist would be the kind of claim this file was
// created to stop.
export const LEGAL_UPDATED: Record<'privacy' | 'terms', Record<Locale, string>> = {
	privacy: { en: '30 October 2026', ro: '30 octombrie 2026' },
	terms: { en: '27 October 2026', ro: '27 octombrie 2026' },
};
