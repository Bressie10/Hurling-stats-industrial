<script>
  import LpNav from './LpNav.svelte'
  import LpFooter from './LpFooter.svelte'

  export let pageType = 'privacy'
  export let onNavigate = () => {}

  const contactEmail = 'contact@gaastatsapp.com'

  const meta = {
    privacy: {
      eyebrow: 'Privacy',
      title: 'Privacy Policy',
      lead: 'How GAAstat collects, uses, stores, and deletes data for coaches and clubs.',
      updated: 'June 12, 2026'
    },
    terms: {
      eyebrow: 'Terms',
      title: 'Terms of Use',
      lead: 'The rules for using GAAstat on the web, iOS, Android, and installed app experiences.',
      updated: 'June 12, 2026'
    },
    support: {
      eyebrow: 'Support',
      title: 'Support',
      lead: 'Help for account access, offline sync, subscriptions, and match-day issues.',
      updated: 'June 12, 2026'
    },
    delete: {
      eyebrow: 'Account deletion',
      title: 'Delete Your Account',
      lead: 'How to permanently delete your GAAstat account and associated cloud data.',
      updated: 'June 12, 2026'
    }
  }

  $: current = meta[pageType] || meta.privacy
</script>

<div class="lp legal-page">
  <div class="lp-noise"></div>
  <LpNav {onNavigate} currentPage={pageType} />

  <main class="legal-wrap">
    <header class="legal-hero">
      <div class="legal-eyebrow">{current.eyebrow}</div>
      <h1>{current.title}</h1>
      <p>{current.lead}</p>
      <div class="legal-updated">Last updated: {current.updated}</div>
    </header>

    {#if pageType === 'privacy'}
      <section>
        <h2>Overview</h2>
        <p>GAAstat is an offline-first hurling match statistics app for coaches. The app stores match, squad, and settings data on your device and can sync account data to Supabase so signed-in users can back up and restore their work.</p>
      </section>

      <section>
        <h2>Data We Collect</h2>
        <ul>
          <li>Account details such as email address, authentication identifiers, and club/team membership.</li>
          <li>Match and squad data you enter, including player names, player numbers, match events, notes, lineups, substitutions, puckouts, reports, and stat targets.</li>
          <li>Subscription and entitlement records needed to decide which features your account can access.</li>
          <li>Voice clips and match context sent for Sideline AI transcription or answer generation when you choose to use voice features.</li>
          <li>Basic technical information needed to run the app, secure sessions, diagnose failures, and sync offline changes.</li>
        </ul>
      </section>

      <section>
        <h2>How Data Is Used</h2>
        <p>We use your data to provide account access, offline match logging, cloud sync, reports, team features, live match sharing, support, fraud prevention, and app reliability. We do not sell match data or squad data.</p>
      </section>

      <section>
        <h2>Storage And Processors</h2>
        <p>Device data is stored locally using browser storage such as IndexedDB. Cloud account and sync data is stored with Supabase. Web subscription checkout and billing are handled by Stripe outside native store builds. Sideline AI features may send audio or match context to OpenAI for transcription and responses.</p>
      </section>

      <section>
        <h2>Retention And Deletion</h2>
        <p>Local data remains on your device until you delete it, sign out, clear site/app storage, or delete the app. Cloud data remains until it is deleted through account deletion or support handling. You can delete your account in Settings or request deletion at the public deletion page.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>For privacy questions, email <a href="mailto:{contactEmail}">{contactEmail}</a>.</p>
      </section>
    {:else if pageType === 'terms'}
      <section>
        <h2>Using GAAstat</h2>
        <p>GAAstat is provided for coaches and clubs to record, analyse, and review hurling match statistics. You are responsible for the accuracy of data you enter and for ensuring you have permission to record any player or team information you store in the app.</p>
      </section>

      <section>
        <h2>Accounts</h2>
        <p>You must keep your login details secure. Club owners are responsible for managing team codes and coach access. Coaches should not share accounts.</p>
      </section>

      <section>
        <h2>Subscriptions</h2>
        <p>Feature access depends on the entitlement attached to your account. Native iOS and Android store builds are for signed-in access and free account use; plan purchases and plan changes are not offered inside those builds.</p>
      </section>

      <section>
        <h2>Offline Use</h2>
        <p>GAAstat is designed to work offline after initial setup, but sync and account access require connectivity. Always sign in and open the app before going to a ground with limited signal.</p>
      </section>

      <section>
        <h2>Acceptable Use</h2>
        <p>Do not use GAAstat to store unlawful content, access another account without permission, interfere with app services, or attempt to bypass entitlement or security controls.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>For terms or account questions, email <a href="mailto:{contactEmail}">{contactEmail}</a>.</p>
      </section>
    {:else if pageType === 'support'}
      <section>
        <h2>Contact Support</h2>
        <p>Email <a href="mailto:{contactEmail}">{contactEmail}</a> with your account email, device type, browser or app version, and a short description of the issue.</p>
      </section>

      <section>
        <h2>Before A Match</h2>
        <ul>
          <li>Sign in while you have signal.</li>
          <li>Open the match screen and confirm your squad is visible.</li>
          <li>Tap Sync after editing squad or settings.</li>
          <li>Keep the app installed and avoid clearing site/app storage before sync completes.</li>
        </ul>
      </section>

      <section>
        <h2>Common Issues</h2>
        <p>If sign-in fails, check your email confirmation and network connection. If data is missing on a new device, sign in with the same account and tap Sync. If voice capture is unavailable, check microphone permission and confirm you are signed in.</p>
      </section>

      <section>
        <h2>Account And Data Requests</h2>
        <p>Use the account deletion page for deletion requests. For corrections, exports, or privacy questions, email support from the address on your GAAstat account.</p>
      </section>
    {:else if pageType === 'delete'}
      <section>
        <h2>Delete In The App</h2>
        <p>When signed in, open Settings, scroll to Danger Zone, and choose Delete account. This permanently deletes your account and cloud data associated with the account.</p>
      </section>

      <section>
        <h2>Request Deletion Without The App</h2>
        <p>If you cannot access the app, email <a href="mailto:{contactEmail}?subject=GAAstat%20account%20deletion%20request">{contactEmail}</a> from the email address on your GAAstat account with the subject "GAAstat account deletion request".</p>
      </section>

      <section>
        <h2>What Is Deleted</h2>
        <p>Account identity, cloud match data, squad data, team membership, and subscription entitlement records tied to your account are deleted or anonymised where required for security, legal, or financial record keeping.</p>
      </section>

      <section>
        <h2>Local Device Data</h2>
        <p>Deleting your account does not automatically erase every local browser or device cache. To remove local copies, sign out, clear site/app data, or delete the installed app from your device.</p>
      </section>
    {/if}
  </main>

  <LpFooter {onNavigate} />
</div>

<style>
  .legal-page {
    min-height: 100vh;
  }
  .lp-noise {
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.6;
  }
  .legal-wrap {
    max-width: 860px;
    margin: 0 auto;
    padding: 136px 32px 72px;
  }
  .legal-hero {
    padding-bottom: 36px;
    border-bottom: 1px solid var(--lp-border);
    margin-bottom: 36px;
  }
  .legal-eyebrow {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--lp-lime);
    background: rgba(186,255,41,0.1);
    border: 1px solid rgba(186,255,41,0.2);
    padding: 5px 14px;
    border-radius: 20px;
    margin-bottom: 18px;
  }
  h1 {
    font-size: clamp(42px, 8vw, 72px);
    line-height: 0.9;
    color: var(--lp-text);
    font-family: var(--lp-font-head);
    letter-spacing: 0;
    margin-bottom: 16px;
  }
  .legal-hero p {
    color: var(--lp-text2);
    font-size: 18px;
    line-height: 1.6;
    max-width: 680px;
  }
  .legal-updated {
    color: var(--lp-text3);
    font-size: 13px;
    margin-top: 18px;
  }
  section {
    padding: 26px 0;
    border-bottom: 1px solid rgba(26,40,64,0.7);
  }
  h2 {
    color: var(--lp-text);
    font-size: 22px;
    margin-bottom: 12px;
  }
  p, li {
    color: var(--lp-text2);
    font-size: 15px;
    line-height: 1.75;
  }
  ul {
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  a {
    color: var(--lp-lime);
  }
  @media (max-width: 640px) {
    .legal-wrap {
      padding: 112px 22px 56px;
    }
  }
</style>
