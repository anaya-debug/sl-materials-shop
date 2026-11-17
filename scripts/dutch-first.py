# One-off: make Dutch the text that is in index.html itself (for search engines and AI crawlers
# that read the raw HTML), and keep English as the alternative in data-en / data-en-<attr>.
# The NL / EN switch (js/i18n.js) works the same either way.
import html
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
s = open(path, encoding='utf-8').read()

# 1. Elements: <tag ... data-nl="NL">EN</tag>  ->  <tag ... data-nl="NL" data-en="EN">NL</tag>
start_re = re.compile(r'<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?\sdata-nl="([^"]*)"[^>]*)>')
out, pos, n = [], 0, 0
for m in start_re.finditer(s):
    if m.start() < pos:
        continue  # inside an element already handled
    tag, attrs, nl_attr = m.group(1), m.group(2), m.group(3)
    if 'data-en=' in attrs:
        continue
    # find the matching end tag, counting nested tags of the same name
    depth, i = 1, m.end()
    tok = re.compile(rf'<(/?){tag}\b[^>]*>', re.I)
    while depth:
        t = tok.search(s, i)
        if not t:
            raise SystemExit(f'no end tag for <{tag}> at {m.start()}')
        depth += -1 if t.group(1) else 1
        i = t.end()
        end_start = t.start()
    en_inner = s[m.end():end_start]
    nl_inner = html.unescape(nl_attr)
    en_attr = html.escape(en_inner, quote=True)
    out.append(s[pos:m.start()])
    out.append(f'<{tag}{attrs} data-en="{en_attr}">{nl_inner}</{tag}>')
    pos = i
    n += 1
out.append(s[pos:])
s = ''.join(out)

# 2. Attributes: attr="EN" ... data-nl-attr="NL"  ->  attr="NL" ... data-en-attr="EN" data-nl-attr="NL"
an = 0
for attr in ['alt', 'aria-label', 'content', 'placeholder']:
    tag_re = re.compile(rf'<[^>]*\sdata-nl-{attr}="[^"]*"[^>]*>')
    def fix(m):
        global an
        t = m.group(0)
        if f'data-en-{attr}=' in t:
            return t
        nl = re.search(rf'\sdata-nl-{attr}="([^"]*)"', t).group(1)
        cur = re.search(rf'\s{attr}="([^"]*)"', t)
        if not cur:
            return t
        an += 1
        t = t.replace(cur.group(0), f' {attr}="{nl}" data-en-{attr}="{cur.group(1)}"', 1)
        return t
    s = tag_re.sub(fix, s)

open(path, 'w', encoding='utf-8').write(s)
print(f'{n} elements and {an} attributes now Dutch-first')
