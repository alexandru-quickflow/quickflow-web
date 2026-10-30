import { defineConfig, devices } from '@playwright/test';

/**
 * One browser, one project, on the built site.
 *
 * The site is static, so the test has to run against `dist/` rather than the
 * dev server: the two differ in exactly the way that has bitten this project
 * before, when Lightning CSS folded a shorthand no browser accepts and every
 * animation died in the production build while the dev build was fine.
 * `npm run build` therefore runs first, every time.
 *
 * Port 4322 is the one scripts/probe.mjs and scripts/responsive.mjs use, and
 * Astro refuses to start a second preview server. `reuseExistingServer` means
 * a preview already running for those scripts is used as it is, rather than
 * failing the run; on CI nothing is running, so it starts its own.
 *
 * Chromium only. This suite checks that the form is wired up, not how it
 * renders, and rendering is what the other two scripts measure across 29 pages
 * and 12 widths. A second browser here would triple the time and tell us
 * nothing new.
 */
export default defineConfig({
	testDir: './tests',
	// The handler's own tests are plain node:test files in the same folder and
	// are run by `node --test`, not by this.
	testMatch: /.*\.spec\.ts/,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://127.0.0.1:4322',
		trace: 'on-first-retry',
		// Every reveal on this site starts at opacity 0 and is brought in by a
		// view timeline. Reduced motion turns the whole motion block off and
		// leaves elements in their final state, which is where a reader sees
		// them, and is what the other two scripts measure under as well.
		reducedMotion: 'reduce',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'npm run build && npm run preview -- --port 4322 --host 127.0.0.1',
		url: 'http://127.0.0.1:4322/contact',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
