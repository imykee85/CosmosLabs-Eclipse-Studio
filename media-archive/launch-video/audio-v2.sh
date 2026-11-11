#!/bin/bash
# Draft sound bed for film v2, built from the owner's 11.9 s file to the length in timeline.json.
set -e; cd "$(dirname "$0")"; mkdir -p out
ffmpeg -v error -y -i assets/launch-audio.mp3 -filter_complex "[0:a]atrim=0:8.5,afade=t=out:st=8.3:d=0.2[a];
[0:a]atrim=4.6:8.2,asetpts=PTS-STARTPTS,afade=t=in:d=0.15,afade=t=out:st=3.4:d=0.2,volume=0.55,asplit=7[l0][l1][l2][l3][l4][l5][l6];
[l0]adelay=8300:all=1[b0];
[l1]adelay=11900:all=1[b1];
[l2]adelay=15500:all=1[b2];
[l3]adelay=19100:all=1[b3];
[l4]adelay=22700:all=1[b4];
[l5]adelay=26300:all=1[b5];
[l6]adelay=29900:all=1[b6];
[0:a]atrim=6.95:8.2,asetpts=PTS-STARTPTS,afade=t=out:st=0.9:d=0.35,adelay=31299:all=1[h];
[a][b0][b1][b2][b3][b4][b5][b6][h]amix=inputs=9:normalize=0:duration=longest,afade=t=out:st=31.20:d=1.2,atrim=0:32.40,alimiter=limit=0.95[o]" -map "[o]" -c:a aac -b:a 256k out/bed-full.m4a
echo bed done
