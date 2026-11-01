// A responsiveness pass over every page at twelve widths.
//
// Deliberately harder than scripts/probe.mjs, and in four ways it does not
// cover:
//
//   1. Width coverage. The repo probe runs five widths starting at 375. This
//      starts at 320, which is still a real phone, and ends at 1920.
//   2. Squeezed text. A box can be painted, inside the viewport, above
//      contrast and still be two pixels of content wide. That is a known blind
//      spot, written down twice and never measured until now.
//   3. Tap targets. A 14px link is a miss on a phone and nothing here checks.
//   4. Children out past their parent, which is the overflow that does not
//      reach the viewport edge and so never trips an overflow check. This
//      compared widths until 30 October and therefore missed the version of
//      it that matters most: a child narrower than its parent, laid out
//      beyond the parent's edge anyway.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Both the require below and the sitemap read further down were absolute
// paths to one laptop until 31 October 2026, so this script ran on that
// machine and nowhere else. On a Linux runner 'D:/dev/...' is not an
// absolute path, and createRequire refuses it before anything is measured.
// Derived from the script's own location now, the way probe.mjs next door
// already did it.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:4322';
const WIDTHS = [320, 360, 375, 414, 540, 768, 834, 1024, 1180, 1280, 1440, 1920];
const MOBILE = 540; // at or below this, tap targets are measured

const routes = fs
	.readFileSync(path.join(ROOT, 'dist', 'sitemap-0.xml'), 'utf8')
	.match(/<loc>[^<]+<\/loc>/g)
	.map((s) => new URL(s.slice(5, -6)).pathname)
	// Not in the sitemap, so they are named here. Both forms answer, but only
	// one without a redirect: /thank-you and /ro/multumesc are directories and
	// 308 to the slash, while /404 is 404.html and 308s the other way. Measured
	// 1 November 2026. Without this the run spends 24 redirects on 3 pages.
	.concat(['/thank-you/', '/ro/multumesc/', '/404'])
	.sort();

function audit(isMobile) {
	const out = { overflow: [], squeezed: [], taps: [], escapes: [], tiny: [] };
	const vw = document.documentElement.clientWidth;
	const SLOP = 1;

	const visible = (el) => {
		if (typeof el.checkVisibility === 'function') {
			return el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
		}
		const s = getComputedStyle(el);
		return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.01;
	};

	const where = (el) => {
		const id = el.id ? '#' + el.id : '';
		const cls = typeof el.className === 'string' && el.className.trim()
			? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
			: '';
		return el.tagName.toLowerCase() + id + cls;
	};

	const say = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);

	for (const el of document.querySelectorAll('body *')) {
		const style = getComputedStyle(el);
		if (style.position === 'fixed') continue;
		if (!visible(el)) continue;
		const r = el.getBoundingClientRect();
		if (r.width < 1 && r.height < 1) continue;

		// 1. Past the viewport edge, but only if it reaches into the viewport
		// at all: the honeypot input sits at -9999px on purpose.
		if (r.right > 0 && r.left < vw && (r.right > vw + SLOP || r.left < -SLOP)) {
			out.overflow.push(`${where(el)} ${Math.round(r.left)}..${Math.round(r.right)} in ${vw}`);
		}

		// 4. Out past the box that is supposed to contain it.
		//
		// This compared widths until 30 October, and a width is the wrong
		// question. A child narrower than its parent can still sit beyond the
		// parent's right edge, and seven of them did: a twelve-column grid
		// whose eleven 64px gaps needed 704px inside a 688px plate collapsed
		// every track to zero and laid the right-hand column out past its own
		// grid. At 768 the text ran off the screen on both audit pages. The
		// width check could not see it, because 320 inside 590 is not wider
		// than anything. Edges can see it, and edges are what a reader sees.
		//
		// A box parked entirely off-canvas is hidden, not escaping: the
		// honeypot field sits at left: -9999px on purpose, and measuring edges
		// rather than widths is what made it start to look like an escape. It
		// has to reach into the viewport before it can offend, which is the
		// same test the viewport check above already applies.
		const parent = el.parentElement;
		const onCanvas = r.right > 0 && r.left < vw;
		if (onCanvas && parent && parent !== document.body) {
			const pr = parent.getBoundingClientRect();
			const ps = getComputedStyle(parent);
			const clipped = ['hidden', 'clip', 'auto', 'scroll'].includes(ps.overflowX);
			const out_by = Math.max(r.right - pr.right, pr.left - r.left);
			if (!clipped && pr.width > 0 && out_by > 2) {
				out.escapes.push(
					`${where(el)} ${Math.round(r.left)}..${Math.round(r.right)} inside ${where(parent)} ${Math.round(pr.left)}..${Math.round(pr.right)}`
				);
			}
		}
	}

	// 2. Text with almost no room to be text in. Measured on leaf elements that
	// hold their own words, against a Range over those words.
	for (const el of document.querySelectorAll('p, h1, h2, h3, h4, li, dt, dd, span, a, label, legend, figcaption, summary, button')) {
		if (!visible(el)) continue;
		const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
		if (!own) continue;
		// .sr-only is a 1px box on purpose. It is not squeezed, it is hidden.
		if (el.closest('.sr-only')) continue;
		const r = el.getBoundingClientRect();
		if (r.width < 1) continue;
		const cs = getComputedStyle(el);
		const inner = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
		const size = parseFloat(cs.fontSize);
		// Four characters of room is the floor. Below that the box is a column
		// of single letters, which is unreadable at any contrast.
		if (inner < size * 2.2) {
			out.squeezed.push(`${where(el)} ${Math.round(inner)}px of room at ${Math.round(size)}px "${say(el)}"`);
		}
		if (size < 11.5 && say(el)) {
			out.tiny.push(`${where(el)} ${size.toFixed(1)}px "${say(el)}"`);
		}
	}

	// 3. Tap targets, phones only.
	if (isMobile) {
		for (const el of document.querySelectorAll('a[href], button, summary, input, select, textarea')) {
			if (!visible(el)) continue;
			const r = el.getBoundingClientRect();
			if (r.width < 1 || r.height < 1) continue;
			if (r.right <= 0 || r.left >= vw) continue;
			const display = getComputedStyle(el).display;
			const inline = display === 'inline' && el.closest('p, li, dd, h1, h2, h3');
			if (!inline && r.height < 24) {
				out.taps.push(`${where(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${say(el)}"`);
			}
		}
	}

	return out;
}

