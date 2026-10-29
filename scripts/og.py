"""Draws one share image per page, from the pages themselves.

A link to this site posted in WhatsApp, Slack or LinkedIn shows whatever
og:image points at. With nothing there it is a grey rectangle, which reads as
an unfinished site, which is the opposite of the argument every page makes.

The images are not decorated: they carry the page's own headline, in the page's
own typeface, on the page's own ground, with the one italic word in teal
exactly as the page sets it. Generated rather than designed, so a headline that
changes cannot leave a share image behind saying something else.

    npm run build        # dist/ has to exist: the text is read from it
    python scripts/og.py
    npm run build        # again, to copy public/og into dist

Needs Pillow and the font cache from scripts/fonts.py:

    pip install pillow "fonttools[woff2]"
    python scripts/fonts.py
"""

import html
import json
import pathlib
import re
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
OUT = ROOT / 'public' / 'og'
CACHE = ROOT / '.font-cache'

W, H = 1200, 630
PAD = 86

# The label in the top right, by route. Home carries none: its headline says
# what the site is, and a label there would only repeat the brand mark.
SECTIONS = {
    'work': 'Work',
    'contact': 'Contact',
    'privacy': 'Privacy',
    'thank-you': 'Sent',
    'services-bubble-to-code-migration': 'Bubble to code',
    'services-marketplace-payments': 'Marketplace payments',
    'stripe-escrow-marketplace': 'Stripe and escrow',
    'ro-portofoliu': 'Portofoliu',
    'ro-contact': 'Contact',
    'ro-confidentialitate': 'Confidențialitate',
    'ro-multumesc': 'Trimis',
    'ro-servicii-migrare-bubble': 'Migrare de pe Bubble',
    'ro-servicii-marketplace-plati': 'Plăți pentru marketplace',
    'ro-stripe-escrow-marketplace': 'Stripe și escrow',
    'prototype-in-five-days': 'Prototype in five days',
    'services-internal-apps': 'Internal apps',
    'ro-prototip-in-cinci-zile': 'Prototip în cinci zile',
    'ro-servicii-aplicatii-interne': 'Aplicații interne',
    'bubble-performance-audit': 'Bubble performance audit',
    'ro-audit-performanta-bubble': 'Audit de performanță Bubble',
    'services-course-platforms': 'Course platforms',
    'ro-servicii-platforme-cursuri': 'Platforme de cursuri',
    'landing-page-and-website': 'Landing page and site',
    'ro-landing-page-si-site-de-prezentare': 'Landing page și site',
    'terms': 'Terms',
    'ro-termeni': 'Termeni',
}

INK = (4, 8, 11)
PAPER = (233, 242, 240)
TEAL = (43, 212, 189)
HOT = (255, 95, 69)
FAINT = (131, 142, 142)   # paper at 54% over ink, flattened
LINE = (30, 41, 46)


def font(name: str, size: int, weight: int, *, opsz: float | None = None) -> ImageFont.FreeTypeFont:
    path = CACHE / name
    if not path.exists():
        sys.exit(f'{path} not found. Run python scripts/fonts.py first.')
    f = ImageFont.truetype(str(path), size)
    axes = {'wght': weight}
    if opsz is not None:
        axes['opsz'] = opsz
    try:
        names = [a.decode() if isinstance(a, bytes) else a for a in f.get_variation_axes()]
        order = []
        for axis in names:
            tag = axis['name'] if isinstance(axis, dict) else axis
            tag = tag.decode() if isinstance(tag, bytes) else str(tag)
            order.append(tag)
        f.set_variation_by_axes([axes.get(t, 400) for t in ('opsz', 'wght') if t in str(order) or True][: len(order)])
    except Exception:
        pass
    return f


def runs_from_headline(h1_html: str) -> list[tuple[str, bool]]:
    """Splits the headline into words, marking the ones the page sets in italic."""
    # Strip every tag except em first. Without this, a headline that wraps a
    # word in anything else (the struck "escrow" on the escrow pages) leaks its
    # own markup into the image as text.
    h1_html = re.sub(r'<(?!/?em\b)[^>]*>', '', h1_html)

    parts: list[tuple[str, bool]] = []
    for chunk, italic in re.findall(r'<em[^>]*>(.*?)</em>|([^<]+)', h1_html, re.S):
        text = html.unescape(re.sub(r'<[^>]+>', '', chunk or italic or ''))
        text = re.sub(r'\s+', ' ', text)
        if not text.strip():
            continue
        for word in text.split(' '):
            if not word:
                continue
            # A headline that ends "…<em>is not</em>." leaves the full stop as
            # its own token, which then wraps onto a line of its own. Punctuation
            # belongs to the word in front of it, in that word's style.
            if parts and all(ch in '.,;:!?)”»…' for ch in word):
                parts[-1] = (parts[-1][0] + word, parts[-1][1])
                continue
            parts.append((word, bool(chunk)))
    return parts


