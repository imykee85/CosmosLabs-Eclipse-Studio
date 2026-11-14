"""Fetch voice-activity (VAD) files for every annotated file and its conversation partner (text only)."""
import csv, sys, os, collections, urllib.request
from concurrent.futures import ThreadPoolExecutor
R, OUT = sys.argv[1], sys.argv[2]  # repo dir, data dir
rows = list(csv.DictReader(open(R + '/assets/filelist.csv'))); info = {r['file_id']: r for r in rows}
g = collections.defaultdict(list)
for r in rows: g[r['file_id'].rsplit('_P', 1)[0]].append(r['file_id'])
want = set()
for r in rows:
    if r['has_annotation_3p'] == '1' or r['has_annotation_1p'] == '1': want.update(g[r['file_id'].rsplit('_P', 1)[0]])
B = "https://dl.fbaipublicfiles.com/seamless_interaction"
def get(fid):
    r = info[fid]; p = f"{OUT}/annvad/{fid}.jsonl"
    if os.path.exists(p): return 'cached'
    os.makedirs(os.path.dirname(p), exist_ok=True)
    try:
        req = urllib.request.Request(f"{B}/{r['label']}/{r['split']}/metadata/vad/{fid}.jsonl", headers={'User-Agent': 'research-analysis/1.0'})
        with urllib.request.urlopen(req, timeout=30) as x: open(p, 'wb').write(x.read())
        return 'ok'
    except Exception: return 'err'
with ThreadPoolExecutor(8) as ex: print(len(want), collections.Counter(ex.map(get, sorted(want))))
