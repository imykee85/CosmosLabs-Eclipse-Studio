import type { Metadata } from "next";
import LegalPage, { Contact } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — Eclipse" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>This page explains what Eclipse (run by Cosmos Labs AI, Adjei Anuno Street, Accra, Ghana) collects about you, why, who helps us handle it, and the choices you have. Cosmos Labs AI decides how your personal data is used, and we handle it in line with the data protection law of Ghana.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and sign-in information, handled by our sign-in provider.</li>
        <li><strong>Your answers at sign-up:</strong> the short onboarding questions (how you plan to use Eclipse and similar).</li>
        <li><strong>Your work:</strong> projects, prompts, the images you generate or upload, canvases, notes and memories you save, and chats with the Core assistant.</li>
        <li><strong>Credits and payments:</strong> your credit balance and history. Card details go to our payment provider and are never stored by us.</li>
        <li><strong>Connected apps:</strong> if you connect an app such as Telegram, Slack, Discord, Twilio, SendGrid, WhatsApp, Notion, Linear, Todoist, GitHub or Jira, the credential you give us is stored encrypted and used only to send what you ask it to send.</li>
        <li><strong>Technical data:</strong> basic logs (such as errors and request times) that help us keep the service running and secure.</li>
      </ul>

      <h2>How we use it</h2>
      <p>We use your data to run Eclipse for you: to sign you in, make and store your renders, keep your credits right, answer you in Core, prevent abuse and fix problems. We do not sell your personal data, and we do not use your prompts or images to train our own models.</p>

      <h2>Who processes it for us</h2>
      <p>To provide the service we send data to these kinds of providers, only what each one needs:</p>
      <ul>
        <li>sign-in and account management;</li>
        <li>the host of the example videos on the Motion graphics page, which receives a normal web request (your address and browser details) when a video loads;</li>
        <li>database and hosting;</li>
        <li>private file storage for your images and uploads;</li>
        <li>AI image providers, which receive your prompt and any reference image to make a render;</li>
        <li>an AI model provider, which receives your messages, and images you attach or ask the assistant to view, in Core;</li>
        <li>a payment provider for purchases;</li>
        <li>apps you connect yourself, which receive only what you ask the assistant to send.</li>
      </ul>
      <p>At the time of writing these include Clerk (sign-in), Vercel (hosting), Neon (database), Cloudflare (file storage), Higgsfield, Google, OpenAI and BytePlus (images and video), ElevenLabs, Fish Audio and MiniMax (voice and sound), Anthropic (the Core, Atlas and prompt assistants) and Whop (payments). Which ones receive your data depends on the features you use. These providers have their own privacy terms and may process data in other countries, and we cannot control how they handle it, so please read their terms if this matters to you.</p>

      <h2>How your files are kept</h2>
      <p>Your images and uploads are stored in a private bucket. They are shown to you only through short-lived links that expire within minutes, and are available only to your account. Items stay until you delete them: moving an item to the Bin keeps it, and deleting it from the Bin removes the file permanently.</p>

      <h2>Connected apps</h2>
      <p>The credential you give us for a connected app (a token, key or webhook address) is encrypted before it is stored, is used only on our servers to send what you ask it to send, and is never shown back to you or to other people. You can disconnect an app at any time in Core, Connectors, which removes the stored credential. Deleting your account also removes it. You can also revoke the token at the app itself.</p>

      <h2>Voice recordings</h2>
      <p>A recording you add for transcription is deleted as soon as it has been transcribed; we keep only the text. The sample you upload to clone a voice is not kept: we keep a record of your consent and a fingerprint of the sample, and the cloned voice lives with the voice provider until you delete it.</p>

      <h2>How long we keep data</h2>
      <ul>
        <li><strong>Account details and onboarding answers:</strong> while your account is active.</li>
        <li><strong>Projects, images, videos, sounds, canvases, chats and memories:</strong> until you delete them or delete your account. Items in the Bin stay there until you delete them from the Bin.</li>
        <li><strong>Voice recordings for transcription:</strong> deleted as soon as they are transcribed.</li>
        <li><strong>Cloned voices and their consent record:</strong> until you delete the voice or your account.</li>
        <li><strong>Share links:</strong> they expire after 7 days.</li>
        <li><strong>Credit history:</strong> while your account is active.</li>
        <li><strong>Payment and tax records:</strong> up to 7 years, where tax and accounting law require it.</li>
        <li><strong>Technical logs:</strong> up to 90 days.</li>
      </ul>
      <p>When you delete your account we remove your content and personal data from our live systems straight away. Copies in backups can remain for up to 90 days before they are overwritten. We keep only what the law requires or what we need to prevent abuse, such as payment records.</p>

      <h2>Your choices</h2>
      <p>You can delete your projects, images, uploads, memories and chats yourself in the app. You can also ask us to give you a copy of your data, correct it or delete your account. Depending on where you live you may have further rights under data-protection law, such as objecting to certain processing or complaining to your local authority. In Ghana that is the Data Protection Commission.</p>

      <h2>Children</h2>
      <p>Eclipse is not for children. If you are under 16 (or the age of digital consent where you live), please do not create an account.</p>

      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows the latest version, and we will tell you in the app or by email about important changes.</p>

      <Contact />
    </LegalPage>
  );
}
