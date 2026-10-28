/**
 * Contact form endpoint.
 *
 * Two callers, one handler. The page posts JSON via fetch when JavaScript runs,
 * and posts the form normally when it does not. The Accept header tells them
 * apart: JSON callers get JSON, everyone else gets a redirect or an HTML page.
 *
 * Rate limiting is NOT done here. A Cloudflare rule caps /api/contact at 5
 * requests per hour per IP, which blocks before the request reaches this code.
 * See ADR-0003 and the launch checklist; the rule does not live in this repo.
 *
 * Turnstile needs JavaScript, so a no-JS submission arrives without a token.
 * Those are accepted, protected by the honeypot field and the edge rate limit.
 * Rejecting them would break the form for everyone without JavaScript, which
 * the spec requires to keep working.
 */

interface Env {
	RESEND_API_KEY: string;
	TURNSTILE_SECRET_KEY?: string;
}

const OWNER = 'alexandru@quickflow.dev';
const FROM = 'Quick Flow <noreply@quickflow.dev>';

const SERVICE_DOWN =
	'Nu am putut trimite cererea acum. Scrie direct la alexandru@quickflow.dev sau încearcă din nou în câteva minute.';

type Fields = Record<string, string>;

function text(value: FormDataEntryValue | null): string {
	return typeof value === 'string' ? value.trim() : '';
}

function validate(f: Fields): Fields {
	const errors: Fields = {};
	if (!f.nume) errors.nume = 'Scrie-mi cum te cheamă.';
	if (!f.email) errors.email = 'Am nevoie de un email ca să îți pot răspunde.';
	else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) errors.email = 'Emailul nu pare corect.';
	if (!f.proiect) errors.proiect = 'Spune-mi în două rânduri ce vrei să construiești.';
	else if (f.proiect.length > 8000) errors.proiect = 'E prea lung. Scurtează sau scrie-mi direct pe email.';
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

function ownerBody(f: Fields): string {
	const lines = [
		`Nume: ${f.nume}`,
		`Email: ${f.email}`,
		`Buget: ${f.buget || 'necompletat'}`,
		'',
		'Ce vrea să construiască:',
		f.proiect,
	];

	const flow = [
		['Cine plătește', f.plateste],
		['Cine încasează', f.incaseaza],
		['Comision', f.comision],
		['Când e livrată munca', f.livrare],
	].filter(([, value]) => value);

	if (flow.length) {
		lines.push('', 'Fluxul de plăți:');
		for (const [label, value] of flow) lines.push(`  ${label}: ${value}`);
	}

	return lines.join('\n');
}

function senderBody(f: Fields): string {
	return [
		`Salut, ${f.nume},`,
		'',
		'Am primit mesajul tău. Îți răspund în aceeași zi lucrătoare.',
		'Mai jos e copia a ce ai trimis, ca să o ai.',
		'',
		'---',
		'',
		ownerBody(f),
		'',
		'---',
		'',
		'Alexandru Trofaniuc, Quick Flow',
		'alexandru@quickflow.dev',
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

/** No-JS error page. Keeps what the visitor wrote so nothing is lost. */
function errorPage(message: string, f: Fields, status: number): Response {
	const html = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cererea nu a plecat</title>
<style>
:root{color-scheme:dark}
body{background:#04232f;color:#fbfbf9;font-family:system-ui,sans-serif;margin:0;padding:3rem 1.25rem;line-height:1.6}
main{max-width:42rem;margin:0 auto}
h1{font-size:1.75rem;line-height:1.2;margin:0 0 1rem}
a{color:#2bd4bd}
textarea{width:100%;min-height:11rem;margin-top:.75rem;background:#062c3a;color:#fbfbf9;border:1px solid rgba(251,251,249,.2);padding:.75rem;font:inherit}
p{color:rgba(251,251,249,.75)}
</style></head>
<body><main>
<h1>${escapeHtml(message)}</h1>
<p>Textul tău e mai jos, nu s-a pierdut. Copiază-l și trimite-mi-l pe email, sau
încearcă din nou în câteva minute.</p>
<textarea readonly>${escapeHtml(ownerBody(f))}</textarea>
<p style="margin-top:1.5rem"><a href="mailto:${OWNER}">${OWNER}</a> &nbsp;·&nbsp;
<a href="/contact">Înapoi la formular</a></p>
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
		return wantsJson
			? Response.json({ message: 'Cerere invalidă.' }, { status: 400 })
			: errorPage('Cerere invalidă.', {}, 400);
	}

	const f: Fields = {
		nume: text(form.get('nume')),
		email: text(form.get('email')),
		proiect: text(form.get('proiect')),
		buget: text(form.get('buget')),
		plateste: text(form.get('plateste')),
		incaseaza: text(form.get('incaseaza')),
		comision: text(form.get('comision')),
		livrare: text(form.get('livrare')),
	};

	// Where a browser goes after a successful submission. The value arrives in a
	// hidden field and is checked against the two pages that exist, because an
	// unchecked redirect target is an open redirect.
	const THANKS: Record<string, string> = { en: '/thank-you', ro: '/ro/multumesc' };
	const thanks = THANKS[text(form.get('locale'))] ?? THANKS.en;

	// Honeypot. A bot filled a field no person can see. Answer as if it worked,
	// so whoever wrote the bot does not learn why it stopped arriving.
	if (text(form.get('website'))) {
		return wantsJson ? Response.json({ ok: true }) : Response.redirect(new URL(thanks, request.url), 303);
	}

	const errors = validate(f);
	if (Object.keys(errors).length) {
		return wantsJson
			? Response.json({ fields: errors }, { status: 400 })
			: errorPage('Mai lipsește ceva din formular.', f, 400);
	}

	const token = text(form.get('cf-turnstile-response'));
	if (token && env.TURNSTILE_SECRET_KEY) {
		const ip = request.headers.get('CF-Connecting-IP') || '';
		const passed = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
		if (!passed) {
			const message = 'Verificarea anti-robot nu a trecut. Reîncarcă pagina și încearcă din nou.';
			return wantsJson
				? Response.json({ message }, { status: 400 })
				: errorPage(message, f, 400);
		}
	}

	if (!env.RESEND_API_KEY) {
		return wantsJson
			? Response.json({ message: SERVICE_DOWN }, { status: 502 })
			: errorPage(SERVICE_DOWN, f, 502);
	}

	const toOwner = await sendEmail(env.RESEND_API_KEY, {
		to: OWNER,
		subject: `Cerere nouă de la ${f.nume}`,
		text: ownerBody(f),
		reply_to: f.email,
	});

	// If the owner's copy failed, the request is lost. Say so, do not pretend.
	if (!toOwner) {
		return wantsJson
			? Response.json({ message: SERVICE_DOWN }, { status: 502 })
			: errorPage(SERVICE_DOWN, f, 502);
	}

	// Exactly one copy to whoever typed the address, per submission. The owner's
	// copy already arrived, so a failure here is not worth failing the request.
	await sendEmail(env.RESEND_API_KEY, {
		to: f.email,
		subject: 'Copia mesajului tău către Quick Flow',
		text: senderBody(f),
	});

	return wantsJson
		? Response.json({ ok: true })
		: Response.redirect(new URL(thanks, request.url), 303);
};
