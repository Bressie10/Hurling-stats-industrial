<script>
  import LpNav from './LpNav.svelte'
  import LpFooter from './LpFooter.svelte'

  export let onNavigate = () => {}
</script>

<div class="lp contact-page">
  <div class="lp-noise"></div>
  <LpNav {onNavigate} currentPage="contact" />

  <main class="contact-main">

    <div class="contact-hero">
      <div class="contact-tag">Contact</div>
      <h1>Get in Touch</h1>
      <p class="contact-lead">Questions about the app, your subscription, or setting up your club? We're happy to help.</p>
    </div>

    <div class="contact-grid">

      <!-- Email card -->
      <a href="mailto:contact@gaastatsapp.com" class="contact-card contact-card-primary">
        <div class="card-icon card-icon-lime">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <div class="card-body">
          <div class="card-title">Email Us</div>
          <div class="card-value">contact@gaastatsapp.com</div>
          <div class="card-desc">We typically reply within 1–2 business days.</div>
        </div>
        <svg class="card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>

      <!-- What we can help with -->
      <div class="contact-help">
        <div class="help-title">What we can help with</div>
        <ul class="help-list">
          <li>
            <div class="help-icon help-icon-lime">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            Setting up your club and inviting coaches
          </li>
          <li>
            <div class="help-icon help-icon-lime">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            Subscription and billing questions
          </li>
          <li>
            <div class="help-icon help-icon-lime">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            Technical issues or bugs
          </li>
          <li>
            <div class="help-icon help-icon-lime">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            Feature requests and feedback
          </li>
          <li>
            <div class="help-icon help-icon-lime">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            Enterprise and custom plans
          </li>
        </ul>
      </div>

    </div>

    <!-- User guide nudge -->
    <div class="contact-guide">
      <div class="guide-text">
        <div class="guide-title">Looking for answers fast?</div>
        <p>The User Guide covers every feature in the app with step-by-step instructions.</p>
      </div>
      <button class="guide-btn" on:click={() => onNavigate('docs')}>
        Read the User Guide
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </button>
    </div>

  </main>

  <LpFooter {onNavigate} />
</div>

<style>
  .contact-page { font-family: var(--lp-font-body); }
  .lp-noise {
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px; pointer-events: none; z-index: 9999; opacity: 0.6;
  }

  .contact-main {
    max-width: 760px;
    margin: 0 auto;
    padding: 120px 40px 100px;
    min-height: 80vh;
  }

  /* Hero */
  .contact-tag {
    display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--lp-lime); background: rgba(186,255,41,0.1);
    border: 1px solid rgba(186,255,41,0.2); padding: 3px 10px; border-radius: 20px;
    margin-bottom: 20px;
  }
  .contact-hero { margin-bottom: 52px; }
  .contact-hero h1 {
    font-size: 48px; font-weight: 800; color: var(--lp-text);
    letter-spacing: -0.03em; margin-bottom: 16px; line-height: 1.1;
  }
  .contact-lead { font-size: 18px; color: var(--lp-text2); line-height: 1.7; max-width: 520px; }

  /* Grid */
  .contact-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 40px;
  }

  /* Email card */
  .contact-card {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 24px; border-radius: 14px;
    background: var(--lp-surface); border: 1px solid var(--lp-border);
    text-decoration: none; color: inherit;
    transition: border-color 0.15s, background 0.15s;
    position: relative;
  }
  .contact-card-primary:hover {
    border-color: rgba(186,255,41,0.3);
    background: rgba(186,255,41,0.04);
  }
  .card-icon {
    width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .card-icon-lime { background: rgba(186,255,41,0.12); color: var(--lp-lime); }
  .card-body { flex: 1; min-width: 0; }
  .card-title { font-size: 13px; font-weight: 700; color: var(--lp-text3); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .card-value { font-size: 15px; font-weight: 600; color: var(--lp-lime); margin-bottom: 6px; word-break: break-all; }
  .card-desc { font-size: 13px; color: var(--lp-text3); line-height: 1.5; }
  .card-arrow { color: var(--lp-text3); flex-shrink: 0; margin-top: 2px; transition: transform 0.15s; }
  .contact-card-primary:hover .card-arrow { transform: translateX(3px); color: var(--lp-lime); }

  /* Help list */
  .contact-help {
    padding: 24px; border-radius: 14px;
    background: var(--lp-surface); border: 1px solid var(--lp-border);
  }
  .help-title { font-size: 14px; font-weight: 700; color: var(--lp-text); margin-bottom: 16px; }
  .help-list { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .help-list li {
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; color: var(--lp-text2); line-height: 1.4;
  }
  .help-icon {
    width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .help-icon-lime { background: rgba(186,255,41,0.12); color: var(--lp-lime); }

  /* Guide nudge */
  .contact-guide {
    display: flex; align-items: center; justify-content: space-between; gap: 24px;
    padding: 24px 28px; border-radius: 14px;
    background: rgba(186,255,41,0.04); border: 1px solid rgba(186,255,41,0.15);
  }
  .guide-title { font-size: 15px; font-weight: 700; color: var(--lp-text); margin-bottom: 4px; }
  .guide-text p { font-size: 14px; color: var(--lp-text3); line-height: 1.5; }
  .guide-btn {
    display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    background: var(--lp-lime); color: #05080F;
    border: none; font-family: var(--lp-font-body);
    font-size: 14px; font-weight: 700; padding: 10px 18px; border-radius: 8px;
    cursor: pointer; transition: background 0.15s;
    white-space: nowrap;
  }
  .guide-btn:hover { background: #CBFF4A; }

  /* Responsive */
  @media (max-width: 900px) {
    .contact-main { padding: 100px 20px 80px; }
    .contact-hero h1 { font-size: 36px; }
    .contact-lead { font-size: 16px; }
    .contact-grid { grid-template-columns: 1fr; }
    .contact-guide { flex-direction: column; align-items: flex-start; gap: 16px; }
    .guide-btn { width: 100%; justify-content: center; }
  }
</style>
