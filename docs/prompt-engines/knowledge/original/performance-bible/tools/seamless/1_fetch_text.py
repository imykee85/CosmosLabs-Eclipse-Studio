import csv, json, os, sys, random, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor
R, OUT = sys.argv[1], sys.argv[2]
B = "https://dl.fbaipublicfiles.com/seamless_interaction"
rows = list(csv.DictReader(open(R+'/assets/filelist.csv')))
info = {r['file_id']: r for r in rows}
jobs = []
# A) every annotated file: all annotation types it has
for r in rows:
    types = []
    if r['has_annotation_3p']=='1': types += ['3P-IS','3P-R','3P-V']
    if r['has_annotation_1p']=='1': types += ['1P-IS','1P-R']
    for t in types:
        jobs.append((f"{B}/{r['label']}/{r['split']}/annotations/{t}/{r['file_id']}.json", f"{OUT}/ann/{t}/{r['file_id']}.json"))
# B) conversation pairs: same V_S_I, two participants -> transcript + vad
groups = collections.defaultdict(list)
for r in rows:
    k = r['file_id'].rsplit('_P',1)[0]; groups[(r['label'],k)].append(r['file_id'])
random.seed(7)
for label, n in [('improvised',90),('naturalistic',90)]:
    pairs = [v for (l,k),v in groups.items() if l==label and len(v)==2]
    for pair in random.sample(pairs, min(n,len(pairs))):
        for fid in pair:
            r=info[fid]
            for m in ['transcript','vad']:
                jobs.append((f"{B}/{r['label']}/{r['split']}/metadata/{m}/{fid}.jsonl", f"{OUT}/pairs/{m}/{fid}.jsonl"))
def get(j):
    url, path = j
    if os.path.exists(path): return 'cached'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'research-analysis/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp: data = resp.read()
        open(path,'wb').write(data); return 'ok'
    except Exception as e:
        return f'err {getattr(e,"code",e)}'
with ThreadPoolExecutor(8) as ex: res = list(ex.map(get, jobs))
print(len(jobs), collections.Counter(r if not r.startswith('err') else r for r in res).most_common(8))
