/**
 * Loads every built page in a real browser and measures what looking cannot see:
 * text contrast, horizontal overflow, rules drawn wider than the text they
 * underline, and whether the two languages still carry the same number of
 * elements.
 *
 * Why this exists. Every design defect on this project was found by measuring,
 * never by looking. The bar chart carrying the migration page's central claim
 * was drawn in ink on an ink ground, measured 1.0:1, and two review passes had
 * called the page fine. A code block inside a grid child ran the page 493px wide
 * inside a 375px phone, and `overflow-x: clip` on body hid it out of reach
 * instead of showing a scrollbar. The two languages drifted twice, the second
 * time by one element, caught only by comparing counts.
 *
 * How it measures colour. Tailwind v4 emits `oklab()` for any colour with an
 * opacity modifier, so a probe that parses `rgb(` strings lies in both
 * directions: it reported three failures on this site that did not exist. Here
 * every colour is painted onto a canvas and read back as a pixel, which is the
 * compositor's own answer, and the alpha stack is composited in order from the
 * page ground down to the text, so `text-paper/70` is measured where it sits
 * rather than where it was declared.
 *
 * It runs under `prefers-reduced-motion: reduce`, deliberately. Every reveal on
 * this site starts at `opacity: 0` and is brought in by a view timeline, so on
 * an unscrolled page most of the text is legitimately invisible and nothing
 * below the fold can be measured. Reduced motion turns the whole motion block
 * off and leaves every element in its final state, which is the state a reader
 * ends up looking at.
 *
 * Not covered, on purpose: the grain and the glow behind the page. Both sit
 * under the text and both lighten the near-black ground, so ignoring them
 * understates contrast for light text rather than overstating it.
 *
 *     npm run build
 *     npx astro preview &            # or any server for dist/
 *     node scripts/probe.mjs
 *
 * Options:
 *     --base http://localhost:4322   where dist/ is being served
 *     --widths 375,1440              viewport widths to measure, in px
 *     --no-self-test                 skip the check that the probe still fails
 *     --no-motion                    skip the scroll-driven animation pass
 *
 * The self-test is the point of the first run. Before any number here is
 * trusted, the probe is pointed at two defects built on purpose, one invisible
 * and one too wide, and it has to report both. A check nobody has seen fail is
 * not a check.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? fallback : args[i + 1];
};

const BASE = (flag('base', 'http://localhost:4322') ?? '').replace(/\/+$/, '');
const WIDTHS = String(flag('widths', '375,1440'))
	.split(',')
	.map((w) => Number(w.trim()))
	.filter((w) => w > 0);
const SELF_TEST = !args.includes('--no-self-test');
const MOTION = !args.includes('--no-motion');

/* Routes ------------------------------------------------------------------
 * Read out of src/i18n/routes.ts rather than listed here, so a page that moves
 * cannot leave this script measuring a 404 and reporting it as a pass. The file
 * is TypeScript and this is not, so the one object we need is pulled out with a
 * regex and the shape is checked straight after. */

function readRoutes() {
	const src = fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'routes.ts'), 'utf8');
	const block = src.match(/export const paths[^=]*=\s*\{([\s\S]*?)\n\};/);
	if (!block) throw new Error('routes.ts: could not find the paths map');

	const pairs = [];
	const entry = /(\w+):\s*\{\s*en:\s*'([^']+)',\s*ro:\s*'([^']+)',?\s*\}/g;
	for (const m of block[1].matchAll(entry)) pairs.push({ id: m[1], en: m[2], ro: m[3] });
	if (pairs.length === 0) throw new Error('routes.ts: the paths map parsed to nothing');
	return pairs;
}

/* The page audit ----------------------------------------------------------
 * Everything below runs inside the browser. It takes no arguments it could get
 * wrong and returns plain data. */

