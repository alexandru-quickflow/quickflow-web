import test from 'node:test';
import assert from 'node:assert/strict';

import {
	VERIFIED_ON,
	VERIFIED_ON_ISO,
	STRIPE_DOCS_READ,
	STRIPE_DOCS_READ_ISO,
} from '../src/content/proof.ts';

/**
 * Each of these dates is now written twice: once for the reader, in three
 * languages, and once for schema.org, in ISO. That is the arrangement this file
 * exists to police.
 *
 * proof.ts already carries the scar. One constant for two different events made
 * four legal pages announce a day they had not changed on, and the comment
 * above STRIPE_DOCS_READ says so. Splitting a date into a displayed spelling
 * and a machine one is the same hazard in a new place: the two cannot be read
 * at a glance, nothing in a build fails when they disagree, and the one a
 * reader sees and the one a model is handed would quietly say different days.
 */

const MONTHS = {
	january: 1,
	february: 2,
	march: 3,
	april: 4,
	may: 5,
	june: 6,
	july: 7,
	august: 8,
	september: 9,
	october: 10,
	november: 11,
	december: 12,
};

/** '27 October 2026' to '2026-10-27', without Date, whose parsing of a string
 *  like this is engine territory rather than something to rely on. */
function isoOf(english) {
	const [day, month, year] = english.trim().split(/\s+/);
	const m = MONTHS[month.toLowerCase()];
	assert.ok(m, `${english}: "${month}" is not a month name this knows`);
	return `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`;
}

const DATES = [
	{ name: 'VERIFIED_ON', display: VERIFIED_ON, iso: VERIFIED_ON_ISO },
	{ name: 'STRIPE_DOCS_READ', display: STRIPE_DOCS_READ, iso: STRIPE_DOCS_READ_ISO },
];

for (const { name, display, iso } of DATES) {
	test(`${name} and ${name}_ISO are the same day`, () => {
		assert.equal(
			isoOf(display.en),
			iso,
			`${name}.en says ${display.en} and ${name}_ISO says ${iso}. ` +
				`The page would tell a reader one day and a search engine another.`,
		);
	});

	test(`every language of ${name} names that same day and year`, () => {
		const [year, , day] = iso.split('-');
		const bare = String(Number(day));
		for (const [locale, text] of Object.entries(display)) {
			assert.ok(
				text.includes(bare),
				`${name}.${locale} is "${text}", which does not contain the day ${bare}.`,
			);
			assert.ok(
				text.includes(year),
				`${name}.${locale} is "${text}", which does not contain the year ${year}.`,
			);
		}
	});
}

test('the two dates are still two dates', () => {
	// Not a style point. They are different events on purpose: the day the
	// measured numbers were re-checked, and the day the Stripe documentation was
	// read. Collapsing them is the mistake the comment in proof.ts describes, so
	// if they ever become equal it should be because both were done that day and
	// somebody meant it, not because one was pointed at the other.
	assert.notEqual(
		VERIFIED_ON_ISO,
		STRIPE_DOCS_READ_ISO,
		'VERIFIED_ON_ISO and STRIPE_DOCS_READ_ISO are the same day. If that is ' +
			'genuinely true, delete this test and say so in the commit.',
	);
});
