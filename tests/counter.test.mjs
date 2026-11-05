import test from 'node:test';
import assert from 'node:assert/strict';

import { describe, onRequest } from '../functions/_middleware.ts';

/**
 * The page view counter. Two promises are checked here: it writes nothing a
 * privacy page would have to own up to, and it can never cost a page.
 */

const CHROME =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function req(path, headers = {}, method = 'GET') {
	return new Request(`https://quickflow.dev${path}`, { method, headers });
}

test('a browser opening a page is counted with only the agreed fields', () => {
	const point = describe(
		req('/ro/contact/?utm_source=linkedin', {
			'user-agent': IPHONE,
			'sec-fetch-mode': 'navigate',
			referer: 'https://www.google.com/search?q=quick+flow+private+terms',
			'cf-connecting-ip': '203.0.113.7',
		}),
		200,
		'RO',
	);
	assert.deepEqual(point.blobs, ['/ro/contact/', 'google.com', 'RO', 'mobile', 'browser', '200', 'linkedin']);
	const written = JSON.stringify(point);
	assert.ok(!written.includes('203.0.113.7'), 'no IP address');
	assert.ok(!written.includes('private'), 'no search terms from the referrer');
	assert.ok(!written.includes('iPhone OS'), 'no user agent string');
});

test('same-site navigation and direct visits are told apart', () => {
	const inside = describe(req('/work/', { 'user-agent': CHROME, referer: 'https://quickflow.dev/' }), 200);
	const direct = describe(req('/work/', { 'user-agent': CHROME }), 200);
	assert.equal(inside.blobs[1], '(internal)');
	assert.equal(direct.blobs[1], '(direct)');
});

test('robots are labelled, not dropped', () => {
	assert.equal(describe(req('/', { 'user-agent': 'curl/8.9.1' }), 200).blobs[4], 'robot');
	assert.equal(describe(req('/', {}), 200).blobs[4], 'robot');
	assert.equal(describe(req('/', { 'user-agent': CHROME }), 200).blobs[4], 'unsure');
});

test('files, the form endpoint and non-GET requests are not page views', () => {
	assert.equal(describe(req('/work/shot.webp', { 'user-agent': CHROME }), 200), null);
	assert.equal(describe(req('/sitemap.xml', { 'user-agent': CHROME }), 301), null);
	assert.equal(describe(req('/api/contact', { 'user-agent': CHROME }), 405), null);
	assert.equal(describe(req('/', { 'user-agent': CHROME }, 'POST'), 200), null);
});

test('a broken dataset loses the count and keeps the page', async () => {
	const page = new Response('<h1>ok</h1>', { status: 200 });
	const response = await onRequest({
		request: req('/', { 'user-agent': CHROME }),
		env: {
			PAGEVIEWS: {
				writeDataPoint() {
					throw new Error('dataset down');
				},
			},
		},
		next: async () => page,
	});
	assert.equal(response, page);
});

test('with no dataset bound the site behaves as before', async () => {
	const page = new Response('ok');
	const response = await onRequest({ request: req('/'), env: {}, next: async () => page });
	assert.equal(response, page);
});
