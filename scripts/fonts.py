"""Builds the four font files in public/fonts from the upstream variable fonts.

Why this exists. Google Fonts served 540 KB to a Romanian page: Newsreader
roman and italic were 450 KB of that on their own, because the files carry
every weight from 200 to 800 and every optical size from 6 to 72, and the whole
Latin and Latin Extended blocks. The site uses three weights, two optical sizes
and about a hundred characters.

What it does, in order: narrows the variable axes to the range the stylesheet
asks for, keeps only the characters the built pages contain plus a margin, and
writes woff2. Result: 160 KB, and no third-party connection in the critical
path.

Run it after the copy gains a character the subset does not carry. A missing
glyph does not throw, it renders as a box or silently falls back, and nobody
notices until a reader does.

    npm run build          # dist/ has to exist first, the charset is read from it
    python scripts/fonts.py

Needs fontTools with the woff2 extra:

    pip install "fonttools[woff2]"
"""

import pathlib
import re
import subprocess
import sys
import urllib.request

STRIP_CODE = re.compile(r'<(script|style)\b[^>]*>.*?</\1>', re.S | re.I)
STRIP_TAGS = re.compile(r'<[^>]+>')

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
OUT = ROOT / 'public' / 'fonts'
CACHE = ROOT / '.font-cache'

UPSTREAM = 'https://github.com/google/fonts/raw/main/ofl'

# source file, axis limits, output name, script. The limits mirror global.css:
# display type asks for weights 300 to 500 and optical sizes 18 to 60, body for
# 400 to 600, mono for 400 to 500. Widen a range here before using it in the
# CSS, or the browser clamps and the weight silently stops changing.
#
# The script decides which characters a face has to carry, and it is here
# because Newsreader and Plus Jakarta Sans have no Cyrillic at all. Before the
# Russian page there was one charset and every face had to cover it. Now a face
# is held to the pages written in its own script, and both scripts get the
# Latin margin, since the Russian page still writes Stripe, IBAN, EUR and
# digits.
FAMILIES = [
    (
        'newsreader/Newsreader%5Bopsz,wght%5D.ttf',
        {'opsz': (18, 60), 'wght': (300, 500)},
        'newsreader-roman.woff2',
        'latin',
    ),
    (
        'newsreader/Newsreader-Italic%5Bopsz,wght%5D.ttf',
        {'opsz': (18, 60), 'wght': (300, 400)},
        'newsreader-italic.woff2',
        'latin',
    ),
    (
        'plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf',
        {'wght': (400, 600)},
        'jakarta.woff2',
        'latin',
    ),
    (
        'jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf',
        {'wght': (400, 500)},
        'jetbrains-mono.woff2',
        'latin',
    ),
    # The Russian page only, and only because the two faces above cannot set
    # it. Literata takes the display type and Manrope the body: chosen against
    # the site's own faces rather than picked for coverage, and compared side
    # by side before the choice was made.
    (
        'literata/Literata%5Bopsz,wght%5D.ttf',
        {'opsz': (18, 60), 'wght': (300, 500)},
        'literata.woff2',
        'cyrillic',
    ),
    (
        'manrope/Manrope%5Bwght%5D.ttf',
        {'wght': (400, 600)},
        'manrope.woff2',
        'cyrillic',
    ),
]

# The margin. Everything the built pages contain is kept automatically; this is
# what they might contain tomorrow. Cedillas are in there on purpose: old
# Romanian text pasted from elsewhere carries them, and a box in the middle of a
# word is worse than a wrong diacritic.
MARGIN = set(chr(c) for c in range(0x20, 0x7F))
MARGIN |= set('ăâîșțĂÂÎȘȚ')
MARGIN |= set('şţŞŢ')
MARGIN |= set('„”«»…–—‑·•©®°€£$§¶†‡‰№±×÷≈≠≤≥→←↑↓✓✕')
MARGIN |= set('ÁÀÄÉÈËÍÌÏÓÒÖÚÙÜÑÇáàäéèëíìïóòöúùüñç')


