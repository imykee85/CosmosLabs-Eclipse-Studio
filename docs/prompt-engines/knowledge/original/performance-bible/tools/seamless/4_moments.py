import json, glob, os, sys, re, csv, collections, statistics as st
D, R = sys.argv[1], sys.argv[2]
info={r['file_id']:r for r in csv.DictReader(open(R+'/assets/filelist.csv'))}
bfi={(r['vendor_id'],r['participant_id']):r for r in csv.DictReader(open(R+'/assets/participants.csv'))}
def load(t,fid):
    p=f"{D}/ann/{t}/{fid}.json"
    if not os.path.exists(p): return {}
    out={}
    for line in open(p):
        line=line.strip()
        if line:
            d=json.loads(line); out[(d['start_ts'],d['end_ts'])]=d['annotation']
    return out
def vad(fid):
    p=f"{D}/annvad/{fid}.jsonl"
    return [(d['start'],d['end']) for d in map(json.loads,open(p))] if os.path.exists(p) else None
def ov(segs,s,e): return sum(max(0,min(e,b)-max(s,a)) for a,b in segs)
partners=collections.defaultdict(list)
for f in info: partners[f.rsplit('_P',1)[0]].append(f)
moments=[]
for p in glob.glob(f"{D}/ann/3P-V/*.json"):
    fid=os.path.basename(p)[:-5]
    V,IS,RR=load('3P-V',fid),load('3P-IS',fid),load('3P-R',fid); S1,R1=load('1P-IS',fid),load('1P-R',fid)
    own=vad(fid); oth=[x for x in partners[fid.rsplit('_P',1)[0]] if x!=fid]; ov_=vad(oth[0]) if oth else None
    v_,pid=re.match(r"V(\d+)_S\d+_I\d+_P(\d+)",fid).groups(); b=bfi.get((v_,pid))
    for k,vis in V.items():
        s,e=k; dur=e-s
        role='unknown'
        if own is not None and ov_ is not None and dur>0:
            o1,o2=ov(own,s,e)/dur, ov(ov_,s,e)/dur
            role='speaking' if o1>=0.3 and o1>=o2 else ('listening' if o2>=0.3 else 'silence')
        E=float(b['extraversion_raw']) if b and b['extraversion_raw'] not in ('Undisclosed','') else None
        moments.append(dict(fid=fid,label=info[fid]['label'],dur=dur,vis=vis,st=IS.get(k,''),why=RR.get(k,''),self=S1.get(k),selfwhy=R1.get(k),role=role,E=E))
STATES={'amused':r'amus|laugh|funny|humou?r|jok|playful|entertain','happy':r'happ|joy|pleas|excit|enthus|delight|glad|cheer|content','confident':r'confiden|assert|determin|proud|decisive|domina|self-assured|certain\b',
'thinking':r'think|thought|reflect|recall|remember|consider|concentrat|focus|process|ponder|contemplat|search','uncertain':r'unsure|uncertain|confus|hesita|doubt|puzzl',
'nervous':r'nervous|anxi|uncomfort|awkward|tense|embarrass|shy|insecur|self-conscious|worried','frustrated':r'frustrat|annoy|irritat|angry|anger|upset|defensiv|exasperat',
'surprised':r'surpris|shock|startl|astonish|disbelief','engaged':r'interest|engag|curious|attentiv|listen','sad':r'\bsad|disappoint|hurt|sorrow|regret|melanchol',
'skeptical':r'skeptic|disagree|dismiss|unconvinc|suspicious','empathetic':r'empath|sympath|agree|understand|support|validat|compassion'}
BEH={'smile':r'smil|grin','laugh':r'laugh|chuckl|giggl','nod':r'\bnod','head shake':r'shak\w* (his |her |their )?head|shook (his |her |their )?head|head shak','eyebrows':r'eyebrow|brow',
'gaze away/down/up':r'look\w* (away|down|up|aside|off)|eyes? (up|down|away|to the side)|gaze\w* (away|down|up|off)|avert','eye contact':r'eye contact|look\w* (at|directly at) (the )?(partner|other)',
'hand gesture':r'gestur|hands? (move|moving|motion|up|out|open|apart|together)|waves?|waving|point','self-touch (face/hair/neck)':r'touch\w* (his |her |their )?(face|chin|hair|neck|nose|mouth|forehead|cheek|ear)|rub\w* (his |her |their )?(face|chin|eyes|nose|neck|forehead)|scratch|hand (on|to) (the )?(face|chin|mouth)',
'lean':r'lean','shrug':r'shrug','head tilt':r'tilt','arms crossed':r'cross\w* (his |her |their )?arms|arms crossed','lips/mouth':r'\blips?\b|purse|bit\w* (his |her |their )?lip|mouth','eyes widen/close/squint':r'eyes? (wid|clos|narrow|squint|roll)|wide.?eyed|blink|roll\w* (his |her |their )?eyes',
'breath/sigh':r'sigh|exhal|breath|inhal','fidget/object':r'fidget|play\w* with|\badjust\w*|\btap\w*|\bpen\b|\bglass|\bcup\b|\bphone|\brings?\b|sleeve|\bnecklace|\bclothes|\bshirt','posture shift':r'posture|sit\w* (back|up|forward)|sat (back|up)|straighten|shift\w* (in|his|her|their)|slouch|move\w* back',
'head movement':r'head (back|down|up|turn|move|bob|forward|to the side)|turn\w* (his |her |their )?head|tilt\w* back','pause/stop':r'paus|stop\w* (talk|speak)|silent|quiet'}
def cats(text,D_): 
    t=text.lower(); return [k for k,rx in D_.items() if re.search(rx,t)]
