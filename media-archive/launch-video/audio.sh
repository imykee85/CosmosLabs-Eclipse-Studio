#!/bin/bash
# Draft sound bed from the owner's 11.9 s file (assets/launch-audio.mp3): original opening, the music section looped quieter under the app screens,
# the original second half under the machines run, a quiet loop under the finale and a hit on each end-card line.
set -e; cd "$(dirname "$0")"; A=assets/launch-audio.mp3; mkdir -p out
ffmpeg -v error -y -i $A -filter_complex "
[0:a]atrim=0:8.5,afade=t=out:st=8.3:d=0.2[a];
[0:a]atrim=4.6:8.2,asetpts=PTS-STARTPTS,afade=t=in:d=0.15,afade=t=out:st=3.4:d=0.2,volume=0.5,asplit=4[l1][l2][l3][l4];
[l1]adelay=8300:all=1[b1];[l2]adelay=11800:all=1[b2];[l3]adelay=15300:all=1,afade=t=out:st=17.3:d=0.4[b3];
[0:a]atrim=8.29:10.8,asetpts=PTS-STARTPTS,afade=t=out:st=2.3:d=0.2,adelay=17500:all=1[c];
[l4]volume=0.7,adelay=20000:all=1[d];
[0:a]atrim=6.95:8.2,asetpts=PTS-STARTPTS,afade=t=out:st=0.9:d=0.35,asplit=2[h1][h2];[h1]adelay=22050:all=1[e1];[h2]adelay=22880:all=1[e2];
[a][b1][b2][b3][c][d][e1][e2]amix=inputs=8:normalize=0:duration=longest,afade=t=out:st=23.3:d=0.7,atrim=0:24,alimiter=limit=0.95[o]" -map "[o]" -c:a aac -b:a 256k out/bed-24s.m4a
ffmpeg -v error -y -i $A -filter_complex "
[0:a]atrim=0:10.6,afade=t=out:st=10.3:d=0.3[a];
[0:a]atrim=8.29:10.8,asetpts=PTS-STARTPTS,afade=t=out:st=2.3:d=0.2,adelay=10500:all=1[c];
[0:a]atrim=6.95:8.2,asetpts=PTS-STARTPTS,afade=t=out:st=0.9:d=0.35,asplit=2[h1][h2];[h1]adelay=13350:all=1[e1];[h2]adelay=14000:all=1[e2];
[a][c][e1][e2]amix=inputs=4:normalize=0:duration=longest,afade=t=out:st=14.4:d=0.6,atrim=0:15,alimiter=limit=0.95[o]" -map "[o]" -c:a aac -b:a 256k out/bed-15s.m4a
echo beds done
