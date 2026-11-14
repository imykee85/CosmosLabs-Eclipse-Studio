import json, os, sys, glob, csv, statistics as st, collections, re
D, R = sys.argv[1], sys.argv[2]
info = {r['file_id']: r for r in csv.DictReader(open(R+'/assets/filelist.csv'))}
bfi = {(r['vendor_id'], r['participant_id']): r for r in csv.DictReader(open(R+'/assets/participants.csv'))}
BC = set("yeah yes yep yup mm mhm mm-hmm mmhmm uh-huh uhhuh hmm right okay ok oh wow really nice true totally exactly sure cool gotcha interesting absolutely definitely ah aha huh no nope".split())
def words_of(path):
    out=[]
    for line in open(path):
        seg=json.loads(line)
        for w in seg.get('words',[]):
            if w.get('start') is not None and w.get('end') is not None: out.append((w['start'],w['end'],w['word']))
    return out
def vad_of(path): return [(d['start'],d['end']) for d in map(json.loads,open(path))]
def ipus(fid):
    v=vad_of(f"{D}/pairs/vad/{fid}.jsonl"); w=words_of(f"{D}/pairs/transcript/{fid}.jsonl")
    res=[]
    for s,e in v:
        ws=[x[2] for x in w if s-0.05 <= (x[0]+x[1])/2 <= e+0.05]
        toks=[re.sub(r"[^a-z\-']","",t.lower()) for t in ws]; toks=[t for t in toks if t]
        bc = 0<len(toks)<=3 and all(t in BC for t in toks) and (e-s)<1.6
        res.append(dict(s=s,e=e,n=len(toks),bc=bc,text=' '.join(ws)))
    return res
pairs=collections.defaultdict(list)
for p in glob.glob(f"{D}/pairs/vad/*.jsonl"):
    fid=os.path.basename(p)[:-6]
    if os.path.exists(f"{D}/pairs/transcript/{fid}.jsonl"): pairs[fid.rsplit('_P',1)[0]].append(fid)
stats=collections.defaultdict(lambda: collections.defaultdict(list)); per_person=[]
for key,fids in pairs.items():
    if len(fids)!=2: continue
    label=info[fids[0]]['label']; S=stats[label]
    U={f:ipus(f) for f in fids}
    allu=sorted([(u['s'],u['e'],f,u) for f in fids for u in U[f] if u['n']>0], key=lambda x:x[0])
    if len(allu)<10: continue
    span=max(x[1] for x in allu)-min(x[0] for x in allu)
    # turns from non-backchannel IPUs
    turns=[]
    for s,e,f,u in allu:
        if u['bc']: continue
        if turns and turns[-1]['f']==f: turns[-1]['e']=max(turns[-1]['e'],e); turns[-1]['words']+=u['n']; turns[-1]['ipus'].append((s,e))
        else: turns.append(dict(f=f,s=s,e=e,words=u['n'],ipus=[(s,e)]))
    for a,b in zip(turns,turns[1:]):
        S['fto'].append(b['s']-a['e'])
    for t in turns:
        S['turn_dur'].append(t['e']-t['s']); S['turn_words'].append(t['words'])
        for (s1,e1),(s2,e2) in zip(t['ipus'],t['ipus'][1:]):
            if s2>e1: S['within_pause'].append(s2-e1)
    for f in fids:
        other=[x for x in fids if x!=f][0]
        oturns=[t for t in turns if t['f']==other]; ospeech=sum(t['e']-t['s'] for t in oturns)
        bcs=[u for u in U[f] if u['bc']]
        inside=sum(1 for u in bcs if any(t['s']<=u['s']<=t['e'] for t in oturns))
        own=sum(u['e']-u['s'] for u in U[f] if not u['bc'] and u['n']>0)
        tot=own+sum(u['e']-u['s'] for u in U[other] if not u['bc'] and u['n']>0)
        if ospeech>20:
            S['bc_per_min'].append(len(bcs)/(ospeech/60)); S['bc_inside_share'].append(inside/max(1,len(bcs)))
        for u in bcs: S['bc_words'].append(u['text'].lower().strip('.,!?'))
        r=info[f]; v,pid=re.match(r"V(\d+)_S\d+_I\d+_P(\d+)",f).groups()
        b=bfi.get((v,pid))
        myturns=[t for t in turns if t['f']==f]
        if b and b['extraversion_raw'] not in ('Undisclosed','') and ospeech>20 and myturns:
            per_person.append(dict(label=label,E=float(b['extraversion_raw']),A=float(b['agreeableness_raw']),N=float(b['neuroticism_raw']),O=float(b['openness_raw']),C=float(b['conscientiousness_raw']),
                share=own/max(tot,1e-6),bc=len(bcs)/(ospeech/60),turn=st.median(t['e']-t['s'] for t in myturns)))
def q(x,p): x=sorted(x); return x[int(p*(len(x)-1))]
out={}
for label,S in stats.items():
    f=S['fto']; o={}
    o['pairs']=sum(1 for k,v in pairs.items() if len(v)==2 and info[v[0]]['label']==label)
    o['transitions']=len(f); o['fto_median_ms']=round(st.median(f)*1000); o['fto_p25_ms']=round(q(f,.25)*1000); o['fto_p75_ms']=round(q(f,.75)*1000)
    o['overlap_pct']=round(100*sum(x<0 for x in f)/len(f),1); o['gap_0_500ms_pct']=round(100*sum(0<=x<0.5 for x in f)/len(f),1)
    o['gap_over_1s_pct']=round(100*sum(x>1 for x in f)/len(f),1); o['gap_over_2s_pct']=round(100*sum(x>2 for x in f)/len(f),1)
    o['turn_dur_median_s']=round(st.median(S['turn_dur']),1); o['turn_dur_p90_s']=round(q(S['turn_dur'],.9),1); o['turn_words_median']=st.median(S['turn_words'])
    o['within_turn_pause_median_ms']=round(st.median(S['within_pause'])*1000); o['within_pause_over_1s_pct']=round(100*sum(x>1 for x in S['within_pause'])/len(S['within_pause']),1)
    o['backchannels_per_min_partner_speech_median']=round(st.median(S['bc_per_min']),1)
    o['backchannels_during_partner_turn_pct']=round(100*st.mean(S['bc_inside_share']),1)
    o['top_backchannels']=collections.Counter(S['bc_words']).most_common(12)
    out[label]=o
def corr(xs,ys):
    mx,my=st.mean(xs),st.mean(ys); sx=sum((x-mx)**2 for x in xs)**.5; sy=sum((y-my)**2 for y in ys)**.5
    return round(sum((x-mx)*(y-my) for x,y in zip(xs,ys))/(sx*sy),2) if sx and sy else None
out['bfi_n']=len(per_person)
for trait in 'EAONC':
    out[f'r_{trait}']={m:corr([p[trait] for p in per_person],[p[m] for p in per_person]) for m in ['share','bc','turn']}
E=sorted(per_person,key=lambda p:p['E']); n=len(E)//3
for name,grp in [('low_E_third',E[:n]),('high_E_third',E[-n:])]:
    out[name]={m:round(st.median(p[m] for p in grp),2) for m in ['share','bc','turn']}|{'E_range':(round(grp[0]['E'],2),round(grp[-1]['E'],2))}
json.dump(out,open(f"{D}/timing_results.json",'w'),indent=1); print(json.dumps(out,indent=1))
