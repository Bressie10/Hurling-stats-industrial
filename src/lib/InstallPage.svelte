<script>
  import LpNav from './LpNav.svelte'
  import LpFooter from './LpFooter.svelte'

  export let onNavigate = () => {}

  let openIssue = null
  function toggleIssue(i) { openIssue = openIssue === i ? null : i }

  const issues = [
    {
      q: "I don't see "Add to Home Screen" on iOS",
      a: "You must use Safari — not Chrome, Firefox, or any other browser. Chrome on iOS cannot install PWAs. Open the app URL in Safari, then tap the Share button at the bottom of the screen."
    },
    {
      q: "The app says it needs internet, but I'm at the pitch",
      a: "The app needs one successful load with internet to cache itself. Sign in and open the app fully before you leave for the ground — once cached, it works with zero signal. The cache survives phone restarts and switching to airplane mode."
    },
    {
      q: "My stats disappeared after I cleared my browser or updated my phone",
      a: "Match data is stored in your browser's local storage. Clearing site data or a full phone reset will erase it. To prevent data loss: go to Settings inside the app and tap Sync to Supabase before clearing anything. Signed-in users are backed up automatically after each match."
    },
    {
      q: "The app looks out of date or isn't showing the latest version",
      a: "On iOS: delete the app from your home screen and reinstall from Safari. On Android and desktop: close all browser tabs with the app open, wait 30 seconds, then reopen — the service worker will fetch the new version automatically."
    },
    {
      q: "I get logged out every time I open the app",
      a: "This usually happens if you installed the app from a different browser than the one you signed in with, or if your browser is set to clear storage on close. On iOS, always install and open via Safari. Check that Safari's settings don't have \"Clear History and Website Data\" set to run automatically."
    },
    {
      q: "Two coaches on the same team can't see each other's stats",
      a: "This is by design — each coach has their own private account and data. To share live data during a match, use the Live Match feature (Club Pro plan). After a match, stats are tied to the coach who logged them; team-wide dashboards are on the roadmap."
    },
    {
      q: "The install prompt doesn't appear on Android",
      a: "Chrome on Android shows the install prompt automatically after you visit the app a couple of times. If it hasn't appeared, tap the three-dot menu (⋮) in Chrome and look for \"Add to Home screen\" or \"Install app\". Make sure you're on Chrome and not a third-party browser."
    },
    {
      q: "The app installed but opens in the browser, not as a standalone app",
      a: "On iOS this means it was added to the home screen from a non-Safari browser. Delete the icon, open the app URL in Safari, and reinstall from there. On Android, make sure you used the \"Install app\" prompt rather than just bookmarking the URL."
    }
  ]
</script>

