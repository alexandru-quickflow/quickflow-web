/**
 * Page view counter, on the server, with no script in the page.
 *
 * Why it exists: Cloudflare's zone logs cannot tell a person from a scanner and
 * do not say where a visit came from, and the Web Analytics beacon stays off
 * because it is 10 KB against the 5 KB the home page promises (ADR-0006,
 * docs/launch-checklist.md, "Analytics stays off"). Counting here costs the
 * reader nothing: the page is fetched first and handed back untouched, and the
 * data point is written afterwards, inside a try, so a counter that breaks can
 * only lose a count, never a page.
 *
 * What one data point holds, and nothing else: the path, the referring site's
 * host name, the country Cloudflare already resolved, phone or computer, and a
 * guess at whether it was a robot. No IP address, no full user agent, no cookie,
 * no identifier. Two visits from the same person are two unrelated rows, which
 * is what lets both privacy pages say the site does not recognise anyone.
 *
 * public/_routes.json keeps images, fonts and CSS from reaching this file at
 * all, so they stay free static requests and do not spend the account's daily
 * allowance of Functions requests.
 */

interface AnalyticsEngineDataset {
	writeDataPoint(point: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void;
}

interface Env {
	/** Bound in the Pages project settings, not in this repository. Without it
	 *  the counter does nothing and the site behaves exactly as before. */
	PAGEVIEWS?: AnalyticsEngineDataset;
}

interface Context {
	request: Request;
	env: Env;
	next: () => Promise<Response>;
}

// Anything that announces itself as a tool or a crawler. Browsers that pretend
// to be browsers get past this; Sec-Fetch-Mode below catches most of the rest.
const ROBOT =
	/bot|crawl|spider|slurp|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|undici|httpclient|scrapy|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegram|preview|monitor|uptime|scan|feed/i;

/** A path is a page when its last segment has no file extension. */
function isPage(pathname: string): boolean {
	if (pathname.startsWith('/api/')) return false;
	const last = pathname.split('/').pop() ?? '';
	return !last.includes('.');
}

function device(ua: string): string {
	if (/ipad|tablet/i.test(ua)) return 'tablet';
	if (/mobi|android|iphone/i.test(ua)) return 'mobile';
	return 'desktop';
}

/** Only the host of the referring page. Same-site navigation is marked as such,
 *  no referrer at all is "direct". The full referring URL is never kept: it can
 *  carry search terms or someone else's private link. */
function source(referer: string | null, ownHost: string): string {
	if (!referer) return '(direct)';
	try {
		const host = new URL(referer).hostname.replace(/^www\./, '');
		return host === ownHost.replace(/^www\./, '') ? '(internal)' : host.slice(0, 100);
	} catch {
		return '(invalid)';
	}
}

/** What gets written for one request, or null when it is not a page view. */
export function describe(
	request: Request,
	status: number,
	country = '',
): { indexes: string[]; blobs: string[]; doubles: number[] } | null {
	if (request.method !== 'GET') return null;
	const url = new URL(request.url);
	if (!isPage(url.pathname)) return null;

	const ua = request.headers.get('user-agent') ?? '';
	const navigate = request.headers.get('sec-fetch-mode') === 'navigate';
	const kind = !ua || ROBOT.test(ua) ? 'robot' : navigate ? 'browser' : 'unsure';
	const path = url.pathname.slice(0, 96);
	const campaign = (url.searchParams.get('utm_source') ?? '').slice(0, 40);

	return {
		indexes: [path],
		blobs: [
			path,
			source(request.headers.get('referer'), url.hostname),
			country.slice(0, 2),
			device(ua),
			kind,
			String(status),
			campaign,
		],
		doubles: [1],
	};
}

export const onRequest = async (context: Context): Promise<Response> => {
	const response = await context.next();
	try {
		const cf = (context.request as Request & { cf?: { country?: string } }).cf;
		const point = describe(context.request, response.status, cf?.country ?? '');
		if (point && context.env.PAGEVIEWS) context.env.PAGEVIEWS.writeDataPoint(point);
	} catch {
		// A lost count is the whole cost of a broken counter.
	}
	return response;
};
