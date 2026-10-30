/**
 * Contact form endpoint.
 *
 * Two callers, one handler. The page posts JSON via fetch when JavaScript runs,
 * and posts the form normally when it does not. The Accept header tells them
 * apart: JSON callers get JSON, everyone else gets a redirect or an HTML page.
 *
 * Two languages, one handler as well. The form carries a hidden locale field,
 * which decides what the visitor reads: validation messages, the no-JS error
 * page, the thank-you page it redirects to, and their own copy of the message.
 * The owner's copy stays in Romanian whatever the visitor wrote in, with the
 * visitor's language marked in the subject, because the owner is one person and
 * reads one language. The locale is never trusted as a path: it is matched
 * against the two known values, so it cannot turn the redirect into an open one.
 *
 * Rate limiting is NOT done here. A Cloudflare rule caps /api/contact at 5
 * requests per hour per IP, which blocks before the request reaches this code.
 * See ADR-0003 and docs/launch-checklist.md; the rule does not live in this
 * repo, which is exactly why it has to be checked before every launch.
 *
 * Turnstile needs JavaScript, so a no-JS submission arrives without a token.
 * Those are accepted, because rejecting them would break the form for everyone
 * without JavaScript, which the spec requires to keep working.
 *
 * But accepted is not the same as trusted, and the difference is the copy sent
 * to the visitor. That copy goes to whatever address was typed into the form,
 * which makes this endpoint a mail relay for anyone who can POST to it: send
 * text, name someone else's address, and the site delivers it. The honeypot
 * stops a crawler filling every field it finds; it does not stop anybody who
 * reads the HTML once. So the copy is sent only when Turnstile actually
 * verified a human. A submission without a token still reaches the owner,
 * which is the whole point of the form, and simply gets no copy of itself.
 *
 * That leaves the edge rule as a cap on volume rather than as the only thing
 * between this endpoint and a stranger's inbox.
 */

interface Env {
	RESEND_API_KEY: string;
	TURNSTILE_SECRET_KEY?: string;
}

const OWNER = 'alexandru@quickflow.dev';
// The domain verified in Resend is send.quickflow.dev, not the apex. A sender
// on the apex is refused with 403, which reads to the visitor as an outage.
const FROM = 'Quick Flow <noreply@send.quickflow.dev>';

/** What the endpoint answers when the mail service will not take the message.
 *
 *  502 is the honest description and is useless here: on the proxied domain
 *  Cloudflare replaces a 5xx from a Pages Function with its own bare error page,
 *  so the one message that tells the visitor to write directly never reaches
 *  them. It survives on pages.dev, which is why this was invisible until the
 *  site ran on its own domain.
 *
 *  422 passes through. It is also close enough to true: the submission was
 *  understood and valid, the mail service could not take it. And it stays a
 *  failure, so anything watching status codes still sees one. */
const MAIL_UNAVAILABLE = 422;

type Locale = 'en' | 'ro';
const DEFAULT_LOCALE: Locale = 'en';
/** The language the owner's own copy is written in. */
const OWNER_LOCALE: Locale = 'ro';

type Fields = Record<string, string>;

interface Copy {
	/** Where a browser is sent after a successful submission. */
	thanks: string;
	/** Where the no-JS error page points back to. */
	contact: string;
	invalidRequest: string;
	missingSomething: string;
	serviceDown: string;
	turnstileFailed: string;
	errorIntro: string;
	backToForm: string;
	errors: {
		name: string;
		emailMissing: string;
		emailInvalid: string;
		projectMissing: string;
		projectTooLong: string;
	};
	labels: {
		name: string;
		email: string;
		subject: string;
		budget: string;
		when: string;
		now: string;
		source: string;
		empty: string;
		wants: string;
		flow: string;
		pays: string;
		paid: string;
		fee: string;
		delivered: string;
	};
	ownerSubject: (name: string) => string;
	senderSubject: string;
	senderGreeting: (name: string) => string;
	senderIntro: string[];
}

