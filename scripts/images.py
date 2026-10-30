"""Draws every raster the site serves in AVIF and WebP, and measures it.

The site ships 6 KB of JavaScript and says so on the home page. It was also
shipping 225 KB of JPEG for one photograph, which is forty times that, and the
technical annex had been claiming AVIF and WebP since before there was any.

Two things come out of here. The pictures, beside their originals, so the
markup can offer them and fall back to the JPEG for anything that cannot read
them. And `src/content/images.json`, which records what each file actually
measures, so a page can declare the size it really is rather than the size
somebody typed. Two of the five screenshots were 790 pixels wide and declared
800, which is a frame that grows by five pixels the moment the picture lands.

    python -I scripts/images.py

Needs Pillow, which scripts/og.py already needs:

    pip install pillow
"""

import json
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
MANIFEST = ROOT / 'src' / 'content' / 'images.json'

# Screenshots of interfaces, so the enemy is a soft edge on small type rather
# than a gradient. Both numbers were chosen by looking at the result at the
# size the page draws it, not by reading a recommendation.
WEBP = {'quality': 86, 'method': 6}
AVIF = {'quality': 70, 'speed': 4}

# public/og is drawn by scripts/og.py and is not served to a browser: those
# files are fetched by whatever renders a link preview, and a chat window that
# asks for og:image wants the PNG it was pointed at. Offering it an AVIF it
# never requested is 29 files nobody downloads.
SKIP = {'og'}

SOURCES = sorted(
    p
    for p in PUBLIC.rglob('*')
    if p.suffix.lower() in {'.jpg', '.jpeg', '.png'}
    and not (set(p.relative_to(PUBLIC).parts[:-1]) & SKIP)
)


def kb(n: int) -> str:
    return f'{n / 1024:8.1f} KB'


def main() -> None:
    if not SOURCES:
        print('no rasters under public/')
        return

    manifest: dict[str, dict[str, int]] = {}
    totals = [0, 0, 0]

    print(f'{"":38} {"source":>11} {"webp":>11} {"avif":>11}  size')
    for src in SOURCES:
        with Image.open(src) as im:
            im = im.convert('RGB')
            width, height = im.size
            webp = src.with_suffix('.webp')
            avif = src.with_suffix('.avif')
            im.save(webp, 'WEBP', **WEBP)
            im.save(avif, 'AVIF', **AVIF)

        sizes = (src.stat().st_size, webp.stat().st_size, avif.stat().st_size)
        for i, n in enumerate(sizes):
            totals[i] += n

        route = '/' + src.relative_to(PUBLIC).as_posix()
        manifest[route] = {'w': width, 'h': height}
        print(f'{route:38} {kb(sizes[0])} {kb(sizes[1])} {kb(sizes[2])}  {width}x{height}')

    print(f'{"total":38} {kb(totals[0])} {kb(totals[1])} {kb(totals[2])}')
    saved = totals[0] - totals[2]
    print(f'\n{len(SOURCES)} rasters. AVIF saves {kb(saved).strip()}, '
          f'{round(100 * saved / totals[0])}% of what the JPEGs weigh.')

    MANIFEST.write_text(json.dumps(manifest, indent='\t', sort_keys=True) + '\n', encoding='utf-8')
    print(f'{MANIFEST.relative_to(ROOT).as_posix()} holds the real size of each one.')

    # The point of the manifest is that nothing has to be typed twice. If a
    # page still types a size, this is where the two would drift apart.
    for route, size in manifest.items():
        if size['w'] < 1 or size['h'] < 1:
            print(f'  {route} measured {size}, which cannot be right', file=sys.stderr)


if __name__ == '__main__':
    main()
