import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * The contact form, which is the only thing on this site that can break.
 *
 * ADR-0005 asks for one spec covering a successful submission and validation
 * when the required fields are empty. Both of those cross a boundary: the page
 * posts, the Cloudflare Pages Function answers, and the page renders what came
 * back. `astro preview` serves the static build and does not run the function,
 * so this file stands on the page's side of that boundary and the function's
 * own side is covered by tests/contact-paths.test.mjs, which calls the handler
 * directly. Between them the two halves of the ADR's sentence are real: the
 * handler is what decides a field is empty, and this is what decides the
 * visitor ever sees it.
 *
 * So the responses here are fulfilled rather than fetched. That is not a
 * weakness to apologise for, it is the point: it lets the page be checked
 * against answers it would otherwise almost never see, including the one where
 * sending fails, which is the path that until the audit was announced to
 * nobody.
 *
 * Both languages, because the two pages have drifted apart twice before and
 * the probe's pair check compares element counts, which attributes and wiring
 * slip straight past.
 *
 * Since the form became three steps, most of what is checked here is that the
 * steps are only a way of showing one form. The thing that would make them a
 * lie is a field going missing from the POST because the step it lives on was
 * not on screen, so that is asserted field by field, from all three steps, on
 * the one submission that goes through.
 */

const PAGES = [
	{
		lang: 'en',
		path: '/contact/',
		submit: 'Send',
		errors: {
			nume: 'Tell me what to call you.',
			email: 'I need an email address to be able to answer you.',
			proiect: 'Tell me in two lines what you want to build.',
		},
		serviceDown: 'I could not send the request right now.',
	},
	{
		lang: 'ro',
		path: '/ro/contact/',
		submit: 'Trimite',
		errors: {
			nume: 'Scrie-mi cum te cheamă.',
			email: 'Am nevoie de un email ca să îți pot răspunde.',
			proiect: 'Spune-mi în două rânduri ce vrei să construiești.',
		},
		serviceDown: 'Nu am putut trimite cererea acum.',
	},
] as const;

/** The request the page made, captured so it can be read field by field. */
type Captured = { method: string; accept: string; fields: Record<string, string> };

/**
 * The body a FormData post puts on the wire, read back into names and values.
 * The boundary comes from the content type rather than from a guess at its
 * shape, because every engine invents its own and Chromium's is not the one a
 * pattern written for another engine expects.
 */
function multipart(contentType: string, body: string): Record<string, string> {
	const boundary = contentType.match(/boundary=(.+)$/)?.[1];
	const fields: Record<string, string> = {};
	if (!boundary) return fields;
	for (const part of body.split(`--${boundary}`)) {
		const match = part.match(/name="([^"]+)"[^]*?\r\n\r\n([^]*?)\r\n$/);
		if (match) fields[match[1]] = match[2];
	}
	return fields;
}

async function intercept(page: Page, answer: (route: Route) => Promise<void>) {
	const seen: Captured[] = [];
	await page.route('**/api/contact', async (route) => {
		const request = route.request();
		seen.push({
			method: request.method(),
			accept: request.headers()['accept'] ?? '',
			fields: multipart(request.headers()['content-type'] ?? '', request.postData() ?? ''),
		});
		await answer(route);
	});
	return seen;
}

const json = (route: Route, status: number, body: unknown) =>
	route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Which step is on screen, by index, or -1 if the script never ran. */
const stepOn = (p: Page) =>
	p.evaluate(() => [...document.querySelectorAll('[data-step]')].findIndex((s) => !s.hasAttribute('hidden')));

/**
 * Fills what each step needs and walks to the last one, leaving the form ready
 * to submit. Deliberately writes something on every step, so the submission a
 * test then makes carries a field from each of the three.
 */
async function walkToTheEnd(p: Page) {
	await p.fill('#proiect', 'A marketplace with split payments.');
	await p.fill('#acum', 'a Bubble app, app.example.com');
	await p.click('#form-next');
	await p.selectOption('#buget', { index: 1 });
	await p.click('#form-next');
	await p.fill('#nume', 'Ana Test');
	await p.fill('#email', 'ana@example.com');
}

