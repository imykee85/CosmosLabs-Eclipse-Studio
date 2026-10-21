import type { Metadata } from "next";
import LegalPage, { Contact } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Use — Eclipse" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>These terms apply when you use Eclipse, a content-creation service run by Cosmos Labs AI (“we”, “us”), an AI product lab that builds AI tools and applications, based on Adjei Anuno Street, Accra, Ghana. By creating an account or using the service you agree to them. If you do not agree, please do not use Eclipse.</p>

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

      <h2>AI output and the rights of others</h2>
      <p>Eclipse uses AI models from third-party providers, and each provider has its own terms, which can limit how output may be used (for example in commercial work). Please read the terms of the models you use. We do not promise that any output is unique, can be protected by copyright or is free of third-party rights. You must have permission to upload any reference image, including photos of people, faces, logos, artwork and other protected material.</p>
      <p>If you think something in Eclipse infringes your copyright or other rights, contact us using the details at the bottom of this page with a description of the work, where you found the content and your contact details. We may remove the content and may close the accounts of people who repeatedly infringe.</p>

      <h2>Credits and payments</h2>
      <p>Some features use credits. Credits are held in your Eclipse account (or in your team’s shared balance, if you work in a team), have no cash value and cannot be transferred. A render, voice take or message is charged only once it has finished successfully: a request that fails, is blocked by a provider or is cancelled by you is not charged in Eclipse credits. Plans and prices are shown before you pay; payments are handled by our payment provider. You can also buy extra credits as one-time packs, and you can switch automatic top-up on or off at any time in Settings, Billing. Plan credits renew monthly and do not roll over. Top-up credits last 90 days and can be used while you are subscribed. Credits that expire are removed from your balance on their expiry date, and your credit history shows when. If your plan ends, your plan credits expire at the end of the period you paid for; saved top-up credits stay until they expire but cannot be used until you subscribe again. If you delete your account, any credits left in it are deleted with it. Unless the law says otherwise, credits already used are not refundable. If something goes wrong with a charge, or you think a result is defective, contact us and we will look into it.</p>

      <h2>Plans, renewal and cancellation</h2>
      <p>Paid plans are monthly subscriptions. A plan renews automatically every 30 days at the price shown when you bought it, until you cancel. Taxes may be added at checkout. We will tell you before a price change takes effect, and it applies from your next renewal.</p>
      <p>You can cancel at any time. Cancelling stops future renewals; you keep your plan until the end of the period you have already paid for, and no further payment is taken. You can cancel in Settings, Billing, with the Cancel plan button, from the membership page of our payment provider (the link is in your payment receipt), or by contacting us. Deleting your Eclipse account also cancels your plan.</p>

      <h2>Refunds</h2>
      <ul>
        <li><strong>First payment on a plan:</strong> if you have used none of that plan’s credits, you can ask for a full refund within 7 days of paying.</li>
        <li><strong>Renewals:</strong> a renewal is not refundable once it has been taken, so please cancel before your renewal date if you do not want to continue. If a renewal was taken after you cancelled, or by mistake, we will refund it.</li>
        <li><strong>Top-up packs:</strong> if you have used none of the pack’s credits, you can ask for a full refund within 14 days of buying.</li>
        <li><strong>Mistakes and double charges:</strong> a duplicate or wrongly taken payment is always refunded.</li>
        <li><strong>Failed or defective results:</strong> a failed, blocked or cancelled request is not charged. If a finished result is defective, contact us and we may restore the credits instead of refunding money.</li>
        <li><strong>Used credits:</strong> credits already spent on finished work are not refundable.</li>
      </ul>
      <p>To ask for a refund, contact us using the details at the bottom of this page. Approved refunds go back to the original payment method through our payment provider and can take several business days to show. When a payment is refunded, the credits it paid for are removed from your balance. Nothing here limits any refund or cooling-off right you have under the law where you live.</p>

      <h2>Deleting content</h2>
      <p>Items you delete move to the Bin first. Deleting them from the Bin removes them and the stored file permanently. We may keep minimal records where we are required to by law or to prevent abuse.</p>

      <h2>Availability and changes</h2>
      <p>Eclipse depends on third-party services and is provided “as is”. We try to keep it running but cannot promise it will always be available or error-free, and features may change. We may update these terms; if the changes are important we will tell you in the app or by email. Using Eclipse after a change means you accept it.</p>

      <h2>Our responsibility</h2>
      <p>To the extent the law allows, we are not liable for indirect or consequential losses, lost profits or lost content, and our total liability for any claim is limited to what you paid us in the 12 months before it. Nothing in these terms limits liability that cannot be limited by law, such as for fraud or for death or personal injury caused by negligence.</p>

      <h2>Governing law</h2>
      <p>These terms and any dispute about Eclipse are governed by the laws of Ghana, and the courts of Ghana can hear any dispute, unless the law where you live gives you the right to bring a claim somewhere else.</p>

      <h2>Ending your account</h2>
      <p>You can stop using Eclipse at any time. We may suspend or end an account that breaks these terms or puts the service or other people at risk.</p>

      <Contact />
    </LegalPage>
  );
}
