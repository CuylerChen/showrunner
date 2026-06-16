import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Refund Policy | Showrunner',
  description: 'Refund and cancellation policy for Showrunner subscriptions.',
}

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy" lastUpdated="June 17, 2026">
      <p>
        This Refund Policy explains how refunds for paid Showrunner subscriptions
        are handled. All payments are processed by Paddle.com Market Ltd
        (&quot;Paddle&quot;), which acts as the merchant of record for Showrunner.
      </p>

      <LegalSection title="1. Merchant of Record">
        <p>
          Showrunner subscriptions are sold through Paddle. Paddle is responsible
          for payment processing, invoicing, tax calculation, and issuing refunds
          for purchases made through our checkout. Your purchase and any refund
          are also governed by Paddle&apos;s Invoiced Consumer Terms, available at{' '}
          <a
            href="https://www.paddle.com/legal/invoiced-consumer-terms"
            className="font-medium hover:underline"
            style={{ color: '#16A34A' }}
          >
            https://www.paddle.com/legal/invoiced-consumer-terms
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. 14-day Refund Window">
        <p>
          Consumers may cancel a purchase and request a refund within 14 days of
          completing the transaction, subject to Paddle&apos;s terms and applicable
          law. For subscriptions, this 14-day period generally runs from the date
          of the initial subscription charge or, where applicable, the first
          charge of a renewed term.
        </p>
      </LegalSection>

      <LegalSection title="3. Refunds After 14 Days">
        <p>
          After the 14-day period has passed, refunds are not guaranteed. Refund
          requests outside this window are handled by Paddle on a case-by-case
          basis in accordance with Paddle&apos;s policies, our terms, and applicable
          law.
        </p>
      </LegalSection>

      <LegalSection title="4. Subscriptions and Cancellations">
        <p>
          Subscriptions renew automatically until cancelled. You may cancel your
          subscription at any time. When you cancel, your paid access generally
          remains active until the end of the current billing period, and future
          renewals stop. Cancellation does not automatically create a refund for
          amounts already charged except as required by Paddle&apos;s terms or
          applicable law.
        </p>
      </LegalSection>

      <LegalSection title="5. Usage of Digital Services">
        <p>
          Showrunner provides digital services, including AI-generated scripts,
          narration, rendered videos, and hosted share pages. Refund eligibility
          may be limited where digital services have already been accessed,
          generated, downloaded, or consumed, as described in Paddle&apos;s terms and
          applicable consumer protection laws.
        </p>
      </LegalSection>

      <LegalSection title="6. How to Request a Refund">
        <p>If you believe you are eligible for a refund, you can:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>use the link in your Paddle purchase confirmation email to manage your order and submit a refund request directly to Paddle; or</li>
          <li>
            contact us at{' '}
            <a href="mailto:chenkaileyxy@gmail.com" className="font-medium hover:underline" style={{ color: '#16A34A' }}>
              chenkaileyxy@gmail.com
            </a>{' '}
            with your order details so we can help route your request.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Your Legal Rights">
        <p>
          Nothing in this Refund Policy limits rights you may have under
          applicable consumer protection law, including rights related to products
          or services that are not as described, faulty, or not fit for purpose.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to This Policy">
        <p>
          We may update this Refund Policy from time to time. If we make material
          changes, we will notify you by updating the date above or by other
          reasonable means.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