for (const page of PAGES) {
	test.describe(`contact form, ${page.lang}`, () => {
		test('a successful submission hands the form over to the confirmation', async ({
			page: browserPage,
		}) => {
			const seen = await intercept(browserPage, (route) => json(route, 200, { ok: true }));
			await browserPage.goto(page.path);

			await walkToTheEnd(browserPage);
			await browserPage.click('#submit-btn');

			const success = browserPage.locator('#form-success');
			await expect(success).toBeVisible();
			// The confirmation has to announce itself: a reader who cannot see
			// the page is told the form is gone and why.
			await expect(success).toHaveAttribute('role', 'status');
			await expect(browserPage.locator('#contact-form')).toBeHidden();

			expect(seen).toHaveLength(1);
			expect(seen[0].method).toBe('POST');
			// The handler decides what to answer with from this header alone.
			expect(seen[0].accept).toContain('application/json');

			// One POST carrying all three steps, which is the whole claim the
			// steps make. A field dropping out because its step was not on
			// screen is the way this breaks, so each step is named here.
			expect(seen[0].fields.proiect).toBe('A marketplace with split payments.'); // step 1
			expect(seen[0].fields.acum).toBe('a Bubble app, app.example.com'); // step 1
			expect(seen[0].fields.subiect).toBeTruthy(); // step 1, left at its default
			expect(seen[0].fields.buget).toBeTruthy(); // step 2
			expect(seen[0].fields.cand).toBeTruthy(); // step 2, never touched
			expect(seen[0].fields.nume).toBe('Ana Test'); // step 3
			expect(seen[0].fields.email).toBe('ana@example.com'); // step 3
			// The four payment fields live inside a closed details on step 2
			// and are submitted from it, empty, without anyone opening it.
			for (const name of ['plateste', 'incaseaza', 'comision', 'livrare']) {
				expect(seen[0].fields[name]).toBe('');
			}
			// The hidden locale field is what sends the visitor to the
			// thank-you page in their own language, and it has been wrong
			// before.
			expect(seen[0].fields.locale).toBe(page.lang);
			// The honeypot is submitted and has to be empty, or every real
			// submission looks like a bot to the handler.
			expect(seen[0].fields.website ?? '').toBe('');
		});

		test('a step will not move on while something it needs is empty', async ({
			page: browserPage,
		}) => {
			await browserPage.goto(page.path);
			expect(await stepOn(browserPage)).toBe(0);

			await browserPage.click('#form-next');

			// Still on the first step, with the field that stopped it focused
			// and saying so.
			expect(await stepOn(browserPage)).toBe(0);
			await expect(browserPage.locator('#proiect')).toBeFocused();
			await expect(browserPage.locator('#proiect')).toHaveAttribute('aria-invalid', 'true');
			await expect(browserPage.locator('#error-proiect')).toBeVisible();

			await browserPage.fill('#proiect', 'A marketplace with split payments.');
			await browserPage.click('#form-next');
			expect(await stepOn(browserPage)).toBe(1);
		});

		test('the last step is the only one that can send', async ({ page: browserPage }) => {
			await browserPage.goto(page.path);

			await expect(browserPage.locator('#submit-btn')).toBeHidden();
			await expect(browserPage.locator('#form-back')).toBeHidden();
			await expect(browserPage.locator('#form-next')).toBeVisible();

			await walkToTheEnd(browserPage);

			expect(await stepOn(browserPage)).toBe(2);
			await expect(browserPage.locator('#submit-btn')).toBeVisible();
			await expect(browserPage.locator('#form-next')).toBeHidden();
			// Back stays, so the last step is not a trap.
			await expect(browserPage.locator('#form-back')).toBeVisible();

			await browserPage.click('#form-back');
			expect(await stepOn(browserPage)).toBe(1);
			// What was typed is still there after walking away from it.
			await browserPage.click('#form-next');
			await expect(browserPage.locator('#nume')).toHaveValue('Ana Test');
		});

		test('empty required fields come back onto the fields themselves', async ({
			page: browserPage,
		}) => {
			await intercept(browserPage, (route) => json(route, 400, { fields: page.errors }));
			await browserPage.goto(page.path);

			await walkToTheEnd(browserPage);
			await browserPage.click('#submit-btn');

			// The handler named a field on every step, including two behind the
			// one that was on screen. Each message has to be attached to its own
			// field wherever that field lives.
			for (const [field, message] of Object.entries(page.errors)) {
				const error = browserPage.locator(`#error-${field}`);
				await expect(error).toHaveText(message);
				// Tied to the input, not merely sitting under it. Without this
				// the message is read out to nobody.
				await expect(browserPage.locator(`#${field}`)).toHaveAttribute(
					'aria-describedby',
					`error-${field}`
				);
				await expect(browserPage.locator(`#${field}`)).toHaveAttribute('aria-invalid', 'true');
			}

			// And the page goes back to the step the first bad field is on,
			// which is step one, or the message would be announced on a screen
			// that does not show it.
			expect(await stepOn(browserPage)).toBe(0);
			await expect(browserPage.locator('#error-proiect')).toBeVisible();
			await expect(browserPage.locator('#proiect')).toBeFocused();
			await expect(browserPage.locator('#contact-form')).toBeVisible();
			await expect(browserPage.locator('#form-success')).toBeHidden();
		});

		test('a second try clears the errors it fixed', async ({ page: browserPage }) => {
			let answer = 0;
			await intercept(browserPage, (route) =>
				answer++ === 0 ? json(route, 400, { fields: page.errors }) : json(route, 200, { ok: true })
			);
			await browserPage.goto(page.path);

			await walkToTheEnd(browserPage);
			await browserPage.click('#submit-btn');
			await expect(browserPage.locator('#error-proiect')).toBeVisible();

			// Thrown back to step one by the first error, so the walk starts
			// again from there.
			expect(await stepOn(browserPage)).toBe(0);
			await walkToTheEnd(browserPage);
			await browserPage.click('#submit-btn');

			await expect(browserPage.locator('#form-success')).toBeVisible();
			await expect(browserPage.locator('#error-nume')).toBeHidden();
			// aria-invalid has to come off too, or the field stays wrong to a
			// screen reader after it has been fixed.
			await expect(browserPage.locator('#nume')).not.toHaveAttribute('aria-invalid', 'true');
		});

		test('a send that fails says so out loud', async ({ page: browserPage }) => {
			await intercept(browserPage, (route) => json(route, 422, { message: page.serviceDown }));
			await browserPage.goto(page.path);

			await walkToTheEnd(browserPage);
			await browserPage.click('#submit-btn');

			const banner = browserPage.locator('#form-error');
			await expect(banner).toBeVisible();
			await expect(banner).toContainText(page.serviceDown);
			// role="alert", so it is read out the moment it appears. The
			// confirmation panel has announced itself since it was written and
			// this one announced itself to nobody until the audit.
			await expect(banner).toHaveAttribute('role', 'alert');
			// The text is not lost and the form can be sent again.
			await expect(browserPage.locator('#contact-form')).toBeVisible();
			await expect(browserPage.locator('#proiect')).toHaveValue(
				'A marketplace with split payments.'
			);
			await expect(browserPage.locator('#submit-btn')).toBeEnabled();
		});

		test('a failure with nothing readable in it still says something', async ({
			page: browserPage,
		}) => {
			// The handler answers its own failures in JSON. This is the other
			// kind: it was never reached, so what comes back is somebody else's
			// HTML. A 404 because the function is not deployed, or one of
			// Cloudflare's own error pages.
			//
			// Found by pressing the button on a preview server, where
			// /api/contact is a 404 and the page said nothing at all: the JSON
			// parse threw, the catch did not fire because the request itself
			// had succeeded, and both branches that show the banner were
			// skipped. The visitor pressed send and their message was gone as
			// far as they could tell.
			await intercept(browserPage, (route) =>
				route.fulfill({ status: 404, contentType: 'text/html', body: '<html>404</html>' })
			);
			await browserPage.goto(page.path);

			await walkToTheEnd(browserPage);
			await browserPage.click('#submit-btn');

			const banner = browserPage.locator('#form-error');
			await expect(banner).toBeVisible();
			await expect(banner).toHaveAttribute('role', 'alert');
			await expect(banner).toContainText('alexandru@quickflow.dev');
			// Not the confirmation. Nothing was sent.
			await expect(browserPage.locator('#form-success')).toBeHidden();
			await expect(browserPage.locator('#contact-form')).toBeVisible();
			await expect(browserPage.locator('#submit-btn')).toBeEnabled();
		});

		test('the form still posts with no JavaScript at all', async ({ browser }) => {
			// The spec requires this and nothing else checks it. With the script
			// off there is no fetch, no inline message and no success panel, so
			// what is left has to be a plain form the browser can submit by
			// itself: the right action, the right method, and required fields
			// the handler will see as missing.
			const context = await browser.newContext({ javaScriptEnabled: false });
			const noScript = await context.newPage();
			await noScript.goto(`http://127.0.0.1:4322${page.path}`);

			const form = noScript.locator('#contact-form');
			await expect(form).toHaveAttribute('action', '/api/contact');
			await expect(form).toHaveAttribute('method', 'POST');
			// novalidate is deliberate: one set of messages, from the handler,
			// rather than the browser's own in a language it picked itself.
			await expect(form).toHaveAttribute('novalidate', '');
			await expect(noScript.locator('#submit-btn')).toHaveAttribute('type', 'submit');
			await expect(noScript.locator('input[name="locale"]')).toHaveValue(page.lang);
			for (const field of ['nume', 'email', 'proiect']) {
				await expect(noScript.locator(`#${field}`)).toHaveAttribute('required', '');
			}

			// And the steps are not steps: every fieldset open, in order, with
			// nothing to click between them and the submit button at the end.
			// This is the half of the form that has to keep working when the
			// other half does not arrive.
			const steps = noScript.locator('[data-step]');
			await expect(steps).toHaveCount(3);
			for (let i = 0; i < 3; i++) await expect(steps.nth(i)).toBeVisible();
			await expect(noScript.locator('#form-next')).toBeHidden();
			await expect(noScript.locator('#form-back')).toBeHidden();
			await expect(noScript.locator('#form-step-count')).toBeHidden();
			await expect(noScript.locator('#submit-btn')).toBeVisible();
			// Every field the handler reads is on the page at once, so a plain
			// POST carries all of them.
			for (const name of ['nume', 'email', 'subiect', 'proiect', 'acum', 'buget', 'cand', 'sursa']) {
				await expect(noScript.locator(`[name="${name}"]`)).toHaveCount(1);
			}

			await context.close();
		});
	});
}
