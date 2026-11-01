import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/contact.ts';

/**
 * The handler's own side of the contact form.
 *
 * tests/contact.spec.ts checks what the page does with an answer. This checks
 * which answer it gets, and in particular who receives email, which is the one
 * decision in this repository that can put a message in a stranger's inbox.
 *
 * It is here rather than in the Playwright spec because `astro preview` serves
 * the static build and does not run Cloudflare Pages Functions, so the only
 * way to reach this file without adding wrangler to the project is to call it.
 * Node runs the TypeScript directly, so there is no build step and no second
 * test framework: `node --test`, which ADR-0005's "no Vitest" leaves open.
 *
 * `fetch` is replaced for the duration, so nothing leaves the machine and both
 * Turnstile verdicts can be asked for on demand.
 */

const ENV = { RESEND_API_KEY: 'test-key', TURNSTILE_SECRET_KEY: 'test-secret' };
const OWNER = 'alexandru@quickflow.dev';
const VISITOR = 'vizitator@example.com';

let sent = [];
let turnstilePasses = true;

const realFetch = globalThis.fetch;

test.before(() => {
	globalThis.fetch = async (url, init) => {
		if (String(url).includes('challenges.cloudflare.com')) {
			return new Response(JSON.stringify({ success: turnstilePasses }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}
		if (String(url).includes('api.resend.com')) {
			sent.push(JSON.parse(init.body));
			return new Response('{}', { status: 200 });
		}
		throw new Error(`the handler reached for ${url}, which no test expects`);
	};
});

test.after(() => {
	globalThis.fetch = realFetch;
});

test.beforeEach(() => {
	sent = [];
	turnstilePasses = true;
});

/** A complete, valid submission, minus whatever a test takes out of it. */
function submission(extra = {}) {
	const form = new FormData();
	const fields = {
		locale: 'ro',
		nume: 'Ana Test',
		email: VISITOR,
		proiect: 'Un marketplace cu plati impartite.',
		subiect: 'Marketplace cu plăți',
		buget: 'Sub 2.000 EUR',
		cand: 'Cât mai repede',
		...extra,
	};
	for (const [name, value] of Object.entries(fields)) {
		if (value !== null) form.append(name, value);
	}
	return form;
}

async function post(form, { json = true } = {}) {
	const res = await onRequestPost({
		request: new Request('https://quickflow.dev/api/contact', {
			method: 'POST',
			headers: json ? { Accept: 'application/json' } : {},
			body: form,
		}),
		env: ENV,
	});
	return { status: res.status, res, to: sent.map((mail) => mail.to) };
}

test('a verified submission reaches the owner and comes back to the visitor', async () => {
	const { status, to } = await post(submission({ 'cf-turnstile-response': 'a-good-token' }));
	assert.equal(status, 200);
	assert.deepEqual(to, [OWNER, VISITOR]);
});

test('a submission carrying no token at all sends nothing', async () => {
	// This test asserted the opposite until 1 November 2026, when a post to the
	// live endpoint with the field left out came back 200 and delivered mail.
	// Leaving the field out is what a script does, not what a browser does, so
	// it was the one way in that never met Turnstile. The secret is set in ENV,
	// which makes a missing token a failed check rather than an absent one.
	const { status, to } = await post(submission());
	assert.equal(status, 400);
	assert.deepEqual(to, []);
});

test('with no secret configured the check is absent rather than failed', async () => {
	// Local development, where the handler has nothing to verify against. The
	// submission goes through and the visitor gets no copy of it, because
	// nothing proved there was a visitor.
	const res = await onRequestPost({
		request: new Request('https://quickflow.dev/api/contact', {
			method: 'POST',
			headers: { Accept: 'application/json' },
			body: submission(),
		}),
		env: { RESEND_API_KEY: 'test-key' },
	});
	assert.equal(res.status, 200);
	assert.deepEqual(
		sent.map((mail) => mail.to),
		[OWNER]
	);
});

test('a token that does not verify sends nothing at all', async () => {
	turnstilePasses = false;
	const { status, to } = await post(submission({ 'cf-turnstile-response': 'a-bad-token' }));
	assert.equal(status, 400);
	assert.deepEqual(to, []);
});

test('empty required fields come back named, and no mail moves', async () => {
	const form = submission({ nume: null, email: null, proiect: null });
	const { status, res, to } = await post(form);
	assert.equal(status, 400);
	assert.deepEqual(to, []);
	const body = await res.json();
	assert.deepEqual(Object.keys(body.fields).sort(), ['email', 'nume', 'proiect']);
	for (const message of Object.values(body.fields)) {
		assert.ok(message.length > 0, 'every named field needs something to say');
	}
});

test('an address that is not an address is refused', async () => {
	const { status, res } = await post(submission({ email: 'ana at example dot com' }));
	assert.equal(status, 400);
	const body = await res.json();
	assert.ok(body.fields.email, 'the email field is the one that should complain');
	assert.ok(!body.fields.nume, 'and it should be the only one');
});

test('the honeypot answers as if it worked and sends nothing', async () => {
	// Whoever wrote the bot must not learn why their mail stopped arriving.
	const { status, to } = await post(
		submission({ website: 'http://spam.example', 'cf-turnstile-response': 'a-good-token' })
	);
	assert.equal(status, 200);
	assert.deepEqual(to, []);
});

// The two below are about which answer a non-JSON caller gets, not about the
// check, so they carry a token that verifies. Without one they now stop at the
// refusal and never reach the redirect they exist to assert.
test('a form post with no Accept header is redirected, not answered in JSON', async () => {
	const { status, res, to } = await post(submission({ 'cf-turnstile-response': 'a-good-token' }), {
		json: false,
	});
	assert.equal(status, 303);
	assert.equal(new URL(res.headers.get('location')).pathname, '/ro/multumesc/');
	assert.deepEqual(to, [OWNER, VISITOR]);
});

test('the locale decides the thank-you page, and only the two known ones count', async () => {
	const english = await post(
		submission({ locale: 'en', 'cf-turnstile-response': 'a-good-token' }),
		{ json: false }
	);
	assert.equal(new URL(english.res.headers.get('location')).pathname, '/thank-you/');

	// A locale is never trusted as a path, so an injected one falls back to
	// English rather than turning the redirect into an open one.
	sent = [];
	const hostile = await post(
		submission({ locale: 'https://example.com/', 'cf-turnstile-response': 'a-good-token' }),
		{ json: false }
	);
	assert.equal(new URL(hostile.res.headers.get('location')).pathname, '/thank-you/');
});

test('with no Resend key the request fails loudly instead of quietly', async () => {
	const res = await onRequestPost({
		request: new Request('https://quickflow.dev/api/contact', {
			method: 'POST',
			headers: { Accept: 'application/json' },
			body: submission({ 'cf-turnstile-response': 'a-good-token' }),
		}),
		env: { RESEND_API_KEY: '', TURNSTILE_SECRET_KEY: 'test-secret' },
	});
	assert.equal(res.status, 422);
	assert.deepEqual(sent, []);
});