const COPY: Record<Locale, Copy> = {
	en: {
		thanks: '/thank-you',
		contact: '/contact',
		invalidRequest: 'Invalid request.',
		missingSomething: 'Something is still missing from the form.',
		serviceDown:
			'I could not send the request right now. Write directly to alexandru@quickflow.dev or try again in a few minutes.',
		turnstileFailed: 'The anti-robot check did not pass. Reload the page and try again.',
		errorIntro:
			'Your text is below, it is not lost. Copy it and send it to me by email, or try again in a few minutes.',
		backToForm: 'Back to the form',
		errors: {
			name: 'Tell me what to call you.',
			emailMissing: 'I need an email address to be able to answer you.',
			emailInvalid: 'That email does not look right.',
			projectMissing: 'Tell me in two lines what you want to build.',
			projectTooLong: 'That is too long. Shorten it, or write to me by email instead.',
		},
		labels: {
			name: 'Name',
			email: 'Email',
			subject: 'About',
			budget: 'Budget',
			when: 'When',
			now: 'What exists now',
			source: 'Arrived via',
			empty: 'not filled in',
			wants: 'What they want to build:',
			flow: 'The payment flow:',
			pays: 'Who pays',
			paid: 'Who gets paid',
			fee: 'Fee',
			delivered: 'When the work is delivered',
		},
		ownerSubject: (name) => `New request from ${name}`,
		senderSubject: 'Your copy of the message to Quick Flow',
		senderGreeting: (name) => `Hello ${name},`,
		senderIntro: [
			'I have your message. I will answer the same working day.',
			'Below is a copy of what you sent, so you keep it.',
		],
	},
	ro: {
		thanks: '/ro/multumesc',
		contact: '/ro/contact',
		invalidRequest: 'Cerere invalidă.',
		missingSomething: 'Mai lipsește ceva din formular.',
		serviceDown:
			'Nu am putut trimite cererea acum. Scrie direct la alexandru@quickflow.dev sau încearcă din nou în câteva minute.',
		turnstileFailed: 'Verificarea anti-robot nu a trecut. Reîncarcă pagina și încearcă din nou.',
		errorIntro:
			'Textul tău e mai jos, nu s-a pierdut. Copiază-l și trimite-mi-l pe email, sau încearcă din nou în câteva minute.',
		backToForm: 'Înapoi la formular',
		errors: {
			name: 'Scrie-mi cum te cheamă.',
			emailMissing: 'Am nevoie de un email ca să îți pot răspunde.',
			emailInvalid: 'Emailul nu pare corect.',
			projectMissing: 'Spune-mi în două rânduri ce vrei să construiești.',
			projectTooLong: 'E prea lung. Scurtează sau scrie-mi direct pe email.',
		},
		labels: {
			name: 'Nume',
			email: 'Email',
			subject: 'Despre',
			budget: 'Buget',
			when: 'Când',
			now: 'Ce există acum',
			source: 'A ajuns prin',
			empty: 'necompletat',
			wants: 'Ce vrea să construiască:',
			flow: 'Fluxul de plăți:',
			pays: 'Cine plătește',
			paid: 'Cine încasează',
			fee: 'Comision',
			delivered: 'Când e livrată munca',
		},
		ownerSubject: (name) => `Cerere nouă de la ${name}`,
		senderSubject: 'Copia mesajului tău către Quick Flow',
		senderGreeting: (name) => `Salut, ${name},`,
		senderIntro: [
			'Am primit mesajul tău. Îți răspund în aceeași zi lucrătoare.',
			'Mai jos e copia a ce ai trimis, ca să o ai.',
		],
	},
};

function text(value: FormDataEntryValue | null): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** Matched against the known values, never used as a path on trust. */
function localeOf(value: string): Locale {
	return value === 'ro' || value === 'en' ? value : DEFAULT_LOCALE;
}