const browser = await chromium.launch();
const findings = new Map();
let checked = 0;

for (const width of WIDTHS) {
	const ctx = await browser.newContext({
		viewport: { width, height: 900 },
		reducedMotion: 'reduce',
	});
	const page = await ctx.newPage();
	for (const route of routes) {
		await page.goto(BASE + route, { waitUntil: 'load' });
		await page.evaluate(() => document.fonts.ready);
		// Every step of the contact form, not just the one on screen. The form
		// shows one of three and hides the rest, which would quietly take two
		// thirds of the fields on the only page with a form out of everything
		// below: no tap target measured, no squeezed label, no overflow. A
		// reader sees all three, one after another, so all three are measured.
		// Same reason this runs under reduced motion: the state a reader ends
		// up looking at is the state worth measuring.
		await page.evaluate(() => {
			for (const step of document.querySelectorAll('[data-step][hidden]')) {
				step.removeAttribute('hidden');
			}
		});
		const r = await page.evaluate(audit, width <= MOBILE);
		checked += 1;
		for (const kind of Object.keys(r)) {
			for (const line of r[kind]) {
				const key = `${kind}\u0000${line}`;
				if (!findings.has(key)) findings.set(key, { kind, line, routes: new Set(), widths: new Set() });
				findings.get(key).routes.add(route);
				findings.get(key).widths.add(width);
			}
		}
	}
	await ctx.close();
	process.stdout.write(`${width} `);
}
await browser.close();

console.log(`\n\n${routes.length} pages x ${WIDTHS.length} widths = ${checked} measurements\n`);

const LABEL = {
	overflow: 'PAST THE VIEWPORT EDGE',
	escapes: 'OUT PAST ITS PARENT',
	squeezed: 'TEXT WITH NO ROOM',
	taps: 'TAP TARGET UNDER 24px',
	tiny: 'TEXT UNDER 11.5px',
};

let total = 0;
const counts = {};
for (const kind of ['overflow', 'escapes', 'squeezed', 'taps', 'tiny']) {
	const rows = [...findings.values()].filter((f) => f.kind === kind);
	counts[kind] = rows.length;
	console.log(`${LABEL[kind]}: ${rows.length}`);
	for (const f of rows.slice(0, 14)) {
		const w = [...f.widths].sort((a, b) => a - b);
		const r = [...f.routes];
		console.log(
			`  ${f.line}\n      at ${w.join(', ')}  on ${r.length} page${r.length > 1 ? 's' : ''}` +
				(r.length <= 3 ? ` (${r.join(', ')})` : ` (e.g. ${r[0]})`)
		);
	}
	if (rows.length > 14) console.log(`  ... and ${rows.length - 14} more`);
	console.log('');
	total += rows.length;
}
console.log(total === 0 ? 'Nothing found.' : `${total} distinct findings.`);

// Three of the five categories are defects and two are not. `squeezed` is
// two-character labels that have exactly the room they need, and `tiny` is the
// .spec and .stamp label vocabulary, so both are reported and neither is an
// error. The other three have to be zero, which the runbook has said since this
// script was written and nothing enforced until now: on 31 October 2026 it found
// one element out past its parent on a Linux runner, printed it, and exited 0,
// so the CI step built around it could not fail on the one thing it is there to
// catch. probe.mjs next door has set exitCode since the day it was written.
const ENFORCED = ['overflow', 'escapes', 'taps'];
const broken = ENFORCED.filter((kind) => counts[kind] > 0);
if (broken.length > 0) {
	const named = broken.map((k) => `${LABEL[k]}: ${counts[k]}`).join(', ');
	console.log(`\n${named}`);
	console.log('These have to be zero. See docs/launch-checklist.md, section 2.');
	process.exitCode = 1;
}