<div class="lp install-page">
  <div class="lp-noise"></div>
  <LpNav {onNavigate} currentPage="install" />

  <main class="install-main">

    <div class="install-hero">
      <div class="install-tag">Installation</div>
      <h1>Install the App</h1>
      <p class="install-lead">GAA Stats App is a Progressive Web App — no App Store needed. Install it directly from your browser and it works fully offline at any GAA ground.</p>
    </div>

    <!-- Internet callout -->
    <div class="internet-callout">
      <div class="callout-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="callout-body">
        <div class="callout-title">You need internet to sign in — but not to use the app</div>
        <p>Signing in requires a connection because your account is verified on our servers. Once logged in, your session is saved on your device and the app works fully offline. <strong>Always sign in and open the app before heading to a ground with no coverage.</strong> If your session expires while offline, you won't be able to log back in until you have signal.</p>
      </div>
    </div>

    <!-- Platform steps -->
    <div class="platforms">

      <!-- iOS -->
      <div class="platform-card">
        <div class="platform-header">
          <div class="platform-icon platform-icon-lime">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          </div>
          <div class="platform-title-wrap">
            <div class="platform-title">iPhone &amp; iPad</div>
            <div class="platform-sub">iOS 16.4+ · Safari required</div>
          </div>
        </div>
        <ol class="steps">
          <li>
            <div class="step-num">1</div>
            <div class="step-body">
              <div class="step-title">Open in Safari</div>
              <div class="step-desc">Chrome, Firefox and other iOS browsers cannot install PWAs. You must use Safari.</div>
            </div>
          </li>
          <li>
            <div class="step-num">2</div>
            <div class="step-body">
              <div class="step-title">Tap the Share button</div>
              <div class="step-desc">The square with an arrow pointing up at the bottom of the screen.</div>
            </div>
          </li>
          <li>
            <div class="step-num">3</div>
            <div class="step-body">
              <div class="step-title">Tap "Add to Home Screen"</div>
              <div class="step-desc">Scroll down the share sheet if you don't see it immediately.</div>
            </div>
          </li>
          <li>
            <div class="step-num">4</div>
            <div class="step-body">
              <div class="step-title">Tap "Add"</div>
              <div class="step-desc">The app icon appears on your home screen. Open it from there — not from Safari — for the full offline experience.</div>
            </div>
          </li>
        </ol>
      </div>

      <!-- Android -->
      <div class="platform-card">
        <div class="platform-header">
          <div class="platform-icon platform-icon-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M17.82 15.64a2.18 2.18 0 0 1 2.18 2.18C20 19.01 19.01 20 17.82 20a2.18 2.18 0 0 1-2.18-2.18a2.18 2.18 0 0 1 2.18-2.18M1.71 3.04L2.37.5h19.26l.66 2.54L17.34 8c.34.51.54 1.12.54 1.77v9.05c0 1.81-1.46 3.27-3.27 3.27H9.09a3.27 3.27 0 0 1-3.27-3.27V9.77c0-.65.2-1.26.54-1.77L1.71 3.04M12 2.27c-.34 0-.61.28-.61.61c0 .34.27.61.61.61c.33 0 .61-.27.61-.61c0-.33-.28-.61-.61-.61M8.18 2.27c-.34 0-.61.28-.61.61c0 .34.27.61.61.61c.33 0 .6-.27.6-.61c0-.33-.27-.61-.6-.61z"/></svg>
          </div>
          <div class="platform-title-wrap">
            <div class="platform-title">Android</div>
            <div class="platform-sub">Chrome recommended</div>
          </div>
        </div>
        <ol class="steps">
          <li>
            <div class="step-num">1</div>
            <div class="step-body">
              <div class="step-title">Open in Chrome</div>
              <div class="step-desc">Chrome gives the best install experience. Samsung Internet also works.</div>
            </div>
          </li>
          <li>
            <div class="step-num">2</div>
            <div class="step-body">
              <div class="step-title">Look for the install banner</div>
              <div class="step-desc">Chrome may show an "Install app" prompt at the bottom automatically. Tap it to install.</div>
            </div>
          </li>
          <li>
            <div class="step-num">3</div>
            <div class="step-body">
              <div class="step-title">Or use the menu</div>
              <div class="step-desc">Tap the three-dot menu (⋮) in the top right, then tap "Add to Home screen" or "Install app".</div>
            </div>
          </li>
          <li>
            <div class="step-num">4</div>
            <div class="step-body">
              <div class="step-title">Tap "Install"</div>
              <div class="step-desc">The app opens in its own window without browser chrome. You're good to go.</div>
            </div>
          </li>
        </ol>
      </div>

      <!-- Desktop -->
      <div class="platform-card platform-card-wide">
        <div class="platform-header">
          <div class="platform-icon platform-icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div class="platform-title-wrap">
            <div class="platform-title">Desktop</div>
            <div class="platform-sub">Chrome or Edge</div>
          </div>
        </div>
        <ol class="steps steps-horiz">
          <li>
            <div class="step-num">1</div>
            <div class="step-body">
              <div class="step-title">Open in Chrome or Edge</div>
              <div class="step-desc">PWA install is supported in Chrome, Edge, and Brave on desktop.</div>
            </div>
          </li>
          <li>
            <div class="step-num">2</div>
            <div class="step-body">
              <div class="step-title">Click the install icon</div>
              <div class="step-desc">Look for a small install icon (monitor with download arrow) in the right side of the address bar.</div>
            </div>
          </li>
          <li>
            <div class="step-num">3</div>
            <div class="step-body">
              <div class="step-title">Click "Install"</div>
              <div class="step-desc">The app opens in its own window and appears in your taskbar and start menu like a native app.</div>
            </div>
          </li>
        </ol>
      </div>

    </div>

    <!-- Common issues -->
    <div class="issues-section">
      <div class="issues-header">
        <div class="issues-tag">Troubleshooting</div>
        <h2>Common Issues</h2>
        <p class="issues-lead">Something not working? These cover most of what coaches run into.</p>
      </div>

      <div class="issues-list">
        {#each issues as issue, i}
          <div class="issue-item" class:open={openIssue === i}>
            <button class="issue-q" on:click={() => toggleIssue(i)}>
              <span>{issue.q}</span>
              <svg class="issue-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            {#if openIssue === i}
              <div class="issue-a">{issue.a}</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- CTA -->
    <div class="install-cta">
      <div class="cta-text">
        <div class="cta-title">Still having trouble?</div>
        <p>Drop us an email and we'll help you get set up. We typically reply within a day.</p>
      </div>
      <div class="cta-actions">
        <a href="mailto:contact@gaastatsapp.com" class="cta-btn cta-btn-primary">Email us</a>
        <button class="cta-btn cta-btn-ghost" on:click={() => onNavigate('docs')}>User Guide</button>
      </div>
    </div>

  </main>

  <LpFooter {onNavigate} />
</div>

<style>
  .install-page { font-family: var(--lp-font-body); }
  .lp-noise {
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px; pointer-events: none; z-index: 9999; opacity: 0.6;
  }

  .install-main {
    max-width: 900px;
    margin: 0 auto;
    padding: 120px 40px 100px;
    min-height: 80vh;
  }

  /* ── HERO ── */
  .install-tag {
    display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--lp-lime); background: rgba(186,255,41,0.1);
    border: 1px solid rgba(186,255,41,0.2); padding: 3px 10px; border-radius: 20px;
    margin-bottom: 20px;
  }
  .install-hero { margin-bottom: 56px; }
  .install-hero h1 {
    font-size: 48px; font-weight: 800; color: var(--lp-text);
    letter-spacing: -0.03em; margin-bottom: 16px; line-height: 1.1;
  }
  .install-lead { font-size: 18px; color: var(--lp-text2); line-height: 1.7; max-width: 560px; }

  /* ── INTERNET CALLOUT ── */
  .internet-callout {
    display: flex; gap: 16px; align-items: flex-start;
    padding: 20px 24px;
    background: rgba(255,184,0,0.07);
    border: 1px solid rgba(255,184,0,0.3);
    border-radius: 14px;
    margin-bottom: 48px;
  }
  .callout-icon {
    flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px;
    background: rgba(255,184,0,0.15); color: var(--lp-amber);
    display: flex; align-items: center; justify-content: center;
    margin-top: 1px;
  }
  .callout-title {
    font-size: 15px; font-weight: 700; color: var(--lp-text); margin-bottom: 6px;
  }
  .callout-body p {
    font-size: 14px; color: var(--lp-text2); line-height: 1.65; margin: 0;
  }
  .callout-body strong { color: var(--lp-amber); font-weight: 700; }

  /* ── PLATFORM CARDS ── */
  .platforms {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 72px;
  }
  .platform-card-wide { grid-column: 1 / -1; }

  .platform-card {
    background: var(--lp-surface);
    border: 1px solid var(--lp-border);
    border-radius: 16px;
    padding: 28px;
  }

  .platform-header {
    display: flex; align-items: center; gap: 14px; margin-bottom: 24px;
  }
  .platform-icon {
    width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .platform-icon-lime { background: rgba(186,255,41,0.12); color: var(--lp-lime); }
  .platform-icon-green { background: rgba(52,211,153,0.12); color: #34d399; }
  .platform-icon-blue { background: rgba(96,165,250,0.12); color: #60a5fa; }
  .platform-title { font-size: 17px; font-weight: 700; color: var(--lp-text); margin-bottom: 2px; }
  .platform-sub { font-size: 12px; color: var(--lp-text3); }

  /* Steps list */
  .steps { list-style: none; display: flex; flex-direction: column; gap: 0; }
  .steps li {
    display: flex; gap: 14px; align-items: flex-start;
    padding: 14px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .steps li:last-child { border-bottom: none; padding-bottom: 0; }
  .steps li:first-child { padding-top: 0; }

  .steps-horiz { flex-direction: row; gap: 0; }
  .steps-horiz li {
    flex: 1; flex-direction: column; border-bottom: none;
    border-right: 1px solid rgba(255,255,255,0.05);
    padding: 0 24px 0 0; margin-right: 24px;
  }
  .steps-horiz li:last-child { border-right: none; padding-right: 0; margin-right: 0; }
  .steps-horiz li:first-child { padding-left: 0; }
  .steps-horiz .step-num { margin-bottom: 10px; }

  .step-num {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    background: rgba(186,255,41,0.12); color: var(--lp-lime);
    font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    margin-top: 1px;
  }
  .step-title { font-size: 14px; font-weight: 700; color: var(--lp-text); margin-bottom: 4px; }
  .step-desc { font-size: 13px; color: var(--lp-text3); line-height: 1.55; }

  /* ── COMMON ISSUES ── */
  .issues-section { margin-bottom: 72px; }
  .issues-header { margin-bottom: 32px; }
  .issues-tag {
    display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--lp-amber); background: rgba(255,184,0,0.1);
    border: 1px solid rgba(255,184,0,0.2); padding: 3px 10px; border-radius: 20px;
    margin-bottom: 16px;
  }
  .issues-header h2 {
    font-size: 34px; font-weight: 800; color: var(--lp-text);
    letter-spacing: -0.02em; margin-bottom: 10px;
  }
  .issues-lead { font-size: 16px; color: var(--lp-text2); line-height: 1.6; }

  .issues-list { display: flex; flex-direction: column; gap: 0; }
  .issue-item {
    border-bottom: 1px solid var(--lp-border);
  }
  .issue-item:first-child { border-top: 1px solid var(--lp-border); }

  .issue-q {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding: 18px 0;
    background: none; border: none; text-align: left;
    font-family: var(--lp-font-body); font-size: 15px; font-weight: 600;
    color: var(--lp-text); cursor: pointer; transition: color 0.15s;
  }
  .issue-q:hover { color: var(--lp-lime); }
  .open .issue-q { color: var(--lp-lime); }

  .issue-chevron {
    flex-shrink: 0; color: var(--lp-text3); transition: transform 0.2s;
  }
  .open .issue-chevron { transform: rotate(180deg); color: var(--lp-lime); }

  .issue-a {
    font-size: 14px; color: var(--lp-text2); line-height: 1.7;
    padding: 0 40px 18px 0;
  }

  /* ── CTA ── */
  .install-cta {
    display: flex; align-items: center; justify-content: space-between; gap: 24px;
    padding: 28px 32px; border-radius: 16px;
    background: rgba(186,255,41,0.04); border: 1px solid rgba(186,255,41,0.15);
  }
  .cta-title { font-size: 16px; font-weight: 700; color: var(--lp-text); margin-bottom: 4px; }
  .cta-text p { font-size: 14px; color: var(--lp-text3); line-height: 1.5; }
  .cta-actions { display: flex; gap: 10px; flex-shrink: 0; }
  .cta-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 20px; border-radius: 8px; font-size: 14px; font-weight: 700;
    cursor: pointer; font-family: var(--lp-font-body); text-decoration: none;
    transition: all 0.15s; white-space: nowrap; border: none;
  }
  .cta-btn-primary { background: var(--lp-lime); color: #05080F; }
  .cta-btn-primary:hover { background: #CBFF4A; }
  .cta-btn-ghost {
    background: none; color: var(--lp-text2);
    border: 1px solid var(--lp-border);
  }
  .cta-btn-ghost:hover { border-color: rgba(186,255,41,0.3); color: var(--lp-lime); }

  /* ── RESPONSIVE ── */
  @media (max-width: 900px) {
    .install-main { padding: 100px 20px 80px; }
    .install-hero h1 { font-size: 36px; }
    .install-lead { font-size: 16px; }
    .internet-callout { flex-direction: column; gap: 12px; }
    .platforms { grid-template-columns: 1fr; }
    .platform-card-wide { grid-column: 1; }
    .steps-horiz { flex-direction: column; }
    .steps-horiz li { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 14px 0; margin-right: 0; }
    .steps-horiz li:last-child { border-bottom: none; }
    .steps-horiz .step-num { margin-bottom: 0; }
    .install-cta { flex-direction: column; align-items: flex-start; }
    .cta-actions { width: 100%; flex-direction: column; }
    .cta-btn { width: 100%; justify-content: center; }
  }

  @media (max-width: 480px) {
    .install-hero h1 { font-size: 30px; }
    .issues-header h2 { font-size: 26px; }
    .platform-card { padding: 20px; }
    .install-cta { padding: 20px; }
  }
</style>