function audit() {
	const AA_NORMAL = 4.5;
	const AA_LARGE = 3;
	const SLOP = 1; // px of subpixel tolerance before a rect counts as overflowing

	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });

	/* Paint a stack of CSS colours over each other and read the pixel back.
	   The canvas does the parsing, so oklab(), colour-mix and anything else the
	   browser accepts resolves the way the compositor resolves it. */
	function composite(layers) {
		ctx.clearRect(0, 0, 1, 1);
		for (const colour of layers) {
			ctx.fillStyle = '#000';
			ctx.fillStyle = colour;
			ctx.fillRect(0, 0, 1, 1);
		}
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	}

	function luminance([r, g, b]) {
		const channel = (v) => {
			const s = v / 255;
			return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		};
		return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
	}

	function ratio(fg, bg) {
		const a = luminance(fg);
		const b = luminance(bg);
		return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
	}

	const transparent = (c) => !c || c === 'transparent' || /,\s*0\s*\)$/.test(c);

	/* A gradient counts as a background only when it actually covers the box.
	   `.link` draws its underline as a linear-gradient of currentColor sized
	   100% by 1px: treating that as the background would measure the text
	   against itself and report 1.0:1 on every link on the site. */
	function gradientStops(style) {
		const image = style.backgroundImage;
		if (!image || image === 'none' || !/gradient\(/.test(image)) return [];
		const size = style.backgroundSize;
		const covers =
			size === 'auto' ||
			size === 'auto auto' ||
			size === 'cover' ||
			size === 'contain' ||
			size === '100% 100%';
		if (!covers) return [];
		const found = image.match(/(?:rgba?|oklab|oklch|lab|lch|color|hsla?)\([^()]*\)/g) ?? [];
		return found.filter((c) => !transparent(c)).slice(0, 4);
	}

	/* The stack of surfaces behind one element, outermost first, plus the
	   cumulative opacity of its ancestors. A gradient fans the stack out into
	   several candidates and the worst one is the one that gets reported. */
	function backgroundsBehind(el) {
		const chain = [];
		for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
			chain.unshift(node);
		}

		const root = getComputedStyle(document.documentElement);
		const body = getComputedStyle(document.body);
		const ground = !transparent(root.backgroundColor)
			? root.backgroundColor
			: !transparent(body.backgroundColor)
				? body.backgroundColor
				: '#ffffff';

		let stacks = [[ground]];
		let opacity = 1;

		for (const node of chain) {
			const style = getComputedStyle(node);
			opacity *= Number(style.opacity === '' ? 1 : style.opacity);

			const layers = [];
			if (!transparent(style.backgroundColor)) layers.push(style.backgroundColor);
			const stops = gradientStops(style);

			if (stops.length > 0) {
				const fanned = [];
				for (const stack of stacks) {
					for (const stop of stops) fanned.push([...stack, ...layers, stop]);
				}
				stacks = fanned.slice(0, 8);
			} else if (layers.length > 0) {
				stacks = stacks.map((stack) => [...stack, ...layers]);
			}
		}

		return { stacks, opacity };
	}

	function describe(el) {
		const id = el.id ? `#${el.id}` : '';
		const cls =
			typeof el.className === 'string' && el.className.trim()
				? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
				: '';
		return `${el.tagName.toLowerCase()}${id}${cls}`;
	}

	/* Whether the browser actually paints this, which is not the same question
	   as whether it has a box. The mobile menu is a closed <details> holding an
	   absolutely positioned panel: the panel keeps a 240 by 227 rect and
	   reports display block, visibility visible, opacity 1, while Chromium
	   skips painting and hit-testing it entirely. Measuring by rect counted
	   four links nobody can see, and counted them only sometimes, which is
	   worse: the language-pair check exists to catch a drift of one element,
	   so a measurement that wobbles by one is not a measurement. */
	function painted(el) {
		if (typeof el.checkVisibility !== 'function') {
			const s = getComputedStyle(el);
			return s.display !== 'none' && s.visibility !== 'hidden';
		}
		return el.checkVisibility({
			contentVisibilityAuto: true,
			opacityProperty: true,
			visibilityProperty: true,
		});
	}

	/* Elements that carry text of their own. A paragraph counts, the section
	   that holds it does not, so one string is measured once. */
	function textElements() {
		const out = [];
		for (const el of document.querySelectorAll('body *')) {
			const tag = el.tagName;
			if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') {
				continue;
			}
			let text = '';
			for (const node of el.childNodes) {
				if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue;
			}
			if (!text.trim()) continue;

			const style = getComputedStyle(el);
			if (!painted(el)) continue;
			const rect = el.getBoundingClientRect();
			if (rect.width < 1 || rect.height < 1) continue;

			out.push({ el, text: text.trim(), style, rect });
		}
		return out;
	}

	/* A filter on an ancestor makes every number below it a lie. The style
	   says one colour, the compositor paints another, and the gap between the
	   two is invisible to a probe that only reads styles. Eighteen sections of
	   this site rendered as a photographic negative under
	   `filter: invert(100%)`, inherited from a Tailwind utility whose name
	   collided with a component class. Contrast measured clean the whole time,
	   while the safe colour painted as the alarm colour. So a filter over text
	   is reported rather than measured through. */
	const filtered = [];
	for (const el of document.querySelectorAll('body *')) {
		const style = getComputedStyle(el);
		if (!style.filter || style.filter === 'none') continue;
		if (!painted(el)) continue;
		const rect = el.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) continue;
		// A filter on a leaf is a graphic effect. A filter on a box that holds
		// text is the case worth knowing about.
		if (el.querySelectorAll('p, h1, h2, h3, h4, li, td, a').length === 0) continue;
		filtered.push({ where: describe(el), filter: style.filter });
	}

	const failures = [];
	const carriers = textElements();

	for (const { el, text, style } of carriers) {
		const size = Number.parseFloat(style.fontSize);
		const weight = Number(style.fontWeight) || 400;
		const large = size >= 24 || (size >= 18.66 && weight >= 700);
		const threshold = large ? AA_LARGE : AA_NORMAL;

		const { stacks, opacity } = backgroundsBehind(el);
		if (opacity === 0) continue; // deliberately not rendered

		let worst = Infinity;
		let on = '';
		for (const stack of stacks) {
			const bg = composite(stack);
			const fg = composite([...stack, style.color]);
			const r = ratio(fg, bg);
			if (r < worst) {
				worst = r;
				on = stack[stack.length - 1];
			}
		}

		if (worst + 0.05 < threshold) {
			failures.push({
				where: describe(el),
				text: text.slice(0, 48),
				ratio: Math.round(worst * 100) / 100,
				need: threshold,
				colour: style.color,
				on,
				size: Math.round(size * 10) / 10,
			});
		}
	}

	/* Overflow. The document's own scrollWidth is not enough on its own: body
	   is `overflow-x: clip`, which hides the overflow without creating a
	   scroller, so a box 493px wide inside a 375px phone leaves scrollWidth
	   looking innocent. The rects are what tell the truth. */
	const vw = document.documentElement.clientWidth;
	const over = [];
	for (const el of document.querySelectorAll('body *')) {
		const style = getComputedStyle(el);
		if (!painted(el)) continue;
		if (style.position === 'fixed') continue; // the fixed layers are decoration
		const rect = el.getBoundingClientRect();
		if (rect.width < 1) continue;
		// A box parked entirely off-canvas is hidden, not overflowing: the
		// honeypot field on the contact form sits at left: -9999px on purpose,
		// and a probe that calls that an overflow cries wolf on every run.
		// Overflow is a box that reaches into the viewport and then past its
		// edge, so it has to intersect before it can offend.
		if (rect.right <= 0 || rect.left >= vw) continue;
		if (rect.right > vw + SLOP || rect.left < -SLOP) {
			over.push({
				where: describe(el),
				left: Math.round(rect.left),
				right: Math.round(rect.right),
				width: Math.round(rect.width),
			});
		}
	}

	/* A rule wider than the text it underlines. `.link` paints its underline
	   with a background image sized to 100% of the box, so an anchor that a
	   flex or grid parent has blockified draws that line across the whole
	   track. Both portfolio pages carried six each: an 80px label with a 584px
	   rule under it. Nothing already here could see it. The box is painted, it
	   is inside the viewport, its text passes contrast, and it does not
	   overflow anything. It took a person looking at the page. */
	const stretched = [];
	for (const el of document.querySelectorAll('.link')) {
		if (!painted(el)) continue;
		const box = el.getBoundingClientRect();
		if (box.width < 1) continue;
		const range = document.createRange();
		range.selectNodeContents(el);
		const text = range.getBoundingClientRect();
		// A wrapped link is legitimately wider than its last line, so the
		// comparison is against the range, which measures every line.
		if (text.width > 0 && box.width - text.width > 24) {
			stretched.push({
				where: describe(el),
				box: Math.round(box.width),
				text: Math.round(text.width),
			});
		}
	}

	return {
		elements: carriers.length,
		failures,
		filtered,
		overflow: over.slice(0, 12),
		overflowCount: over.length,
		stretched: stretched.slice(0, 12),
		stretchedCount: stretched.length,
		scrollWidth: document.scrollingElement.scrollWidth,
		viewport: vw,
	};
}

