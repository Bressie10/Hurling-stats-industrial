<script>
  import LpNav from './LpNav.svelte'
  import LpFooter from './LpFooter.svelte'

  export let onNavigate = () => {}

  const lastUpdated = 'April 8, 2026'
</script>

<div class="lp terms-page">
  <div class="lp-noise"></div>
  <LpNav {onNavigate} currentPage="terms" />

  <div class="legal-wrap">
    <div class="legal-header">
      <div class="legal-eyebrow">Legal</div>
      <h1 class="legal-title">Terms of Service</h1>
      <p class="legal-meta">Last updated: {lastUpdated}</p>
    </div>

    <div class="legal-body">
      <div class="legal-intro">
        By using Hurling Stats you agree to these terms. Please read them carefully.
        If you do not agree, do not use the service.
      </div>

      <section class="legal-section">
        <h2>1. Acceptance of terms</h2>
        <p>
          These Terms of Service ("Terms") govern your access to and use of Hurling Stats
          (the "Service"), operated by the Doora Barefield GAA project ("we", "our", "us").
          By creating an account or using the Service you accept these Terms in full.
        </p>
      </section>

      <section class="legal-section">
        <h2>2. Eligibility</h2>
        <p>
          You must be at least 16 years old to use the Service. By using the Service you
          confirm you are 16 or older. Club owners accepting these Terms on behalf of a club
          represent that they have authority to do so.
        </p>
      </section>

      <section class="legal-section">
        <h2>3. Your account</h2>
        <ul>
          <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li>You must provide accurate information when creating your account.</li>
          <li>One person may not use another person's account without permission.</li>
          <li>You must notify us immediately at <a href="mailto:hello@hurlingstats.com">hello@hurlingstats.com</a> if you suspect unauthorised access.</li>
          <li>We may suspend or terminate accounts that violate these Terms.</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>4. Subscriptions and billing</h2>

        <h3>Plans</h3>
        <p>The Service is available on a free tier and paid subscription plans (Personal Pro, Club, Club Pro). Plan features and pricing are listed on the <button class="legal-link-btn" on:click={() => onNavigate('pricing')}>Pricing page</button>.</p>

        <h3>Billing</h3>
        <p>
          Paid plans are billed monthly in advance via Stripe. By subscribing you authorise
          recurring charges to your payment method. All prices are in euros (€) and inclusive
          of VAT where applicable.
        </p>

        <h3>Free trial</h3>
        <p>
          Where offered, a free trial period begins on the date you provide payment details.
          Your card will be charged at the end of the trial unless you cancel before it ends.
        </p>

        <h3>Cancellation</h3>
        <p>
          You may cancel at any time through the Stripe Customer Portal in Settings &gt; Manage billing.
          Cancellation takes effect at the end of the current billing period — you retain access
          until then. We do not offer partial-month refunds.
        </p>

        <h3>Refunds</h3>
        <p>
          If you are charged in error, contact us within 14 days and we will issue a refund.
          We comply with the EU Consumer Rights Directive for eligible consumers.
        </p>

        <h3>Price changes</h3>
        <p>
          We will give at least 30 days' notice before increasing subscription prices.
          Notice will be sent by email. Continuing to use the Service after the change date
          constitutes acceptance of the new price.
        </p>
      </section>

      <section class="legal-section">
        <h2>5. Your data and content</h2>
        <p>
          You retain ownership of all match statistics, squad data, and other content you
          create using the Service ("Your Content"). You grant us a limited, non-exclusive
          licence to store and process Your Content solely to provide the Service to you.
        </p>
        <p>
          We will not use Your Content for any purpose beyond operating the Service without
          your explicit consent. We do not sell your data to third parties.
        </p>
        <p>
          You are responsible for ensuring Your Content does not infringe third-party rights
          and complies with applicable laws.
        </p>
      </section>

      <section class="legal-section">
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose</li>
          <li>Attempt to gain unauthorised access to other users' accounts or data</li>
          <li>Reverse-engineer, scrape, or copy any part of the Service</li>
          <li>Upload malicious code, viruses, or harmful content</li>
          <li>Resell or sublicense the Service without written permission</li>
          <li>Use automated tools to create accounts or generate excessive load on our servers</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>7. Club accounts and team members</h2>
        <p>
          Club plan subscribers ("Club Owners") may invite coaches and players to their club.
          Club Owners are responsible for the activity of their invited members and for ensuring
          invited users are aware of and agree to these Terms.
        </p>
        <p>
          Club Owners may remove team members at any time. Team members lose access to
          club data upon removal.
        </p>
      </section>

      <section class="legal-section">
        <h2>8. Service availability</h2>
        <p>
          We aim for high availability but do not guarantee uninterrupted service. The app
          is designed to work offline so local data is always accessible regardless of server
          status.
        </p>
        <p>
          We may modify, suspend, or discontinue features at any time. For material changes
          to paid plans, we will provide at least 30 days' notice.
        </p>
      </section>

      <section class="legal-section">
        <h2>9. Intellectual property</h2>
        <p>
          The Service, its design, code, branding, and documentation are our intellectual
          property and protected by copyright. Nothing in these Terms grants you ownership
          of any part of the Service.
        </p>
      </section>

      <section class="legal-section">
        <h2>10. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by Irish law, we shall not be liable for any
          indirect, incidental, special, or consequential damages arising from your use of
          the Service, including loss of data, loss of revenue, or loss of profits.
        </p>
        <p>
          Our total liability for any claim arising out of these Terms shall not exceed the
          amount you paid us in the three months preceding the claim.
        </p>
        <p>
          Nothing in these Terms excludes or limits liability for fraud, death or personal
          injury caused by negligence, or any other liability that cannot be excluded under
          Irish law.
        </p>
      </section>

      <section class="legal-section">
        <h2>11. Disclaimer of warranties</h2>
        <p>
          The Service is provided "as is" and "as available" without warranty of any kind,
          express or implied, including warranties of merchantability, fitness for a particular
          purpose, or non-infringement, to the extent permitted by law.
        </p>
      </section>

      <section class="legal-section">
        <h2>12. Termination</h2>
        <p>
          You may delete your account at any time by contacting us at
          <a href="mailto:hello@hurlingstats.com">hello@hurlingstats.com</a>.
          Account deletion removes your data from our servers within 30 days.
        </p>
        <p>
          We may terminate your account immediately for material breach of these Terms, or
          with 30 days' notice for any other reason. On termination of a paid plan you will
          retain access until the end of your current billing period.
        </p>
      </section>

      <section class="legal-section">
        <h2>13. Changes to terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be notified by
          email at least 14 days before they take effect. Continued use of the Service after
          the effective date constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section class="legal-section">
        <h2>14. Governing law</h2>
        <p>
          These Terms are governed by the laws of Ireland. Any disputes shall be subject to
          the exclusive jurisdiction of the courts of Ireland. If you are a consumer in the
          EU, you also have the right to use the
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">EU Online Dispute Resolution platform</a>.
        </p>
      </section>

      <section class="legal-section">
        <h2>15. Contact</h2>
        <p>
          Questions about these Terms: <a href="mailto:hello@hurlingstats.com">hello@hurlingstats.com</a>
        </p>
      </section>
    </div>
  </div>

  <LpFooter {onNavigate} />
