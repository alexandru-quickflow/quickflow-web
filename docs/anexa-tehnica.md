# Anexa tehnică: stack și arhitectură

Anexă la `03-spec.md` v1. Document intern, clientul nu îl citește.
Dată: 2026-10-27

Scop: decide cu ce se construiește, înainte de estimare. Fără asta, estimarea de la
etapa 4 e o presupunere.

## Decizia

| Strat | Alegere |
|---|---|
| Framework | Astro 7, output static |
| Limbaj | TypeScript, strict |
| Stiluri | Tailwind v4 |
| Iconițe | Phosphor Icons |
| Framework de UI pe client | Niciunul |
| i18n | Routing nativ Astro: română fără prefix, engleză pe `/en` |
| Formular | Cloudflare Pages Function pe `/api/contact` |
| Anti-spam | Cloudflare Turnstile plus o regulă de rate limiting pe traseul formularului |
| Email | Resend |
| Imagini | Componenta `<Image>` din Astro, AVIF și WebP |
| Analytics | Cloudflare Web Analytics, fără cookies |
| Monitorizare erori | Logurile Cloudflare, fără Sentry |
| Hosting | Cloudflare Pages, legat la git, cu preview deploys |
| Testare | Un test Playwright pe formular: trimitere reușită și validare |
| Repository | `D:\dev\quickflow-web` |

## De ce

**Astro 7 static, nu server.** Versiunea instalata e 7.4.2, verificata la setup, nu presupusa. Site-ul are exact o bucată dinamică: formularul. Tot
restul e text care nu se schimbă între cereri. Un build static servit din CDN
înseamnă LCP sub o secundă fără niciun efort special, ceea ce e un criteriu de succes
din spec, secțiunea 1.

**Niciun framework de UI pe client.** Singura interactivitate e formularul și
comutatorul de limbă, care sunt un `<form>` și două link-uri. React ar adăuga 40 de
kilobytes ca să facă ce face HTML-ul singur. Formularul funcționează ca POST normal
dacă JavaScript-ul e oprit, iar JS-ul doar îl îmbunătățește cu validare și mesaje
fără reîncărcare.

**Pages Function, nu Netlify Forms sau Formspree.** Un serviciu terț ar fi mai rapid
de pus, dar aduce o dependență lunară pentru 20 de linii de cod. Funcția stă în
același repository, pe același hosting, și e a lui.

**Rate limiting la nivel de Cloudflare, nu în cod.** Regula se configurează o dată și
blochează înainte ca cererea să ajungă la funcție. Mai ieftin și mai greu de ocolit
decât un contor în cod.

**Fără Sentry.** E în stack-ul standard, dar aici ar monitoriza un singur endpoint
care trimite un email. Logurile Cloudflare acoperă cazul. Dacă se adaugă blogul și
pagini dinamice, decizia se revizuiește.

**Un singur test Playwright.** Un site de text nu are logică de testat. Formularul
are: validare, trimitere, eroare de serviciu. Acolo merge testul, restul e pierdere
de timp.

## Alternative respinse

| Alternativă | De ce nu |
|---|---|
| Next.js pe Netlify cu Postgres | Nu există date de stocat și nicio pagină care să aibă nevoie de server. Build mai lent, JavaScript mai mult, cost fără beneficiu. |
| Astro cu insule React | Nu există interactivitate care să justifice o insulă. |
| WordPress | Clientul nu vrea panou de administrare, iar spec-ul interzice explicit unul. |
| Cloudflare Workers cu D1 și KV | Nu e nevoie de bază de date. Cererile de contact pleacă pe email și nu se stochează. |

## Ce trebuie configurat la onboarding (etapa 5)

- Proiect Cloudflare Pages legat la repository
- `quickflow.dev` pointat pe Pages, plus `www` redirecționat
- Cheie API Resend, cu domeniul `quickflow.dev` verificat (SPF, DKIM, DMARC în DNS)
- Site key și secret key de Turnstile
- Regulă de rate limiting pe `/api/contact`
- Token de Cloudflare Web Analytics
- Secretele în variabilele de mediu ale proiectului Pages, niciuna în repository

## Ce intră în ADR-uri la etapa 7

Deciziile de mai sus sunt fundația și se scriu aici, nu ca ADR. ADR-urile de la etapa
7 acoperă ce apare pe parcurs: cum se structurează conținutul pe limbi, cum se
gestionează imaginile de portofoliu, ce se întâmplă cu rutele blogului pregătit dar
nelansat.