function validate(f: Fields, c: Copy): Fields {
	const errors: Fields = {};
	if (!f.nume) errors.nume = c.errors.name;
	if (!f.email) errors.email = c.errors.emailMissing;
	else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) errors.email = c.errors.emailInvalid;
	if (!f.proiect) errors.proiect = c.errors.projectMissing;
	else if (f.proiect.length > 8000) errors.proiect = c.errors.projectTooLong;
	return errors;
}

async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	if (ip) body.append('remoteip', ip);

	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body,
	});
	const data: { success?: boolean } = await res.json();
	return data.success === true;
}

/** The submission, written out. Used for the owner's copy, the visitor's copy
 *  and the textarea on the error page, so nothing is ever formatted twice. */
function summary(f: Fields, c: Copy): string {
	const lines = [
		`${c.labels.name}: ${f.nume}`,
		`${c.labels.email}: ${f.email}`,
		`${c.labels.subject}: ${f.subiect || c.labels.empty}`,
		`${c.labels.budget}: ${f.buget || c.labels.empty}`,
		`${c.labels.when}: ${f.cand || c.labels.empty}`,
	];

	if (f.acum) lines.push(`${c.labels.now}: ${f.acum}`);
	if (f.sursa) lines.push(`${c.labels.source}: ${f.sursa}`);

	lines.push('', c.labels.wants, f.proiect);

	const flow = [
		[c.labels.pays, f.plateste],
		[c.labels.paid, f.incaseaza],
		[c.labels.fee, f.comision],
		[c.labels.delivered, f.livrare],
	].filter(([, value]) => value);

	if (flow.length) {
		lines.push('', c.labels.flow);
		for (const [label, value] of flow) lines.push(`  ${label}: ${value}`);
	}

	return lines.join('\n');
}

function senderBody(f: Fields, c: Copy): string {
	return [
		c.senderGreeting(f.nume),
		'',
		...c.senderIntro,
		'',
		'---',
		'',
		summary(f, c),
		'',
		'---',
		'',
		'Alexandru Trofaniuc, Quick Flow',
		OWNER,
	].join('\n');
}

async function sendEmail(
	apiKey: string,
	payload: { to: string; subject: string; text: string; reply_to?: string },
): Promise<boolean> {
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ from: FROM, ...payload }),
	});
	return res.ok;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** No-JS error page, on paper like the rest of the site. Keeps what the
 *  visitor wrote so nothing is lost. */
function errorPage(message: string, f: Fields, status: number, lang: Locale): Response {
	const c = COPY[lang];
	const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(message)}</title>
