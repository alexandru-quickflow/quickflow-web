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

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
OUT = ROOT / 'public' / 'fonts'
CACHE = ROOT / '.font-cache'

UPSTREAM = 'https://github.com/google/fonts/raw/main/ofl'

# source file, axis limits, output name. The limits mirror global.css: display
# type asks for weights 300 to 500 and optical sizes 18 to 60, body for 400 to
# 600, mono for 400 to 500. Widen a range here before using it in the CSS, or
# the browser clamps and the weight silently stops changing.
FAMILIES = [
    (
        'newsreader/Newsreader%5Bopsz,wght%5D.ttf',
        {'opsz': (18, 60), 'wght': (300, 500)},
        'newsreader-roman.woff2',
    ),
    (
        'newsreader/Newsreader-Italic%5Bopsz,wght%5D.ttf',
        {'opsz': (18, 60), 'wght': (300, 400)},
        'newsreader-italic.woff2',
    ),
    (
        'plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf',
        {'wght': (400, 600)},
        'jakarta.woff2',
    ),
    (
        'jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf',
        {'wght': (400, 500)},
        'jetbrains-mono.woff2',
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


def charset_from_build() -> set[str]:
    if not DIST.is_dir():
        sys.exit('dist/ not found. Run npm run build first: the charset is read from it.')
    used: set[str] = set()
    for page in DIST.rglob('*.html'):
        html = page.read_text(encoding='utf-8')
        html = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', ' ', html, flags=re.S | re.I)
        used |= set(re.sub(r'<[^>]+>', ' ', html))
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

    used = charset_from_build()
    charset = {c for c in (used | MARGIN) if c.isprintable() and not c.isspace()}
    charset |= {' ', ' '}
    unicodes = ','.join(f'U+{ord(c):04X}' for c in sorted(charset))
    print(f'{len([c for c in used if c.isprintable()])} characters in the build, '
          f'{len(charset)} in the subset')

    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for path, limits, out_name in FAMILIES:
        src = fetch(path)
        pinned = CACHE / f'pinned-{out_name}.ttf'
        instancer.instantiateVariableFont(ttLib.TTFont(src), limits, inplace=False).save(pinned)

        dst = OUT / out_name
        result = subprocess.run(
            [
                sys.executable, '-m', 'fontTools.subset', str(pinned),
                f'--unicodes={unicodes}',
                '--layout-features=kern,liga,calt,tnum,case,ccmp,locl,mark,mkmk',
                '--flavor=woff2',
                '--desubroutinize',
                '--no-hinting',
                '--drop-tables+=DSIG',
                f'--output-file={dst}',
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            sys.exit(f'subset failed for {out_name}:\n{result.stderr[-800:]}')

        size = dst.stat().st_size
        total += size
        print(f'  {out_name:24} {src.stat().st_size / 1024:7.1f} KB -> {size / 1024:6.1f} KB')

        # Coverage, checked rather than assumed. A character with no glyph does
        # not raise anything: it renders as a box, or falls back to Georgia in
        # the middle of a word, and the first person to notice is a reader.
        covered: set[str] = set()
        for table in ttLib.TTFont(dst)['cmap'].tables:
            covered |= {chr(c) for c in table.cmap}
        missing = {c for c in used if c.isprintable() and not c.isspace()} - covered
        if missing:
            sys.exit(f'{out_name} is missing glyphs for: {sorted(missing)}')

    print(f'  {"total":24} {" " * 11}{total / 1024:6.1f} KB')
    print('  every character in the build has a glyph in every face')


if __name__ == '__main__':
    import urllib.parse
    main()
