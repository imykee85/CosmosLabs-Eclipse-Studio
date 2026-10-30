import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import AboutCta from "./AboutCta";
import "./about.css";

// What Eclipse really does today, in Eclipse's own words. Keep this to built features.
const studio = [
  ["Image Studio", "Create images with the leading models. Choose the aspect ratio, quality and how many to make, then edit, upscale, relight or change the camera on what you make."],
  ["Video Studio", "Turn a prompt or a picture into video. Set a start and end frame, add reference pictures, clips and sounds, and keep the sound that comes with it."],
  ["Audio Studio", "Speak a script in a voice you choose, clone or design your own voice, make sound effects and music, and turn recordings into text."],
  ["Atlas", "Your creative partner. Brainstorm, shape a brief, write detailed prompts and look at your pictures and videos. Atlas proposes, you decide."],
  ["Core", "Your creative computer. Chat with memory and skills, and send finished work to connected apps like Telegram and Slack."],
  ["Canvas", "Wire prompts, characters, products, styles and generators together on an open canvas, and let one result feed the next."],
] as const;

const steps = [
  ["01", "Plan", "Start with a brief. Treatment turns a rough idea into a plan, and Prompts writes the detailed prompt for the model you pick."],
  ["02", "Create", "Make images, video and sound in their own studios, with the models you choose, from one set of credits."],
  ["03", "Keep", "Everything lands in your Library, sorted by project, ready to download, share or use again as an ingredient."],
] as const;

const principles = [
  ["You stay in control", "Atlas suggests, you press the button. Nothing is made, and no credits are used, until you say so."],
  ["One place, one project", "Your plan, pictures, clips and sounds live together, so you never hunt for the file you made last week."],
  ["Private by default", "Your files are stored in your own private space, and your share links are ones you create."],
] as const;

export default function AboutPage() {
  return (
    <main className="ab">
      <div className="ab-glow" aria-hidden="true" />
      <header className="ab-top">
        <Link href="/" aria-label="Eclipse home"><LogoMark size={40} /></Link>
        <div className="ab-top-actions">
          <Link className="ab-back" href="/">Back to Eclipse</Link>
          <AboutCta />
        </div>
      </header>

      <section className="ab-hero">
        <p className="ab-eyebrow ab-in" style={{ ["--d" as string]: "0ms" }}>WHY ECLIPSE</p>
        <h1 className="ab-in" style={{ ["--d" as string]: "80ms" }}>One studio for everything you make.</h1>
        <p className="ab-lead ab-in" style={{ ["--d" as string]: "180ms" }}>Eclipse brings images, video, voice and AI agents into one workspace, so an idea can go from a single sentence to finished work without switching tools.</p>
        <div className="ab-in" style={{ ["--d" as string]: "280ms" }}><AboutCta /></div>
      </section>

      <section className="ab-sec">
        <p className="ab-eyebrow">THE IDEA</p>
        <h2>Making content should not mean juggling ten tools.</h2>
        <p className="ab-body">One tool to plan, another for pictures, another for video, another for sound, and folders to keep it all straight. Eclipse puts every step in one workspace that remembers your project, so you spend your time on the idea and not on the tools.</p>
      </section>

      <section className="ab-sec">
        <p className="ab-eyebrow">WHAT IS INSIDE</p>
        <h2>A full creative studio, built around you.</h2>
        <div className="ab-grid">
          {studio.map(([name, text], i) => (
            <article className="ab-card" key={name} style={{ ["--i" as string]: i }}>
              <h3>{name}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ab-sec">
        <p className="ab-eyebrow">HOW IT WORKS</p>
        <h2>From a thought to finished work.</h2>
        <ol className="ab-steps">
          {steps.map(([n, name, text]) => (
            <li key={n}>
              <span className="ab-num">{n}</span>
              <div><h3>{name}</h3><p>{text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="ab-sec">
        <p className="ab-eyebrow">WHAT WE BELIEVE</p>
        <h2>Powerful, and always yours to steer.</h2>
        <div className="ab-grid ab-grid-3">
          {principles.map(([name, text], i) => (
            <article className="ab-card" key={name} style={{ ["--i" as string]: i }}>
              <h3>{name}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ab-final">
        <h2>Your studio is waiting.</h2>
        <p className="ab-lead">Start with a free trial and make your first piece today.</p>
        <AboutCta />
      </section>

      <footer className="ab-foot">
        <Link href="/terms">Terms of Use</Link>
        <Link href="/privacy">Privacy Policy</Link>
      </footer>
    </main>
  );
}