</div>

<style>
  .terms-page { font-family: var(--lp-font-body); }
  .lp-noise {
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px; pointer-events: none; z-index: 9999; opacity: 0.6;
  }

  .legal-wrap { max-width: 760px; margin: 0 auto; padding: calc(68px + 60px) 40px 80px; }

  .legal-header { margin-bottom: 48px; }
  .legal-eyebrow {
    display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--lp-lime); background: rgba(186,255,41,0.1);
    border: 1px solid rgba(186,255,41,0.2); padding: 5px 14px; border-radius: 20px; margin-bottom: 20px;
  }
  .legal-title { font-family: var(--lp-font-head); font-size: clamp(40px, 6vw, 64px); color: var(--lp-text); margin-bottom: 12px; }
  .legal-meta { font-size: 13px; color: var(--lp-text3); }

  .legal-intro {
    font-size: 16px; color: var(--lp-text2); line-height: 1.75;
    background: var(--lp-surface); border: 1px solid var(--lp-border);
    border-radius: 10px; padding: 24px; margin-bottom: 40px;
    border-left: 3px solid var(--lp-amber);
  }

  .legal-section { margin-bottom: 40px; }
  .legal-section h2 {
    font-family: var(--lp-font-head); font-size: 22px; color: var(--lp-text);
    margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--lp-border);
  }
  .legal-section h3 { font-size: 14px; font-weight: 700; color: var(--lp-text); text-transform: uppercase; letter-spacing: 0.06em; margin: 20px 0 10px; }
  .legal-section p { font-size: 14px; color: var(--lp-text2); line-height: 1.75; margin-bottom: 12px; }
  .legal-section p:last-child { margin-bottom: 0; }
  .legal-section ul { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 8px; }
  .legal-section ul li { font-size: 14px; color: var(--lp-text2); line-height: 1.65; padding-left: 16px; position: relative; }
  .legal-section ul li::before { content: '—'; position: absolute; left: 0; color: var(--lp-lime); }
  .legal-section a { color: var(--lp-lime); text-decoration: none; }
  .legal-section a:hover { text-decoration: underline; }
  .legal-link-btn {
    background: none; border: none; padding: 0; font-family: inherit; font-size: inherit;
    color: var(--lp-lime); cursor: pointer; text-decoration: underline;
  }

  @media (max-width: 600px) {
    .legal-wrap { padding-left: 20px; padding-right: 20px; }
  }
</style>
