# Run before publishing: stamps every CSS/JS link and import with a new version,
# so browsers always load the latest files together (never old and new mixed).
import re, glob, time
v = time.strftime('%Y%m%d%H%M')
for f in glob.glob('js/*.js'):
    s = open(f).read()
    s2 = re.sub(r"(from\s+'\./[\w-]+\.js)(\?v=\w+)?'", lambda m: f"{m.group(1)}?v={v}'", s)
    if s2 != s: open(f, 'w').write(s2)
for f in ['index.html', 'planner.html']:
    s = open(f).read()
    open(f, 'w').write(re.sub(r'((?:src|href)="(?:js|css)/[\w-]+\.(?:js|css))(\?v=\w+)?"', lambda m: f'{m.group(1)}?v={v}"', s))
print('version', v)