/* The self-test -----------------------------------------------------------
 * Two defects built on purpose, one invisible and one too wide. The probe has
 * to report both, or every number it prints afterwards is worthless. */

async function selfTest(page, base) {
	await page.goto(`${base}/`, { waitUntil: 'load' });
	const broken = await page.evaluate(() => {
		const ground = getComputedStyle(document.body).backgroundColor;
		const sink = document.createElement('div');
		sink.id = 'probe-self-test';
		sink.innerHTML = `
			<p id="probe-invisible">A claim nobody can read</p>
			<div id="probe-wide"></div>
			<div id="probe-column" style="display:flex;flex-direction:column;width:400px">
				<a id="probe-stretched" class="link" href="#">short</a>
			</div>`;
		document.body.append(sink);
		const invisible = document.getElementById('probe-invisible');
		invisible.style.color = ground;
		invisible.style.backgroundColor = ground;
		const wide = document.getElementById('probe-wide');
		wide.style.width = '493px';
		wide.style.height = '20px';
		return true;
	});
	if (!broken) throw new Error('self-test: could not plant the defects');

	const result = await page.evaluate(audit);
	const sawInvisible = result.failures.some((f) => f.where.includes('probe-invisible'));
	const sawWide = result.overflow.some((o) => o.where.includes('probe-wide'));
	const sawStretched = result.stretched.some((o) => o.where.includes('probe-stretched'));

	await page.evaluate(() => document.getElementById('probe-self-test')?.remove());

	const missed = [];
	if (!sawInvisible) missed.push('the invisible paragraph');
	if (!sawWide) missed.push('the 493px box');
	if (!sawStretched) missed.push('the stretched link');
	if (missed.length > 0) {
		throw new Error(
			`self-test: the probe did not report ${missed.join(' or ')}. ` +
				'Fix the probe before trusting anything it says.'
		);
	}
	return result.failures.length;
}