<style>
:root{color-scheme:light}
body{background:#fbfbf9;color:#04232f;font-family:system-ui,sans-serif;margin:0;padding:3rem 1.25rem;line-height:1.6}
main{max-width:42rem;margin:0 auto}
h1{font-size:1.75rem;line-height:1.2;margin:0 0 1rem}
a{color:#04232f}
textarea{width:100%;min-height:11rem;margin-top:.75rem;background:transparent;color:#04232f;border:1px solid rgba(4,35,47,.22);padding:.75rem;font:inherit}
p{color:rgba(4,35,47,.7)}
</style></head>
<body><main>
<h1>${escapeHtml(message)}</h1>
<p>${escapeHtml(c.errorIntro)}</p>
<textarea readonly>${escapeHtml(summary(f, c))}</textarea>
<p style="margin-top:1.5rem"><a href="mailto:${OWNER}">${OWNER}</a> &nbsp;·&nbsp;
<a href="${c.contact}">${escapeHtml(c.backToForm)}</a></p>
</main></body></html>`;

	return new Response(html, {
		status,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
}

export const onRequestPost = async (context: {
	request: Request;
	env: Env;
}): Promise<Response> => {
	const { request, env } = context;
	const wantsJson = (request.headers.get('Accept') || '').includes('application/json');

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		const c = COPY[DEFAULT_LOCALE];
		return wantsJson
			? Response.json({ message: c.invalidRequest }, { status: 400 })
			: errorPage(c.invalidRequest, {}, 400, DEFAULT_LOCALE);
	}

	const lang = localeOf(text(form.get('locale')));
	const c = COPY[lang];

	const f: Fields = {
		nume: text(form.get('nume')),
		email: text(form.get('email')),
		proiect: text(form.get('proiect')),
		subiect: text(form.get('subiect')),
		buget: text(form.get('buget')),
		cand: text(form.get('cand')),
		acum: text(form.get('acum')),
		sursa: text(form.get('sursa')),
		plateste: text(form.get('plateste')),
		incaseaza: text(form.get('incaseaza')),
		comision: text(form.get('comision')),
		livrare: text(form.get('livrare')),
	};

	// Honeypot. A bot filled a field no person can see. Answer as if it worked,
	// so whoever wrote the bot does not learn why it stopped arriving.
	if (text(form.get('website'))) {
		return wantsJson
			? Response.json({ ok: true })
			: Response.redirect(new URL(c.thanks, request.url), 303);
	}

	const errors = validate(f, c);
	if (Object.keys(errors).length) {
		return wantsJson
			? Response.json({ fields: errors }, { status: 400 })
			: errorPage(c.missingSomething, f, 400, lang);
	}

	// Whether a human was actually verified, not merely whether the check was
	// skipped. A missing token, a missing secret and a passing token are three
	// different states, and only the last one earns the visitor a copy.
	let verifiedHuman = false;
	const token = text(form.get('cf-turnstile-response'));
	if (token && env.TURNSTILE_SECRET_KEY) {
		const ip = request.headers.get('CF-Connecting-IP') || '';
		const passed = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
		if (!passed) {
			return wantsJson
				? Response.json({ message: c.turnstileFailed }, { status: 400 })
				: errorPage(c.turnstileFailed, f, 400, lang);
		}
		verifiedHuman = true;
	}

	if (!env.RESEND_API_KEY) {
		return wantsJson
			? Response.json({ message: c.serviceDown }, { status: MAIL_UNAVAILABLE })
			: errorPage(c.serviceDown, f, MAIL_UNAVAILABLE, lang);
	}

	const owner = COPY[OWNER_LOCALE];
	const toOwner = await sendEmail(env.RESEND_API_KEY, {
		to: OWNER,
		// The visitor's language is in the subject, so the reply can be written
		// in the language they wrote in without opening the message first.
		subject: `${owner.ownerSubject(f.nume)} [${lang.toUpperCase()}]`,
		text: summary(f, owner),
		reply_to: f.email,
	});

	// If the owner's copy failed, the request is lost. Say so, do not pretend.
	if (!toOwner) {
		return wantsJson
			? Response.json({ message: c.serviceDown }, { status: MAIL_UNAVAILABLE })
			: errorPage(c.serviceDown, f, MAIL_UNAVAILABLE, lang);
	}

	// At most one copy to whoever typed the address, per submission, in their
	// own language, and only when Turnstile verified a human. This is the one
	// place where the endpoint writes to an address a stranger chose, so it is
	// the one place that has to be sure a person chose it. A submission that
	// arrived without a token is already in the owner's inbox by now and is
	// answered by hand like any other; it just does not get mailed back.
	//
	// The owner's copy has already arrived either way, so a failure here is
	// not worth failing the request over.
	if (verifiedHuman) {
		await sendEmail(env.RESEND_API_KEY, {
			to: f.email,
			subject: c.senderSubject,
			text: senderBody(f, c),
			// So a reply to this copy reaches a person, not the noreply address.
			reply_to: OWNER,
		});
	}

	return wantsJson
		? Response.json({ ok: true })
		: Response.redirect(new URL(c.thanks, request.url), 303);
};
