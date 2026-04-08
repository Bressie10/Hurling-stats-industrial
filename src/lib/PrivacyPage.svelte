<script>
  import LpNav from './LpNav.svelte'
  import LpFooter from './LpFooter.svelte'

  export let onNavigate = () => {}

  const lastUpdated = 'April 8, 2026'
</script>

<div class="lp privacy-page">
  <div class="lp-noise"></div>
  <LpNav {onNavigate} currentPage="privacy" />

  <div class="legal-wrap">
    <div class="legal-header">
      <div class="legal-eyebrow">Legal</div>
      <h1 class="legal-title">Privacy Policy</h1>
      <p class="legal-meta">Last updated: {lastUpdated}</p>
    </div>

    <div class="legal-body">
      <div class="legal-intro">
        Hurling Stats ("we", "our", "us") is committed to protecting your personal data.
        This policy explains what we collect, why we collect it, and your rights under GDPR
        and applicable Irish data protection law.
      </div>

      <section class="legal-section">
        <h2>1. Who we are</h2>
        <p>
          Hurling Stats is operated by the Doora Barefield GAA project. Our contact email for
          data protection queries is <a href="mailto:privacy@hurlingstats.com">privacy@hurlingstats.com</a>.
        </p>
      </section>

      <section class="legal-section">
        <h2>2. What data we collect</h2>

        <h3>Account data</h3>
        <p>When you create an account we collect:</p>
        <ul>
          <li>Email address (required for sign-in and account recovery)</li>
          <li>Team name and age group (optional, stored in your profile)</li>
          <li>Club name and colour preference (optional)</li>
        </ul>

        <h3>Match and stats data</h3>
        <p>
          Match statistics, squad rosters, puckout logs, opposition scores, and substitutions
          are created by you and stored on your behalf. This data is yours — we process it
          solely to provide the service.
        </p>

        <h3>Usage and technical data</h3>
        <p>
          We collect standard server logs (IP address, browser type, pages visited) for
          security and service monitoring. These logs are retained for 30 days and not used
          for marketing or profiling.
        </p>

        <h3>Payment data</h3>
        <p>
          If you subscribe to a paid plan, payments are processed by Stripe. We never see or
          store your card number, CVV, or full card details. Stripe retains payment data under
          their own privacy policy. We store only a Stripe customer ID and subscription
          status in our database.
        </p>
      </section>

      <section class="legal-section">
        <h2>3. How we use your data</h2>
        <div class="legal-table-wrap">
          <table class="legal-table">
            <thead>
              <tr><th>Purpose</th><th>Legal basis</th></tr>
            </thead>
            <tbody>
              <tr><td>Providing the app and syncing your data</td><td>Contract performance</td></tr>
              <tr><td>Account authentication and security</td><td>Contract performance</td></tr>
              <tr><td>Processing subscription payments</td><td>Contract performance</td></tr>
              <tr><td>Sending transactional emails (password reset, invoice receipts)</td><td>Contract performance</td></tr>
              <tr><td>Fraud prevention and abuse detection</td><td>Legitimate interests</td></tr>
              <tr><td>Complying with legal obligations</td><td>Legal obligation</td></tr>
            </tbody>
          </table>
        </div>
        <p>We do not use your data for advertising, behavioural profiling, or sale to third parties.</p>
      </section>

      <section class="legal-section">
        <h2>4. Data storage and third-party processors</h2>
        <p>Your data is stored and processed using the following sub-processors:</p>
        <div class="legal-table-wrap">
          <table class="legal-table">
            <thead>
              <tr><th>Provider</th><th>Purpose</th><th>Location</th></tr>
            </thead>
            <tbody>
              <tr><td>Supabase (AWS eu-west-1)</td><td>Database, authentication, file storage</td><td>EU (Ireland)</td></tr>
              <tr><td>Stripe</td><td>Payment processing and billing</td><td>EU / US</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Supabase operates within the EU under the EU Standard Contractual Clauses. Stripe
          is certified under the EU-US Data Privacy Framework.
        </p>
        <p>
          <strong>On-device storage:</strong> The app also stores data locally in your browser
          using IndexedDB. This data stays on your device and is cleared when you sign out.
          We have no access to your locally stored data.
        </p>
      </section>

      <section class="legal-section">
        <h2>5. Data retention</h2>
        <ul>
          <li><strong>Account data:</strong> Retained while your account is active. Deleted within 30 days of an account deletion request.</li>
          <li><strong>Match / stats data:</strong> Retained while your account is active. Deleted on account deletion.</li>
          <li><strong>Server logs:</strong> Retained for 30 days then automatically purged.</li>
          <li><strong>Payment records:</strong> Retained by Stripe for legal and tax compliance purposes. We retain subscription metadata (plan, dates) for 7 years in line with Irish tax law.</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>6. Your rights (GDPR)</h2>
        <p>Under the General Data Protection Regulation you have the right to:</p>
        <ul>
          <li><strong>Access</strong> — request a copy of your personal data</li>
          <li><strong>Rectification</strong> — correct inaccurate or incomplete data</li>
          <li><strong>Erasure</strong> — request deletion of your account and associated data</li>
          <li><strong>Portability</strong> — receive your data in a machine-readable format (JSON)</li>
          <li><strong>Restriction</strong> — request that we limit processing of your data</li>
          <li><strong>Objection</strong> — object to processing based on legitimate interests</li>
        </ul>
        <p>
          To exercise any right, email <a href="mailto:privacy@hurlingstats.com">privacy@hurlingstats.com</a>.
          We will respond within 30 days. You also have the right to lodge a complaint with
          the Data Protection Commission (Ireland) at <a href="https://www.dataprotection.ie" target="_blank" rel="noopener">dataprotection.ie</a>.
        </p>
      </section>

      <section class="legal-section">
        <h2>7. Cookies</h2>
        <p>
          Hurling Stats uses only a Supabase authentication session cookie (essential,
          first-party). We do not use advertising, analytics, or tracking cookies.
          No cookie consent banner is required because no non-essential cookies are set.
        </p>
      </section>

      <section class="legal-section">
        <h2>8. Children</h2>
        <p>
          This service is not directed at children under 16. We do not knowingly collect
          data from anyone under 16. If you believe a child has created an account, contact
          us and we will delete it promptly.
        </p>
      </section>

      <section class="legal-section">
        <h2>9. Changes to this policy</h2>
        <p>
          We may update this policy as the service evolves. Material changes will be notified
          by email to registered users at least 14 days before they take effect. The date at
          the top of this page always reflects the current version.
        </p>
      </section>

      <section class="legal-section">
        <h2>10. Contact</h2>
        <p>
          For any privacy queries: <a href="mailto:privacy@hurlingstats.com">privacy@hurlingstats.com</a>
        </p>
      </section>
    </div>
  </div>

  <LpFooter {onNavigate} />
</div>

<style>
  .privacy-page { font-family: var(--lp-font-body); }
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
    border-left: 3px solid var(--lp-lime);
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

  .legal-table-wrap { overflow-x: auto; margin: 16px 0; }
  .legal-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .legal-table th {
    background: var(--lp-surface); color: var(--lp-text3); font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px;
    padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--lp-border);
  }
  .legal-table td { padding: 10px 14px; color: var(--lp-text2); border-bottom: 1px solid rgba(30,58,95,0.4); vertical-align: top; }
  .legal-table tr:last-child td { border-bottom: none; }

  @media (max-width: 600px) {
    .legal-wrap { padding-left: 20px; padding-right: 20px; }
  }
</style>
