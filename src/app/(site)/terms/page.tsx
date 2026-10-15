import type { Metadata } from "next";
import LegalPage, { Contact } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Use — Eclipse" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>These terms apply when you use Eclipse, a content-creation service run by Cosmos Labs AI (“we”, “us”). By creating an account or using the service you agree to them. If you do not agree, please do not use Eclipse.</p>

      <h2>Your account</h2>
      <p>You must give accurate details, keep your sign-in secure and be old enough to enter a binding contract where you live. You are responsible for what happens under your account. Tell us if you think someone else has access to it.</p>

      <h2>What you can make</h2>
      <p>Eclipse turns your prompts and reference images into images (and, over time, other media) using AI models from third-party providers. You may not use Eclipse to create, upload or share:</p>
      <ul>
        <li>any sexual or exploitative content involving minors, or content that sexualises people who appear to be minors. We refuse these requests and may report them to the authorities;</li>
        <li>sexual content depicting a real person without their consent, or realistic fake images that impersonate a real person in order to deceive, harass or defraud;</li>
        <li>content that incites violence, promotes terrorism or self-harm, or harasses, threatens or targets a person or group;</li>
        <li>content that infringes someone else’s copyright, trademark, privacy or other rights, or reference images you have no right to use;</li>
        <li>anything illegal, or anything meant to break, overload or gain unauthorised access to Eclipse or its providers.</li>
      </ul>
      <p>Prompts and uploads may be checked automatically. Providers apply their own content filters too, and a request can be refused or a render blocked. We may remove content, limit features or close accounts that break these rules.</p>

      <h2>Your content and ownership</h2>
      <p>You keep the rights you have in the prompts and images you upload. Between you and us, and as far as the law and our providers’ terms allow, you own the images you generate and may use them, including commercially. AI output can be similar to other output, and we cannot promise it is free of third-party rights, so you are responsible for how you use it. You give us permission to store, process and display your content only as needed to run the service for you (including sending prompts and reference images to the providers that make your renders).</p>

      <h2>Credits and payments</h2>
      <p>Some features use credits. Credits are held in your Eclipse account, have no cash value and cannot be transferred. A render is charged only once it has finished successfully. Plans and prices are shown before you pay; payments are handled by our payment provider. Unless the law says otherwise, credits already used are not refundable. If something goes wrong with a charge, contact us and we will look into it.</p>

      <h2>Deleting content</h2>
      <p>Items you delete move to the Bin first. Deleting them from the Bin removes them and the stored file permanently. We may keep minimal records where we are required to by law or to prevent abuse.</p>

      <h2>Availability and changes</h2>
      <p>Eclipse depends on third-party services and is provided “as is”. We try to keep it running but cannot promise it will always be available or error-free, and features may change. We may update these terms; if the changes are important we will tell you in the app or by email. Using Eclipse after a change means you accept it.</p>

      <h2>Our responsibility</h2>
      <p>To the extent the law allows, we are not liable for indirect or consequential losses, lost profits or lost content, and our total liability for any claim is limited to what you paid us in the 12 months before it. Nothing in these terms limits liability that cannot be limited by law, such as for fraud or for death or personal injury caused by negligence.</p>

      <h2>Ending your account</h2>
      <p>You can stop using Eclipse at any time. We may suspend or end an account that breaks these terms or puts the service or other people at risk.</p>

      <Contact />
    </LegalPage>
  );
}
