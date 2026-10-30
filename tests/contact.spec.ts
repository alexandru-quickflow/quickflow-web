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
 */

const PAGES = [
	{
		lang: 'en',
		path: '/contact',
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
		path: '/ro/contact',
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

for (const page of PAGES) {
	test.describe(`contact form, ${page.lang}`, () => {
		test('a successful submission hands the form over to the confirmation', async ({
			page: browserPage,
		}) => {
			const seen = await intercept(browserPage, (route) => json(route, 200, { ok: true }));
			await browserPage.goto(page.path);

			await browserPage.fill('#nume', 'Ana Test');
			await browserPage.fill('#email', 'ana@example.com');
			await browserPage.fill('#proiect', 'A marketplace with split payments.');
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
			expect(seen[0].fields.nume).toBe('Ana Test');
			expect(seen[0].fields.email).toBe('ana@example.com');
			// The hidden locale field is what sends the visitor to the
			// thank-you page in their own language, and it has been wrong
			// before.
			expect(seen[0].fields.locale).toBe(page.lang);
			// The honeypot is submitted and has to be empty, or every real
			// submission looks like a bot to the handler.
			expect(seen[0].fields.website ?? '').toBe('');
		});

		test('empty required fields come back onto the fields themselves', async ({
			page: browserPage,
		}) => {
			await intercept(browserPage, (route) => json(route, 400, { fields: page.errors }));
			await browserPage.goto(page.path);

			await browserPage.click('#submit-btn');

			for (const [field, message] of Object.entries(page.errors)) {
				const error = browserPage.locator(`#error-${field}`);
				await expect(error).toBeVisible();
				await expect(error).toHaveText(message);
				// Tied to the input, not merely sitting under it. Without this
				// the message is read out to nobody.
				await expect(browserPage.locator(`#${field}`)).toHaveAttribute(
					'aria-describedby',
					`error-${field}`
				);
				await expect(browserPage.locator(`#${field}`)).toHaveAttribute('aria-invalid', 'true');
			}

			// Focus lands on the first field that needs fixing, and the form is
			// still there to fix it in.
			await expect(browserPage.locator('#nume')).toBeFocused();
			await expect(browserPage.locator('#contact-form')).toBeVisible();
			await expect(browserPage.locator('#form-success')).toBeHidden();
		});

		test('a second try clears the errors it fixed', async ({ page: browserPage }) => {
			let answer = 0;
			await intercept(browserPage, (route) =>
				answer++ === 0 ? json(route, 400, { fields: page.errors }) : json(route, 200, { ok: true })
			);
			await browserPage.goto(page.path);

			await browserPage.click('#submit-btn');
			await expect(browserPage.locator('#error-nume')).toBeVisible();

			await browserPage.fill('#nume', 'Ana Test');
			await browserPage.fill('#email', 'ana@example.com');
			await browserPage.fill('#proiect', 'A marketplace with split payments.');
			await browserPage.click('#submit-btn');

			await expect(browserPage.locator('#form-success')).toBeVisible();
			await expect(browserPage.locator('#error-nume')).toBeHidden();
			// aria-invalid has to come off too, or the field stays wrong to a
			// screen reader after it has been fixed.
			await expect(browserPage.locator('#nume')).not.toHaveAttribute('aria-invalid', 'true');
		});

		test('a send that fails says so out loud', async ({ page: browserPage }) => {
			await intercept(browserPage, (route) => json(route, 502, { message: page.serviceDown }));
			await browserPage.goto(page.path);

			await browserPage.fill('#nume', 'Ana Test');
			await browserPage.fill('#email', 'ana@example.com');
			await browserPage.fill('#proiect', 'A marketplace with split payments.');
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

			await context.close();
		});
	});
}
