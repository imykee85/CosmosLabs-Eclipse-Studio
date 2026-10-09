// Motion graphics: a library of motion videos made with AI, with the prompt behind each one. Each entry is a post on X by its
// creator, shown through X's own embed (the video plays inside X's player, credited and linked to the original post); we do not
// host or copy the videos. Entries were taken from the user's Prompt Motion project (their Manus build). Add more by appending
// an entry with the post's id (the number at the end of its x.com address).
export type MotionTag = "Product UI" | "Phone" | "Charts" | "Diagrams" | "Kinetic type" | "Shapes" | "Particles" | "Characters" | "Photos" | "Music" | "Code";
export const MOTION_TAGS: MotionTag[] = ["Product UI", "Phone", "Charts", "Diagrams", "Kinetic type", "Shapes", "Particles", "Characters", "Photos", "Music", "Code"];

export type MotionPrompt = {
  id: string; title: string; tags: MotionTag[]; prompt: string; model: string; tries: string; posted: string; ratio: "16 / 9" | "9 / 16" | "1 / 1";
  handle: string; name: string; xId: string;
};

export const motionPrompts: MotionPrompt[] = [
  {
    "id": "emollick-8661a8",
    "title": "Recursion explained in genres",
    "handle": "emollick",
    "name": "Ethan Mollick",
    "xId": "2103688362960019567",
    "tags": [
      "Characters",
      "Code"
    ],
    "prompt": "A video explaining recursion, where every explanation about recursion has a radically different video style, make this self-referential & clever & fast moving.",
    "model": "Opus 5.5",
    "tries": "One-shot",
    "posted": "Sep 26, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "davidmarcus-a28a60",
    "title": "Lightspark social promo video",
    "handle": "davidmarcus",
    "name": "David Marcus",
    "xId": "2103275618045686217",
    "tags": [
      "Kinetic type",
      "Code"
    ],
    "prompt": "make a punchy and modern short video for social that promotes @lightspark capabilities. Needs to be production grade with sound",
    "model": "Opus 5.5",
    "tries": "One-shot",
    "posted": "Sep 25, 2026",
    "ratio": "9 / 16"
  },
  {
    "id": "ho-ba-f3f0e9",
    "title": "mdfor.dev product intro video",
    "handle": "HO_BA",
    "name": "Ihab Khattab",
    "xId": "2103845264649761062",
    "tags": [
      "Product UI",
      "Code"
    ],
    "prompt": "Make a dynamic 30-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.  Make it a video to introduce https://t.co/xdCXEdKZRq Use actual product screenshot/logo/assets Must have music and motion must match the music  Do it like a real professional production video, not like a demo or prototype. Add more animation and motion design; avoid using screenshots as raw; instead, break them down into components/icons so we can animate those too. Make the motions more juicy. Use the best motion design techniques you can.",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 26, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "viktoroddy-98c1d8",
    "title": "MotionSites one million visitors",
    "handle": "viktoroddy",
    "name": "Viktor Oddy",
    "xId": "2103802280617402509",
    "tags": [
      "Product UI",
      "Charts",
      "Code"
    ],
    "prompt": "Create a launch video for MotionSites AI, just hit 1 million monthly visitors after 8 months after launch.",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 26, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "kloss-xyz-15182a",
    "title": "Chaotic Claude POV video",
    "handle": "kloss_xyz",
    "name": "klöss",
    "xId": "2103664956482941143",
    "tags": [
      "Kinetic type",
      "Code"
    ],
    "prompt": "Use Python to generate a 9:16 chaotic brain rot video with excellent motion + sound design and render it using ffmpeg. Put your own personal spin on it so it’s aligned with Anthropic’s new launch. Also fully express what it’s like to be a very creative LLM used by me every day from your POV to give it some extra personality.",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 26, 2026",
    "ratio": "9 / 16"
  },
  {
    "id": "ddryo-loos-300829",
    "title": "Lism CSS 1.0 release video",
    "handle": "ddryo_loos",
    "name": "了@Lism",
    "xId": "2105824736072925621",
    "tags": [
      "Product UI",
      "Code"
    ],
    "prompt": "Lism CSS ver.1.0 をリリースする時にSNSに動画を投稿したい。あなたがどれほど素晴らしいモーションデザイナーかを示す、シンプルかつダイナミックさもある15秒のモーショングラフィックスビデオを作成してください。",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Oct 2, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "yunn260414-60d996",
    "title": "What is Git explainer",
    "handle": "Yunn260414",
    "name": "Yunn",
    "xId": "2104044910769016888",
    "tags": [
      "Diagrams",
      "Code"
    ],
    "prompt": "帮我用js制作一个视频，主题是：什么是Git",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 27, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "hqmank-7c61f1",
    "title": "Browser automation skill launch",
    "handle": "hqmank",
    "name": "Kai",
    "xId": "2103831140033241156",
    "tags": [
      "Product UI",
      "Music",
      "Code"
    ],
    "prompt": "Make a dynamic 20-second motion graphics launch video for my open-source project jev-browser-skill ('Give a site. Write a goal. Jev clicks.'), like it's the hero video on its GitHub README. Go all out.",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 26, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "ezshine-c90d73",
    "title": "AI Arena product promo",
    "handle": "ezshine",
    "name": "大帅老猿",
    "xId": "2103501705698750731",
    "tags": [
      "Product UI",
      "Code"
    ],
    "prompt": "设计个动画，介绍本项目的各项特性，像是专业的产品介绍宣传片，最后要生成 16:9 的mp4 视频",
    "model": "Opus 5.5",
    "tries": "One-shot",
    "posted": "Sep 25, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "techyoutbe-945b56",
    "title": "Visual guides library launch",
    "handle": "techyoutbe",
    "name": "Tech Fusionist | Kushal Gangil",
    "xId": "2103465227807588678",
    "tags": [
      "Product UI",
      "Diagrams",
      "Code"
    ],
    "prompt": "I want you to create a highly professional SaaS product launch video. Go and find some SaaS, preferably just one that people know, so it's easier to identify with it. Pick that, and then make sure to get actual assets and images and all of that stuff from the internet. Turn it into these typical, very professionally edited, motion-graphics-styled product launch videos that you see people making on Twitter when they launch new SaaS products (which are showing off the features, the benefits, and all of these things)",
    "model": "Opus 5.5",
    "tries": "One-shot",
    "posted": "Sep 25, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "theviableedge-9065be",
    "title": "Second brain service promo",
    "handle": "TheViableEdge",
    "name": "Adam Sandler",
    "xId": "2104207707980869918",
    "tags": [
      "Product UI",
      "Code"
    ],
    "prompt": "make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, and can be the hero asset for the course landing page.",
    "model": "Opus 5.5",
    "tries": "One-shot",
    "posted": "Sep 27, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "misbahsy-80eaec",
    "title": "LiteLLM promo reel",
    "handle": "MisbahSy",
    "name": "Misbah Syed",
    "xId": "2103831201114882277",
    "tags": [
      "Diagrams",
      "Music",
      "Code"
    ],
    "prompt": "make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 26, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "madhav-xo-f97f20",
    "title": "Personal research intro reel",
    "handle": "Madhav_XO",
    "name": "Madhav",
    "xId": "2103605007396524440",
    "tags": [
      "Kinetic type",
      "Particles",
      "Code"
    ],
    "prompt": "make a 10 sec video on whatever you know about me",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 25, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "rames-jusso-589f80",
    "title": "UK dubstep track with ASCII visuals",
    "handle": "Rames_Jusso",
    "name": "James Russo",
    "xId": "2103200703598776559",
    "tags": [
      "Music",
      "Code"
    ],
    "prompt": "140 BPM rusko/skream style UK dubstep",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 24, 2026",
    "ratio": "1 / 1"
  },
  {
    "id": "kamstudiolabs-c9bb28",
    "title": "Animated short about a bug",
    "handle": "KamStudioLabs",
    "name": "Çağrı | KAM Studio",
    "xId": "2102903173161877996",
    "tags": [
      "Characters",
      "Code"
    ],
    "prompt": "Make a 90-second animated short film about a bug that doesn't want to be fixed.",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 23, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "kyonax-on-tech-aabc1d",
    "title": "org2html product showreel",
    "handle": "kyonax_on_tech",
    "name": "Cristian D. Moreno - 京",
    "xId": "2103482598144049316",
    "tags": [
      "Product UI",
      "Code"
    ],
    "prompt": "make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.",
    "model": "Opus 5.5",
    "tries": "One-shot",
    "posted": "Sep 25, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "robvjourney-ce3e1a",
    "title": "Nohandslabs brand promo",
    "handle": "robvjourney",
    "name": "iamrobinvv",
    "xId": "2103768390322237474",
    "tags": [
      "Kinetic type",
      "Particles",
      "Code"
    ],
    "prompt": "Can you make a 15-second motion graphic video of https://t.co/4AZZ7AlJvi? Go ALL OUT and make the most badass video you possibly can use everything you've got.",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 26, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "amol909s-27533e",
    "title": "Commotion app showreel",
    "handle": "Amol909S",
    "name": "Amol Sawrikar",
    "xId": "2103456534768607293",
    "tags": [
      "Product UI",
      "Phone",
      "Code"
    ],
    "prompt": "make a dynamic 20s motion graphics video that shows what an incredible motion designer you are, like it's your showreel for this app commotion, highlighting tiling layout, auto model classifer and other features you deem fit to be in video. Go all out.",
    "model": "Opus 5.5",
    "tries": "Not stated",
    "posted": "Sep 25, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "jazzen-chen-4542ae",
    "title": "AgentHud project motion video",
    "handle": "Jazzen_Chen",
    "name": "Jazzen Chen",
    "xId": "2103751442393894989",
    "tags": [
      "Product UI",
      "Code"
    ],
    "prompt": "make a dynamic motion graphics video about my project AgentHud.",
    "model": "Opus 5.5",
    "tries": "One-shot",
    "posted": "Sep 26, 2026",
    "ratio": "16 / 9"
  },
  {
    "id": "iammxfschr-d68f90",
    "title": "Database client launch video",
    "handle": "iamMXFSCHR",
    "name": "Max 🌊📱",
    "xId": "2103619221296955831",
    "tags": [
      "Product UI",
      "Code"
    ],
    "prompt": "nice. wir brauchen ein launch video für den release. kannst du das machen? so a la anthropic like? hab da was gelesen und der prompt war \"\"make a modern slick and punchy video for a modern startup that works on inference\"",
    "model": "Opus 5.5",
    "tries": "A few rounds",
    "posted": "Sep 25, 2026",
    "ratio": "16 / 9"
  }
];

export const findMotion = (id: string) => motionPrompts.find((p) => p.id === id);
export const postUrl = (p: MotionPrompt) => `https://x.com/${p.handle}/status/${p.xId}`;
