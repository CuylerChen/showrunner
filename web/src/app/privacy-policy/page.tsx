import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy | Showrunner',
  description: 'How Showrunner collects, uses, and protects information.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 17, 2026">
      <p>
        This Privacy Policy explains how Showrunner (&quot;we&quot;, &quot;us&quot;, or
        &quot;our&quot;) collects, uses, discloses, and protects information when you
        use our website, video generation tools, hosted share pages, and related
        services (the &quot;Services&quot;).
      </p>

      <LegalSection title="1. Information We Collect">
        <p>We may collect the following categories of information:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account information, such as email address and authentication details.</li>
          <li>Product URLs, prompts, briefs, audience notes, brand tone, CTA text, and other content you submit.</li>
          <li>Generated scripts, storyboards, audio, rendered videos, share links, and related metadata.</li>
          <li>Usage information, such as video generation counts, plan limits, feature usage, logs, and timestamps.</li>
          <li>Billing and subscription information processed through Paddle.</li>
          <li>Technical information, such as IP address, browser type, device information, cookies, and session data.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How We Use Information">
        <p>We use information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide, operate, secure, and maintain the Services.</li>
          <li>Analyze product pages, generate scripts, create narration, render videos, and host share pages.</li>
          <li>Manage accounts, authentication, subscriptions, plan limits, and customer support.</li>
          <li>Improve product quality, reliability, and safety.</li>
          <li>Communicate with you about service updates, billing, security, and support requests.</li>
          <li>Comply with legal obligations and enforce our agreements.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Service Providers and Sharing">
        <p>
          We do not sell your personal data. We may share information with
          trusted service providers that help us operate the Services, including
          hosting providers, database providers, AI model providers, text-to-speech
          or rendering services, analytics or logging tools, and Paddle for
          billing and subscription management. These providers are authorized to
          use information only as needed to provide services to us.
        </p>
      </LegalSection>

      <LegalSection title="4. Payment Processing">
        <p>
          Payments are processed by Paddle. Paddle may collect billing details,
          payment method information, tax information, and transaction records as
          the merchant of record. We receive subscription status, plan, customer,
          and transaction information needed to manage your Showrunner account.
        </p>
      </LegalSection>

      <LegalSection title="5. Cookies and Sessions">
        <p>
          We use cookies and similar technologies to keep you signed in, remember
          preferences, protect sessions, and understand basic usage patterns. You
          can control cookies through your browser settings, but some features may
          not work correctly without them.
        </p>
      </LegalSection>

      <LegalSection title="6. Data Security">
        <p>
          We use reasonable technical and organizational measures to protect your
          information. However, no method of transmission or storage is completely
          secure, and we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="7. Data Retention">
        <p>
          We retain information for as long as necessary to provide the Services,
          maintain business records, comply with legal obligations, resolve
          disputes, and enforce our agreements. You may request deletion of your
          account or certain personal data by contacting us.
        </p>
      </LegalSection>

      <LegalSection title="8. Your Rights">
        <p>
          Depending on your jurisdiction, you may have rights to access, correct,
          delete, export, or object to certain processing of your personal data.
          To exercise these rights, contact us using the email below.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>
          The Services are not directed to children under 13, and we do not
          knowingly collect personal information from children under 13.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you
          of material changes by updating the date above or by other reasonable
          means.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          If you have questions about this Privacy Policy, contact us at{' '}
          <a href="mailto:chenkaileyxy@gmail.com" className="font-medium hover:underline" style={{ color: '#16A34A' }}>
            chenkaileyxy@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