def draw_page(slug: str, eyebrow: str, runs: list[tuple[str, bool]]) -> pathlib.Path:
    img = Image.new('RGB', (W, H), INK)
    d = ImageDraw.Draw(img)

    # The same drifting glow the pages carry, flattened into one soft corner.
    glow = Image.new('RGB', (W, H), INK)
    gd = ImageDraw.Draw(glow)
    for i in range(34, 0, -1):
        r = i * 26
        t = i / 34
        gd.ellipse(
            [W - 190 - r, -300 - r, W - 190 + r, -300 + r],
            fill=(
                int(INK[0] + (10 - INK[0]) * (1 - t) * 0.5),
                int(INK[1] + (34 - INK[1]) * (1 - t) * 0.5),
                int(INK[2] + (40 - INK[2]) * (1 - t) * 0.5),
            ),
        )
    img = Image.blend(img, glow, 0.9)
    d = ImageDraw.Draw(img)

    mono = font('pinned-jetbrains-mono.woff2.ttf', 21, 500)
    d.text((PAD, PAD), 'QUICK FLOW', font=mono, fill=FAINT)
    if eyebrow:
        label = eyebrow.upper()[:34]
        d.text((W - PAD - d.textlength(label, font=mono), PAD), label, font=mono, fill=FAINT)

    # The headline block sits between the top row and the rule, and shrinks
    # until it fits rather than overlapping either. The first version drew it
    # from a fixed top and the eyebrow ended up underneath the first line.
    top = PAD + 46
    bottom = H - PAD - 62
    size = 92
    while size > 40:
        roman = font('pinned-newsreader-roman.woff2.ttf', size, 300, opsz=60)
        italic = font('pinned-newsreader-italic.woff2.ttf', size, 300, opsz=60)
        lines: list[list[tuple[str, bool]]] = [[]]
        width = 0.0
        space = d.textlength(' ', font=roman)
        for word, is_em in runs:
            f = italic if is_em else roman
            w = d.textlength(word, font=f)
            if lines[-1] and width + space + w > W - PAD * 2:
                lines.append([])
                width = 0.0
            if lines[-1]:
                width += space
            lines[-1].append((word, is_em))
            width += w
        if len(lines) * int(size * 1.08) <= bottom - top:
            break
        size -= 6

    leading = int(size * 1.08)
    y = bottom - leading * len(lines)
    for line in lines:
        x = PAD
        for i, (word, is_em) in enumerate(line):
            f = italic if is_em else roman
            if i:
                x += d.textlength(' ', font=roman)
            d.text((x, y), word, font=f, fill=TEAL if is_em else PAPER)
            x += d.textlength(word, font=f)
        y += leading

    d.line([(PAD, H - PAD - 26), (W - PAD, H - PAD - 26)], fill=LINE, width=1)
    d.text((PAD, H - PAD - 10), 'QUICKFLOW.DEV', font=mono, fill=FAINT)
    mark = 'MARKETPLACE, MIGRARE, PLĂȚI' if slug.startswith('ro') else 'MARKETPLACES, MIGRATION, PAYMENTS'
    d.text((W - PAD - d.textlength(mark, font=mono), H - PAD - 10), mark, font=mono, fill=FAINT)

    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f'{slug}.png'
    img.save(dst, optimize=True)
    return dst


def main() -> None:
    # The headlines are Romanian. On a Windows console that still defaults to
    # cp1252, printing one raises rather than prints.
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass

    if not DIST.is_dir():
        sys.exit('dist/ not found. Run npm run build first.')

    total = 0
    made: list[str] = []
    pages = sorted(DIST.rglob('index.html')) + sorted(DIST.glob('404.html'))
    for page in pages:
        if page.name == '404.html':
            slug = '404'
        else:
            rel = page.relative_to(DIST).parent.as_posix()
            slug = 'home' if rel == '.' else rel.replace('/', '-')
        src = page.read_text(encoding='utf-8')

        h1 = re.search(r'<h1[^>]*>(.*?)</h1>', src, re.S)
        if not h1:
            continue
        runs = runs_from_headline(h1.group(1))
        if not runs:
            continue

        # The section, from the route rather than from the page: the first .spec
        # on the home page is a service name, not a page label, and it read as
        # if the whole site were about migration.
        eyebrow = SECTIONS.get(slug, '')

        dst = draw_page(slug, eyebrow, runs)
        made.append(slug)
        total += dst.stat().st_size
        print(f'  {dst.name:34} {dst.stat().st_size / 1024:6.1f} KB  {" ".join(w for w, _ in runs)[:46]}')

    # The layout reads this to decide what to put in og:image. Without it, a new
    # page would point at an image nobody generated, and the only symptom would
    # be a grey rectangle in somebody else's chat window.
    manifest = ROOT / 'src' / 'content' / 'og.json'
    manifest.write_text(
        json.dumps(sorted(made), ensure_ascii=False, indent='\t') + '\n', encoding='utf-8'
    )
    print(f'  {len(made)} images, {total / 1024:.0f} KB in total, listed in {manifest.name}')


if __name__ == '__main__':
    main()
