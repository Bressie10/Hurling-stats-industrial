<script>
  export let onNavigate = () => {}

  function nav(page) {
    onNavigate(page)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const year = new Date().getFullYear()
</script>

<footer class="lp-footer">
  <div class="footer-top">

    <!-- Brand col -->
    <div class="footer-brand">
      <div class="footer-logo">
        <div class="footer-logo-mark">G</div>
        <span class="footer-logo-text">GAA <span>Stats</span></span>
      </div>
      <p class="footer-tagline">
        Real-time hurling match analytics for coaches. Built on the sideline, for the sideline.
      </p>
      <div class="footer-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6l5 5 5-5M1 6h10M23 18l-5-5-5 5M23 18H13"/></svg>
        Works 100% offline
      </div>
    </div>

    <!-- Product col -->
    <div class="footer-col">
      <div class="footer-col-head">Product</div>
      <ul>
        <li><button on:click={() => nav('home')}>Features Overview</button></li>
        <li><button on:click={() => nav('pricing')}>Pricing</button></li>
        <li><button on:click={() => nav('docs')}>User Guide</button></li>
      </ul>
    </div>

    <!-- Resources col -->
    <div class="footer-col">
      <div class="footer-col-head">Use Cases</div>
      <ul>
        <li><button on:click={() => nav('home')}>Individual Coaches</button></li>
        <li><button on:click={() => nav('home')}>Club Teams</button></li>
        <li><button on:click={() => nav('home')}>Backroom Staff</button></li>
        <li><button on:click={() => nav('pricing')}>Enterprise</button></li>
      </ul>
    </div>

    <!-- Company col -->
    <div class="footer-col">
      <div class="footer-col-head">Company</div>
      <ul>
        <li><button on:click={() => nav('about')}>About</button></li>
        <li><button on:click={() => nav('privacy')}>Privacy Policy</button></li>
        <li><button on:click={() => nav('terms')}>Terms of Service</button></li>
        <li><a href="mailto:contact@gaastatsapp.com">Contact Us</a></li>
      </ul>
    </div>

  </div>

  <div class="footer-bottom">
    <div class="footer-copy">© {year} GAA Stats App. Built for GAA coaches.</div>
    <div class="footer-legal">
      <button on:click={() => nav('privacy')}>Privacy</button>
      <span>·</span>
      <button on:click={() => nav('terms')}>Terms</button>
      <span>·</span>
      <a href="mailto:contact@gaastatsapp.com">Contact</a>
    </div>
  </div>
</footer>

<style>
  .lp-footer {
    border-top: 1px solid var(--lp-border);
    padding: 64px 80px 32px;
    background: var(--lp-bg);
  }

  .footer-top {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 48px;
    margin-bottom: 48px;
  }

  /* Brand */
  .footer-brand { display: flex; flex-direction: column; gap: 16px; }
  .footer-logo { display: flex; align-items: center; gap: 10px; }
  .footer-logo-mark {
    width: 34px; height: 34px; background: var(--lp-lime);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-family: var(--lp-font-head); font-size: 17px; color: #05080F; font-weight: 900;
  }
  .footer-logo-text { font-size: 15px; font-weight: 700; color: var(--lp-text); }
  .footer-logo-text span { color: var(--lp-lime); }
  .footer-tagline { font-size: 14px; color: var(--lp-text3); line-height: 1.6; max-width: 260px; }
  .footer-badge {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 600; color: var(--lp-lime);
    background: rgba(186,255,41,0.08); border: 1px solid rgba(186,255,41,0.2);
    padding: 5px 10px; border-radius: 20px; width: fit-content;
  }

  /* Columns */
  .footer-col { display: flex; flex-direction: column; gap: 14px; }
  .footer-col-head {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--lp-text2);
  }
  .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .footer-col li button, .footer-col li a {
    background: none; border: none; cursor: pointer;
    font-family: var(--lp-font-body); font-size: 14px; color: var(--lp-text3);
    padding: 0; text-align: left; text-decoration: none;
    transition: color 0.15s;
  }
  .footer-col li button:hover, .footer-col li a:hover { color: var(--lp-text); }

  /* Bottom bar */
  .footer-bottom {
    display: flex; align-items: center; justify-content: space-between;
    padding-top: 24px;
    border-top: 1px solid rgba(26,40,64,0.6);
    flex-wrap: wrap; gap: 12px;
  }
  .footer-copy { font-size: 13px; color: var(--lp-text3); }
  .footer-legal {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--lp-text3);
  }
  .footer-legal button, .footer-legal a {
    background: none; border: none; cursor: pointer;
    font-family: var(--lp-font-body); font-size: 13px; color: var(--lp-text3);
    text-decoration: none; transition: color 0.15s;
  }
  .footer-legal button:hover, .footer-legal a:hover { color: var(--lp-text); }

  @media (max-width: 900px) {
    .lp-footer { padding: 48px 24px 32px; }
    .footer-top { grid-template-columns: 1fr 1fr; gap: 32px; }
    .footer-brand { grid-column: 1 / -1; }
  }
  @media (max-width: 500px) {
    .footer-top { grid-template-columns: 1fr; }
  }
</style>
