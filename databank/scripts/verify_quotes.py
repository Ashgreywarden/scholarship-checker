import json, sys, re, hashlib, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
def norm(s): return re.sub(r'\s+', ' ', s.replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"').replace('–','-').replace('—','-')).strip().lower()
bad = 0; total = 0
for f in sorted((root/'schemes').glob('*.json')):
    s = json.loads(f.read_text())
    raws = [norm((root/src['raw_file']).read_text()) for src in s['sources'] if (root/src['raw_file']).exists()]
    if not raws: print(f'{f.name}: NO RAW TEXT'); bad += 1; continue
    def check(q):
        global total, bad
        if not q: return
        total += 1
        ok = any(norm(q) in r for r in raws)
        if not ok: bad += 1; print(f'  {f.name}: QUOTE NOT FOUND: {q[:90]}')
        return ok
    for r in s.get('rules', []): r['quote_verified'] = check(r.get('quote'))
    check(s.get('amount', {}).get('quote')); check(s.get('deadline', {}).get('quote'))
    for d in s.get('documents', []): check(d.get('quote'))
    for src in s['sources']:
        p = root/src['raw_file']
        if p.exists(): src['sha256'] = hashlib.sha256(p.read_bytes()).hexdigest()
    f.write_text(json.dumps(s, indent=2, ensure_ascii=False))
print(f'quotes checked: {total}, failed: {bad}')
sys.exit(1 if bad else 0)
