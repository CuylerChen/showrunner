import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service | Showrunner',
  description: 'Terms that govern access to and use of Showrunner.',
}

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="June 17, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of
        Showrunner&apos;s website, video generation tools, hosted share pages, and
        related services (collectively, the &quot;Services&quot;). By accessing or using
        the Services, you agree to be bound by these Terms.
      </p>

      <LegalSection title="1. Use of the Services">
        <p>
          Showrunner helps users generate product promotional videos from product
          URLs, written context, AI-generated scripts, narration, and rendered
          video scenes. You may use the Services only in compliance with
          applicable laws and these Terms. You are responsible for your account,
          credentials, input content, and activity under your account.
        </p>
      </LegalSection>

      <LegalSection title="2. Customer Content">
        <p>
          You retain ownership of product URLs, briefs, text, screenshots,
          assets, and other content that you submit to the Services
          (&quot;Customer Content&quot;). You grant Showrunner the rights needed to
          process, transform, host, and display Customer Content solely to
          provide and improve the Services. You represent that you have the
          necessary rights to submit Customer Content and to use any resulting
          videos.
        </p>
      </LegalSection>

      <LegalSection title="3. AI-generated Output">
        <p>
          The Services may use AI systems to analyze websites, draft scripts,
          create storyboards, generate narration, and render videos. AI output
          may be inaccurate or incomplete. You are responsible for reviewing and
          approving generated videos before publishing or relying on them.
        </p>
      </LegalSection>

      <LegalSection title="4. Payment and Subscriptions">
        <p>
          Paid plans are billed in advance on a subscription basis. Payments are
          processed by Paddle.com Market Ltd (&quot;Paddle&quot;), which acts as the
          merchant of record for Showrunner and is responsible for payment
          processing, invoicing, tax calculation, and refunds. You may cancel a
          subscription at any time; access to paid features generally remains
          available until the end of the current billing period. Refunds, where
          available, are handled in accordance with Paddle&apos;s terms and our
          Refund Policy.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable Use">
        <p>
          You agree not to misuse the Services, including by attempting to
          disrupt the platform, bypass security controls, scrape private or
          unauthorized content, infringe third-party rights, submit unlawful
          material, or use the Services for fraudulent, harmful, or deceptive
          purposes.
        </p>
      </LegalSection>

      <LegalSection title="6. Service Availability">
        <p>
          We work to keep the Services reliable, but we do not guarantee that the
          Services will be uninterrupted, error-free, or available at all times.
          Features, limits, models, voices, and rendering behavior may change as
          the product evolves.
        </p>
      </LegalSection>

      <LegalSection title="7. Disclaimer and Limitation of Liability">
        <p>
          The Services are provided on an &quot;as is&quot; and &quot;as available&quot; basis
          without warranties of any kind, whether express or implied. To the
          maximum extent permitted by law, Showrunner will not be liable for any
          indirect, incidental, special, consequential, or punitive damages
          arising from your use of the Services.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to These Terms">
        <p>
          We may update these Terms from time to time. If we make material
          changes, we will provide notice by updating the date above or by other
          reasonable means. Your continued use of the Services after changes
          take effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          If you have any questions about these Terms, contact us at{' '}
          <a href="mailto:chenkaileyxy@gmail.com" className="font-medium hover:underline" style={{ color: '#16A34A' }}>
            chenkaileyxy@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