/* Motion -----------------------------------------------------------------
 * Two failures this catches, both of which have happened here and neither of
 * which showed up as an error anywhere.
 *
 * The first is a scroll-driven animation that is not running at all. Lightning
 * CSS once folded `animation` and `animation-timeline` into a shorthand no
 * browser accepts, and every reveal on the site was dead in the production
 * build for days while the development build was fine.
 *
 * The second is subtler and was found by measuring rather than looking: an
 * animation that runs correctly and finishes where nobody can see it. A view
 * timeline's `entry` range is exactly as long as the subject, so on a line of
 * text it is twenty pixels of scrolling, spent while the line is still below
 * the fold. The animation reports progress 1, the stylesheet is correct, and
 * the reader sees nothing move.
 *
 * So the page is scrolled from top to bottom and each animated element is
 * watched. One that is never caught mid-flight while its subject is on screen
 * is reported, because that is motion the site is paying for and not getting.
 */

async function motion(page, base, url) {
	await page.goto(`${base}${url}`, { waitUntil: 'load' });
	await page.evaluate(() => document.fonts.ready);
	// The inertial scroller animates to a target rather than jumping, so each
	// step has to be allowed to land before anything is read off the page.
	const settle = 420;

	const supported = await page.evaluate(() => CSS.supports('animation-timeline', 'view()'));
	if (!supported) return { skipped: true };

	await page.evaluate(() => {
		window.__seen = new Map();
		window.__tick = () => {
			const vh = document.documentElement.clientHeight;
			for (const a of document.getAnimations()) {
				if (!a.timeline || a.timeline === document.timeline) continue;
				const subject = a.timeline.subject ?? a.effect?.target;
				if (!subject) continue;
				const key = `${a.animationName}  ${subject.tagName.toLowerCase()}${
					typeof subject.className === 'string' && subject.className.trim()
						? '.' + subject.className.trim().split(/\s+/)[0]
						: ''
				}`;
				const seen = window.__seen.get(key) ?? { total: 0, onScreen: 0 };
				seen.total += 1;
				const p = a.effect.getComputedTiming().progress;
				const top = subject.getBoundingClientRect().top;
				if (p !== null && p > 0.02 && p < 0.98 && top > -40 && top < vh) seen.onScreen += 1;
				window.__seen.set(key, seen);
			}
		};
	});

	const height = await page.evaluate(() => document.scrollingElement.scrollHeight);
	// Two sweeps, not one. The coarse pass covers the page in 120px steps; the
	// fine pass covers the first 240 in 30s. An animation whose active range is
	// shorter than the step is invisible to a sampler that never lands inside
	// it, and that is not a hypothetical: the sticky header's ground runs over
	// 90 pixels of scroll(root) and the coarse pass stepped from 0 straight to
	// 120, reading progress 0 and then 1 and never anything between. It was
	// reported as an animation that never runs. Short ranges live at the top of
	// the document, which is why the fine pass is where it is.
	const stops = new Set();
	for (let y = 0; y <= 240; y += 30) stops.add(y);
	for (let y = 0; y < height; y += 120) stops.add(y);
	for (const y of [...stops].sort((a, b) => a - b)) {
		await page.evaluate((to) => window.scrollTo(0, to), y);
		await page.waitForTimeout(settle);
		await page.evaluate(() => window.__tick());
	}

	return page.evaluate(() => {
		const live = [];
		const unseen = [];
		for (const [key, v] of window.__seen) {
			(v.onScreen > 0 ? live : unseen).push(key);
		}
		return { live: live.length, unseen };
	});
}

