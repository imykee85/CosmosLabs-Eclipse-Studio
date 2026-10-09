import type { Metadata } from "next";
import LegalPage, { Contact } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — Eclipse" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>This page explains what Eclipse (run by Cosmos Labs AI) collects about you, why, who helps us handle it, and the choices you have.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and sign-in information, handled by our sign-in provider.</li>
        <li><strong>Your answers at sign-up:</strong> the short onboarding questions (how you plan to use Eclipse and similar).</li>
        <li><strong>Your work:</strong> projects, prompts, the images you generate or upload, canvases, notes and memories you save, and chats with the Orbit assistant.</li>
        <li><strong>Credits and payments:</strong> your credit balance and history. Card details go to our payment provider and are never stored by us.</li>
        <li><strong>Connected apps:</strong> if you connect an app such as Telegram or Slack, the credential you give us is stored encrypted and used only to send what you ask it to send.</li>
        <li><strong>Technical data:</strong> basic logs (such as errors and request times) that help us keep the service running and secure.</li>
      </ul>

      <h2>How we use it</h2>
      <p>We use your data to run Eclipse for you: to sign you in, make and store your renders, keep your credits right, answer you in Orbit, prevent abuse and fix problems. We do not sell your personal data, and we do not use your prompts or images to train our own models.</p>

      <h2>Who processes it for us</h2>
      <p>To provide the service we send data to these kinds of providers, only what each one needs:</p>
      <ul>
        <li>sign-in and account management;</li>
        <li>the hosts of the example videos on the Motion graphics page (X and the host of the original collection), which receive a normal web request (your address and browser details) when a video loads;</li>
        <li>database and hosting;</li>
        <li>private file storage for your images and uploads;</li>
        <li>AI image providers, which receive your prompt and any reference image to make a render;</li>
        <li>an AI model provider, which receives your messages, and images you attach or ask the assistant to view, in Orbit;</li>
        <li>a payment provider for purchases;</li>
        <li>apps you connect yourself, which receive only what you ask the assistant to send.</li>
      </ul>
      <p>These providers have their own privacy terms and may process data in other countries.</p>

      <h2>How your files are kept</h2>
      <p>Your images and uploads are stored in a private bucket. They are shown to you only through short-lived links that expire within minutes, and are available only to your account. Items stay until you delete them: moving an item to the Bin keeps it, and deleting it from the Bin removes the file permanently.</p>

      <h2>How long we keep data</h2>
      <p>We keep your data while your account is active. If you ask us to delete your account we will remove your content and personal data, except what we must keep by law or to prevent abuse (for example payment records).</p>

      <h2>Your choices</h2>
      <p>You can delete your projects, images, uploads, memories and chats yourself in the app. You can also ask us to give you a copy of your data, correct it or delete your account. Depending on where you live you may have further rights under data-protection law, such as objecting to certain processing or complaining to your local authority.</p>

      <h2>Children</h2>
      <p>Eclipse is not for children. If you are under 16 (or the age of digital consent where you live), please do not create an account.</p>

      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows the latest version, and we will tell you in the app or by email about important changes.</p>

      <Contact />
    </LegalPage>
  );
}