def charsets_from_build() -> dict:
    """What each script's pages actually contain, keyed the way FAMILIES is.

    A page under /ru/ is Russian, everything else is Latin. Splitting them is
    the whole point: subsetting every face to the union would ask Newsreader for
    Cyrillic it does not have, and the coverage check would then fail over a
    page that face never renders.
    """
    if not DIST.is_dir():
        sys.exit('dist/ not found. Run npm run build first: the charset is read from it.')
    used = {'latin': set(), 'cyrillic': set()}
    for page in DIST.rglob('*.html'):
        html = page.read_text(encoding='utf-8')
        html = STRIP_CODE.sub(' ', html)
        text = set(STRIP_TAGS.sub(' ', html))
        script = 'cyrillic' if page.relative_to(DIST).parts[0] == 'ru' else 'latin'
        used[script] |= text
    return used


def fetch(path: str) -> pathlib.Path:
    CACHE.mkdir(exist_ok=True)
    name = urllib.parse.unquote(path.split('/')[-1])
    dst = CACHE / name
    if not dst.exists():
        print(f'  downloading {name}')
        with urllib.request.urlopen(f'{UPSTREAM}/{path}') as r:
            dst.write_bytes(r.read())
    return dst


def main() -> None:
    import urllib.parse  # noqa: F401  (used by fetch, imported late for clarity)
    from fontTools import ttLib
    from fontTools.varLib import instancer

    used = charsets_from_build()
    wanted = {}
    unicodes = {}
    for script, chars in used.items():
        keep = {c for c in (chars | MARGIN) if c.isprintable() and not c.isspace()}
        keep |= {' ', chr(0xA0)}
        wanted[script] = keep
        unicodes[script] = ','.join('U+%04X' % ord(c) for c in sorted(keep))
        seen = len([c for c in chars if c.isprintable()])
        print('%-9s %4d characters in the build, %4d in the subset'
              % (script, seen, len(keep)))

    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for path, limits, out_name, script in FAMILIES:
        src = fetch(path)
        pinned = CACHE / ('pinned-' + out_name + '.ttf')
        instancer.instantiateVariableFont(ttLib.TTFont(src), limits, inplace=False).save(pinned)

        dst = OUT / out_name
        result = subprocess.run(
            [
                sys.executable, '-m', 'fontTools.subset', str(pinned),
                '--unicodes=' + unicodes[script],
                '--layout-features=kern,liga,calt,tnum,case,ccmp,locl,mark,mkmk',
                '--flavor=woff2',
                '--desubroutinize',
                '--no-hinting',
                '--drop-tables+=DSIG',
                '--output-file=' + str(dst),
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            sys.exit('subset failed for ' + out_name + ':' + result.stderr[-800:])

        size = dst.stat().st_size
        total += size
        print('  %-24s %7.1f KB -> %6.1f KB  (%s)'
              % (out_name, src.stat().st_size / 1024, size / 1024, script))

        # Coverage, checked rather than assumed. A character with no glyph does
        # not raise anything: it renders as a box, or falls back to Georgia in
        # the middle of a word, and the first person to notice is a reader.
        #
        # Checked against its own script only. Asking Newsreader for Cyrillic
        # would fail over a page it never renders, and asking Literata for the
        # Romanian pages would fail over pages it never renders either.
        covered = set()
        for table in ttLib.TTFont(dst)['cmap'].tables:
            covered |= {chr(c) for c in table.cmap}
        missing = {c for c in used[script] if c.isprintable() and not c.isspace()} - covered
        if missing:
            sys.exit(out_name + ' is missing glyphs for: ' + repr(sorted(missing)))

    print('  %-24s %11s%6.1f KB' % ('total', '', total / 1024))
    print('  every character in the build has a glyph in the faces that render it')


if __name__ == '__main__':
    import urllib.parse
    main()