/* The run ----------------------------------------------------------------- */

const pad = (s, n) => String(s).padEnd(n);

async function main() {
	const pairs = readRoutes();
	const routes = [];
	for (const pair of pairs) {
		routes.push({ id: pair.id, locale: 'en', url: pair.en });
		routes.push({ id: pair.id, locale: 'ro', url: pair.ro });
	}
	routes.push({ id: '404', locale: 'en', url: '/404' });

	const browser = await chromium.launch();
	const context = await browser.newContext({
		// Every reveal on this site starts at opacity 0 and is brought in by a
		// view timeline. Reduced motion turns that block off and leaves the page
		// in the state a reader ends up looking at.
		reducedMotion: 'reduce',
		viewport: { width: WIDTHS[0], height: 812 },
		deviceScaleFactor: 1,
	});
	const page = await context.newPage();

	const problems = [];

	try {
		if (SELF_TEST) {
			// The count is contrast failures on the page the defects were
			// planted in, which is one: the invisible paragraph. It used to be
			// printed as "(1 failures on a page with them)" right after the
			// word "three", which reads like the probe caught one of three.
			// It caught all three or selfTest would have thrown.
			const failures = await selfTest(page, BASE);
			console.log(
				`self-test  all three planted defects caught: the invisible paragraph, ` +
					`the 493px box and the stretched rule. ` +
					`${failures} contrast failure${failures === 1 ? '' : 's'} on that page, as expected\n`
			);
		}

		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: 812 });
			console.log(`${width}px`);
			console.log(`  ${pad('page', 38)} ${pad('elements', 9)} contrast  overflow`);

			const counts = new Map();

			for (const route of routes) {
				const response = await page.goto(`${BASE}${route.url}`, { waitUntil: 'load' });
				const status = response?.status() ?? 0;
				if (status >= 400 && route.id !== '404') {
					problems.push(`${route.url} answered ${status}`);
				}
				// The stylesheet is what is being measured, so wait for the fonts
				// rather than for the network: a fallback face has different
				// metrics and reports overflow that the real face does not.
				await page.evaluate(() => document.fonts.ready);

				const result = await page.evaluate(audit);
				counts.set(`${route.id}:${route.locale}`, result.elements);

				const contrastCell =
					result.failures.length === 0 ? 'ok' : `${result.failures.length} FAIL`;
				const overflowCell =
					result.overflowCount === 0 ? 'ok' : `${result.overflowCount} FAIL`;
				console.log(
					`  ${pad(route.url, 38)} ${pad(result.elements, 9)} ${pad(contrastCell, 9)} ${overflowCell}`
				);

				for (const f of result.failures) {
					problems.push(
						`${width}px ${route.url}  ${f.ratio}:1 needs ${f.need}:1  ` +
							`${f.where} at ${f.size}px  ${f.colour} on ${f.on}  "${f.text}"`
					);
				}
				for (const f of result.stretched) {
					problems.push(
						`${width}px ${route.url}  ${f.where} draws a ${f.box}px rule ` +
							`under ${f.text}px of text`
					);
				}
				for (const f of result.filtered) {
					problems.push(
						`${width}px ${route.url}  ${f.where} paints through ${f.filter}, ` +
							'so no colour measured inside it is the colour on screen'
					);
				}
				for (const o of result.overflow) {
					problems.push(
						`${width}px ${route.url}  ${o.where} spans ${o.left} to ${o.right} ` +
							`(${o.width}px) in a ${result.viewport}px viewport`
					);
				}
			}

			console.log('');
			let drift = 0;
			for (const pair of pairs) {
				const en = counts.get(`${pair.id}:en`);
				const ro = counts.get(`${pair.id}:ro`);
				if (en !== ro) {
					drift += 1;
					problems.push(`${width}px ${pair.id}: en has ${en} text elements, ro has ${ro}`);
				}
			}
			const total = [...counts.values()].reduce((a, b) => a + b, 0);
			console.log(
				`  ${routes.length} pages, ${total} text elements, ` +
					`${pairs.length - drift} of ${pairs.length} language pairs matching\n`
			);
		}
		/* Motion runs on its own page, because this one needs the animations
		   switched on and everything above needs them switched off. */
		if (MOTION) {
			const motionContext = await browser.newContext({
				reducedMotion: 'no-preference',
				viewport: { width: 1440, height: 900 },
			});
			const motionPage = await motionContext.newPage();
			for (const url of ['/', '/services/bubble-to-code-migration']) {
				const result = await motion(motionPage, BASE, url);
				if (result.skipped) {
					console.log(`motion     ${url}: this browser has no view timelines, not measured\n`);
					continue;
				}
				console.log(
					`motion     ${url}: ${result.live} animations caught running on screen, ` +
						`${result.unseen.length} never seen\n`
				);
				for (const key of result.unseen) {
					problems.push(`motion ${url}  ${key} never runs while its subject is on screen`);
				}
				if (result.live === 0) {
					problems.push(
						`motion ${url}  no scroll-driven animation ran at all. ` +
							'Check that CSS minification is still off.'
					);
				}
			}
			await motionContext.close();
		}
	} finally {
		await browser.close();
	}

	if (problems.length > 0) {
		console.log(`${problems.length} problems:\n`);
		for (const p of problems) console.log(`  ${p}`);
		process.exitCode = 1;
	} else {
		console.log('No contrast failures, no overflow, both languages level.');
	}
}

await main();
