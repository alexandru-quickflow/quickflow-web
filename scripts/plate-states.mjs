// Captures the Plate player in each of its states for the gallery on the Plate pages.
//
//     npm run build && npx astro preview --port 4329
//     node scripts/plate-states.mjs
//     python -I scripts/images.py
//
// It drives the real player on /work/plate/ in installed Chrome (Playwright's own Chromium has
// no H.264, so the Mux stream would never play), and writes one JPEG per state, at most 1200px
// wide, to public/work/plate/. images.py then draws the AVIF and WebP and records the sizes.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BASE = process.env.BASE ?? 'http://localhost:4329';
const OUT = new URL('../public/work/plate/', import.meta.url);
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });

/** A page with the player mounted, options set, the stream loaded and paused at `at` seconds. */
async function player({ width = 1280, theme, accent, phone, lang, media = {}, at = 24 } = {}) {
	const context = await browser.newContext({
		viewport: { width, height: 1000 },
		deviceScaleFactor: 2,
		reducedMotion: 'reduce',
		...media,
	});
	const page = await context.newPage();
	await page.goto(`${BASE}/work/plate/`);
	await page.evaluate(
		({ theme, accent, phone, lang }) => {
			const q = (s) => document.querySelector(s);
			if (theme) q(`[data-theme=${theme}]`).click();
			if (phone) q('[data-width=phone]').click();
			if (accent) {
				const input = q('[data-accent]');
				input.value = accent;
				input.dispatchEvent(new Event('input', { bubbles: true }));
			}
			if (lang) {
				const select = q('[data-language]');
				select.value = lang;
				select.dispatchEvent(new Event('change', { bubbles: true }));
			}
		},
		{ theme, accent, phone, lang }
	);
	await page.click('[data-plate-play]');
	await page.waitForSelector('.plate-host mux-video');
	await page.waitForFunction(() => document.querySelector('mux-video')?.readyState >= 3, null, { timeout: 20000 });
	await page.evaluate(async (at) => {
		const m = document.querySelector('mux-video');
		m.pause();
		m.currentTime = at;
		await new Promise((r) => m.addEventListener('seeked', r, { once: true }));
	}, at);
	// Thumbnails, fonts and the poster settle.
	await page.waitForTimeout(800);
	return { page, context, host: page.locator('.plate-host') };
}

/** The player in real fullscreen on a 16:9 screen, paused with the controls showing. Shot whole page. */
async function fullscreen({ at }) {
	const p = await player({ width: 1600, at });
	await p.page.setViewportSize({ width: 1600, height: 900 });
	await p.page.locator('.pl-btn-full').click();
	await p.page.waitForFunction(() => document.fullscreenElement);
	await p.page.mouse.move(800, 450, { steps: 5 });
	await p.page.waitForTimeout(900);
	return { ...p, host: p.page };
}

async function shot(name, setup) {
	const { page, context, host } = await setup();
	await page.waitForTimeout(400);
	const png = await host.screenshot({ animations: 'disabled' });
	await sharp(png)
		.resize({ width: 1200, withoutEnlargement: true })
		.jpeg({ quality: 88, progressive: true, mozjpeg: true })
		.toFile(fileURLToPath(new URL(`${name}.jpg`, OUT)));
	await context.close();
	console.log('captured', name);
}

const STATES = {
	// Playing in the second chapter: the index and the ruler both mark it.
	playing: () =>
		player({ at: 24 }).then(async (p) => {
			await p.page.evaluate(() => document.querySelector('mux-video').play());
			await p.page.waitForTimeout(1200);
			return p;
		}),
	paused: () => player({ at: 40 }),
	// Pointer on the ruler: the storyboard frame, the time and the chapter under it.
	scrub: () =>
		player({ at: 12 }).then(async (p) => {
			const box = await p.page.locator('.pl-time-slider').boundingBox();
			await p.page.mouse.move(box.x + box.width * 0.62, box.y + box.height / 2);
			await p.page.waitForTimeout(900);
			return p;
		}),
	// Keyboard focus on a key, after a speed change.
	focus: () =>
		player({ at: 30 }).then(async (p) => {
			await p.page.evaluate(() => (document.querySelector('mux-video').playbackRate = 1.5));
			await p.page.locator('.pl-controls > .pl-btn-rate').focus();
			await p.page.keyboard.press('Shift+Tab');
			await p.page.keyboard.press('Tab');
			return p;
		}),
	// Pointer on Mute: the volume slider opens to its right.
	volume: () =>
		player({ at: 33 }).then(async (p) => {
			const box = await p.page.locator('.pl-btn-mute').boundingBox();
			await p.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
			await p.page.waitForTimeout(600);
			// Then onto the slider itself, so Mute's tooltip doesn't cover the ruler.
			const slider = await p.page.locator('.pl-volume media-volume-slider').boundingBox();
			await p.page.mouse.move(slider.x + slider.width * 0.6, slider.y + slider.height / 2, { steps: 5 });
			await p.page.waitForTimeout(600);
			return p;
		}),
	// Fullscreen, edge to edge, with the controls showing over the picture.
	fullscreen: () => fullscreen({ at: 28 }),
	// Fullscreen with the Index key's panel open over the side of the picture.
	index: () =>
		fullscreen({ at: 28 }).then(async (p) => {
			await p.page.locator('.pl-btn-index').click();
			await p.page.waitForTimeout(700);
			return p;
		}),
	quality: () =>
		player({ width: 1500, at: 52 }).then(async (p) => {
			await p.page.locator('.pl-controls > .pl-btn-quality').click();
			await p.page.waitForTimeout(400);
			return p;
		}),
	ended: () =>
		player({ at: 50 }).then(async (p) => {
			await p.page.evaluate(async () => {
				const m = document.querySelector('mux-video');
				m.currentTime = m.duration - 0.2;
				await m.play().catch(() => undefined);
				await new Promise((r) => m.addEventListener('ended', r, { once: true }));
			});
			return p;
		}),
	error: () =>
		player({ at: 5 }).then(async (p) => {
			await p.page.evaluate(() =>
				document.querySelector('mux-video').setAttribute('src', 'https://stream.mux.com/not-a-playback-id.m3u8')
			);
			await p.page.waitForSelector('.pl-dialog', { state: 'visible', timeout: 20000 });
			await p.page.waitForTimeout(500);
			return p;
		}),
	strip: () => player({ width: 760, at: 36 }),
	phone: () => player({ width: 760, phone: true, at: 44 }),
	more: () =>
		player({ width: 760, phone: true, at: 44 }).then(async (p) => {
			await p.page.locator('.pl-btn-more').click();
			await p.page.waitForTimeout(400);
			await p.page.locator('.pl-more [data-page=speed]').click();
			await p.page.waitForTimeout(400);
			return p;
		}),
	blueprint: () => player({ theme: 'blueprint', at: 21 }),
	signal: () => player({ theme: 'signal', at: 56 }),
	brand: () => player({ accent: '#ff6b00', at: 38 }),
	arabic: () => player({ lang: 'ar', at: 24 }),
	'forced-colors': () => player({ media: { forcedColors: 'active' }, at: 24 }),
};

const only = process.argv.slice(2);
for (const [name, setup] of Object.entries(STATES)) {
	if (only.length && !only.includes(name)) continue;
	try {
		await shot(name, setup);
	} catch (error) {
		console.error('failed', name, error.message);
	}
}
await browser.close();
