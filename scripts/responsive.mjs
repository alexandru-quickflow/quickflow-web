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
//   4. Children wider than their parent, which is the overflow that does not
//      reach the viewport edge and so never trips an overflow check.
import { createRequire } from 'node:module';
const require = createRequire('D:/dev/quickflow-web/package.json');
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:4322';
const WIDTHS = [320, 360, 375, 414, 540, 768, 834, 1024, 1180, 1280, 1440, 1920];
const MOBILE = 540; // at or below this, tap targets are measured

const routes = fs
	.readFileSync('D:/dev/quickflow-web/dist/sitemap-0.xml', 'utf8')
	.match(/<loc>[^<]+<\/loc>/g)
	.map((s) => new URL(s.slice(5, -6)).pathname)
	.concat(['/thank-you', '/ro/multumesc', '/404'])
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

		// 4. Wider than the box that is supposed to contain it.
		const parent = el.parentElement;
		if (parent && parent !== document.body) {
			const pr = parent.getBoundingClientRect();
			const ps = getComputedStyle(parent);
			const clipped = ['hidden', 'clip', 'auto', 'scroll'].includes(ps.overflowX);
			if (!clipped && pr.width > 0 && r.width - pr.width > 2) {
				out.escapes.push(`${where(el)} ${Math.round(r.width)} inside ${where(parent)} ${Math.round(pr.width)}`);
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
	escapes: 'WIDER THAN ITS PARENT',
	squeezed: 'TEXT WITH NO ROOM',
	taps: 'TAP TARGET UNDER 24px',
	tiny: 'TEXT UNDER 11.5px',
};

let total = 0;
for (const kind of ['overflow', 'escapes', 'squeezed', 'taps', 'tiny']) {
	const rows = [...findings.values()].filter((f) => f.kind === kind);
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