for m in moments: m['states']=cats(m['st'],STATES); m['behs']=cats(m['vis'],BEH); m['selfstates']=cats(m['self'] or '',STATES)
res={}
res['n_moments']=len(moments); res['by_label']=collections.Counter(m['label'] for m in moments)
d=[m['dur'] for m in moments if m['dur']>0]; res['dur_s']=dict(median=st.median(d),p10=sorted(d)[len(d)//10],p90=sorted(d)[9*len(d)//10])
res['role']=collections.Counter(m['role'] for m in moments)
res['beh_overall_pct']={k:round(100*sum(k in m['behs'] for m in moments)/len(moments),1) for k in BEH}
res['beh_by_role_pct']={r:{k:round(100*sum(k in m['behs'] for m in grp)/len(grp),1) for k in BEH} for r in ['speaking','listening','silence'] for grp in [[m for m in moments if m['role']==r]] if grp}
res['n_behaviors_per_moment']=collections.Counter(min(len(m['behs']),4) for m in moments)
res['states_pct']={k:round(100*sum(k in m['states'] for m in moments)/len(moments),1) for k in STATES}
res['beh_by_state_pct']={}
for s in STATES:
    grp=[m for m in moments if s in m['states']]
    if len(grp)>=25:
        res['beh_by_state_pct'][s]=dict(n=len(grp),speaking_pct=round(100*sum(m['role']=='speaking' for m in grp)/len(grp)),top=sorted(((k,round(100*sum(k in m['behs'] for m in grp)/len(grp))) for k in BEH),key=lambda x:-x[1])[:6])
both=[m for m in moments if m['self']]
res['self_vs_observer']=dict(n=len(both))
agree=[m for m in both if m['selfstates'] and m['states']]
res['self_vs_observer']['n_both_categorized']=len(agree)
res['self_vs_observer']['any_overlap_pct']=round(100*sum(bool(set(m['selfstates'])&set(m['states'])) for m in agree)/max(1,len(agree)),1)
conf=collections.Counter()
for m in agree:
    for a in m['selfstates']:
        for b in m['states']: conf[(a,b)]+=1
res['self_vs_observer']['top_pairs']=conf.most_common(15)
selfc=collections.Counter(s for m in both for s in m['selfstates']); obsc=collections.Counter(s for m in both for s in m['states'])
res['self_vs_observer']['self_state_freq']=selfc.most_common(10); res['self_vs_observer']['observer_state_freq_same_moments']=obsc.most_common(10)
withE=[m for m in moments if m['E'] is not None and m['label']=='naturalistic']; Es=sorted(m['E'] for m in withE); lo,hi=Es[len(Es)//3],Es[2*len(Es)//3]
for name,grp in [('low_E',[m for m in withE if m['E']<=lo]),('high_E',[m for m in withE if m['E']>=hi])]:
    res[name]=dict(n=len(grp),E_cut=(lo,hi),beh_pct={k:round(100*sum(k in m['behs'] for m in grp)/len(grp),1) for k in BEH},states_pct={k:round(100*sum(k in m['states'] for m in grp)/len(grp),1) for k in STATES})
json.dump(res,open(f"{D}/ann_results.json",'w'),indent=1,default=str); print(json.dumps(res,indent=1,default=str))
json.dump([{k:m[k] for k in ['fid','label','dur','role','st','why','vis','self','selfwhy','states','behs']} for m in moments],open(f"{D}/moments.json",'w'))
