<script>
  export let onNavigate = () => {}
  export let currentPage = 'home'

  let mobileOpen = false
  let mobileExpanded = null // which mobile accordion is open

  function nav(page) {
    mobileOpen = false
    mobileExpanded = null
    onNavigate(page)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function anchor(id) {
    mobileOpen = false
    if (currentPage !== 'home') {
      onNavigate('home')
      // Give Landing a tick to mount before scrolling
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function toggleMobileAccordion(name) {
    mobileExpanded = mobileExpanded === name ? null : name
  }
</script>

<!-- ── NAV ──────────────────────────────────────────────────────────────── -->
<nav class="lp-nav">

  <!-- Logo -->
  <button class="nav-logo" on:click={() => nav('home')}>
    <div class="nav-logo-mark">G</div>
    <span class="nav-logo-text">GAA <span>Stats</span></span>
  </button>

  <!-- Desktop links -->
  <ul class="nav-links">

    <!-- Home -->
    <li><button class="nav-link" on:click={() => nav('home')}>Home</button></li>

    <!-- Product dropdown -->
    <li class="nav-dropdown-wrap">
      <button class="nav-link nav-link-drop">
        Product
        <svg class="drop-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="dropdown dropdown-wide">
        <div class="dropdown-inner dropdown-grid">
          <button class="dd-item" on:click={() => anchor('features')}>
            <div class="dd-icon dd-icon-lime">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Match Logging</div>
              <div class="dd-desc">Log every stat in real time, fully offline</div>
            </div>
          </button>
          <button class="dd-item" on:click={() => anchor('pitch')}>
            <div class="dd-icon dd-icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Puckout Tracking</div>
              <div class="dd-desc">Zone-based analysis with win/loss breakdown</div>
            </div>
          </button>
          <button class="dd-item" on:click={() => anchor('analytics')}>
            <div class="dd-icon dd-icon-lime">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Analytics</div>
              <div class="dd-desc">Player charts, team stats, match timeline</div>
            </div>
          </button>
          <button class="dd-item" on:click={() => anchor('features')}>
            <div class="dd-icon dd-icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Squad & Pitch View</div>
              <div class="dd-desc">Manage your squad with a visual GAA formation</div>
            </div>
          </button>
          <button class="dd-item" on:click={() => anchor('offline')}>
            <div class="dd-icon dd-icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6l5 5 5-5M1 6h10M23 18l-5-5-5 5M23 18H13"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Offline First</div>
              <div class="dd-desc">Works at any ground with zero signal</div>
            </div>
          </button>
          <button class="dd-item" on:click={() => anchor('features')}>
            <div class="dd-icon dd-icon-red">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Live Match Sharing</div>
              <div class="dd-desc">Stream live data to your backroom staff</div>
            </div>
          </button>
        </div>
      </div>
    </li>

    <!-- Resources dropdown -->
    <li class="nav-dropdown-wrap">
      <button class="nav-link nav-link-drop">
        Resources
        <svg class="drop-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="dropdown dropdown-narrow">
        <div class="dropdown-inner">
          <button class="dd-item" on:click={() => nav('docs')}>
            <div class="dd-icon dd-icon-lime">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">User Guide</div>
              <div class="dd-desc">Guides for every feature in the app</div>
            </div>
          </button>
          <button class="dd-item" on:click={() => nav('docs')}>
            <div class="dd-icon dd-icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Quick Start</div>
              <div class="dd-desc">Get up and running in under 5 minutes</div>
            </div>
          </button>
          <button class="dd-item" on:click={() => nav('install')}>
            <div class="dd-icon dd-icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">How to Install</div>
              <div class="dd-desc">iOS, Android, and desktop setup guide</div>
            </div>
          </button>
        </div>
      </div>
    </li>

    <!-- Company dropdown -->
    <li class="nav-dropdown-wrap">
      <button class="nav-link nav-link-drop">
        Company
        <svg class="drop-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="dropdown dropdown-narrow">
        <div class="dropdown-inner">
          <button class="dd-item" on:click={() => nav('privacy')}>
            <div class="dd-icon dd-icon-lime">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Privacy Policy</div>
              <div class="dd-desc">How we handle and protect your data</div>
            </div>
          </button>
          <button class="dd-item" on:click={() => nav('terms')}>
            <div class="dd-icon dd-icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Terms of Service</div>
              <div class="dd-desc">Terms and conditions of use</div>
            </div>
          </button>
          <button class="dd-item" on:click={() => nav('contact')}>
            <div class="dd-icon dd-icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div class="dd-text">
              <div class="dd-title">Contact</div>
              <div class="dd-desc">Get in touch with the team</div>
            </div>
          </button>
        </div>
      </div>
    </li>

    <!-- Direct links -->
    <li><button class="nav-link" on:click={() => nav('pricing')}>Pricing</button></li>
  </ul>

  <!-- Desktop CTAs -->
  <div class="nav-ctas">
    <button class="nav-signin" on:click={() => anchor('signin')}>Sign In</button>
    <button class="nav-start" on:click={() => anchor('signin')}>Get Started <span class="nav-start-arrow">→</span></button>
  </div>

  <!-- Mobile hamburger -->
  <button class="nav-hamburger" on:click={() => mobileOpen = !mobileOpen} aria-label="Menu">
    {#if mobileOpen}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    {:else}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    {/if}
  </button>
</nav>

<!-- Mobile menu -->
{#if mobileOpen}
  <div class="mobile-menu">
    <div class="mobile-menu-inner">

      <!-- Home -->
      <div class="mob-section">
        <button class="mob-section-head" on:click={() => nav('home')}>Home</button>
      </div>

      <!-- Product accordion -->
      <div class="mob-section">
        <button class="mob-section-head" on:click={() => toggleMobileAccordion('product')}>
          Product
          <svg class="mob-chevron" class:open={mobileExpanded === 'product'} width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        {#if mobileExpanded === 'product'}
          <div class="mob-items">
            <button class="mob-item" on:click={() => anchor('features')}>Match Logging</button>
            <button class="mob-item" on:click={() => anchor('pitch')}>Puckout Tracking</button>
            <button class="mob-item" on:click={() => anchor('analytics')}>Analytics</button>
            <button class="mob-item" on:click={() => anchor('features')}>Squad & Pitch View</button>
            <button class="mob-item" on:click={() => anchor('offline')}>Offline First</button>
            <button class="mob-item" on:click={() => anchor('features')}>Live Match Sharing</button>
          </div>
        {/if}
      </div>

      <!-- Resources accordion -->
      <div class="mob-section">
        <button class="mob-section-head" on:click={() => toggleMobileAccordion('resources')}>
          Resources
          <svg class="mob-chevron" class:open={mobileExpanded === 'resources'} width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        {#if mobileExpanded === 'resources'}
          <div class="mob-items">
            <button class="mob-item" on:click={() => nav('docs')}>User Guide</button>
            <button class="mob-item" on:click={() => nav('docs')}>Quick Start</button>
            <button class="mob-item" on:click={() => nav('install')}>How to Install</button>
          </div>
        {/if}
      </div>

      <!-- Company accordion -->
      <div class="mob-section">
        <button class="mob-section-head" on:click={() => toggleMobileAccordion('company')}>
          Company
          <svg class="mob-chevron" class:open={mobileExpanded === 'company'} width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        {#if mobileExpanded === 'company'}
          <div class="mob-items">
            <button class="mob-item" on:click={() => nav('privacy')}>Privacy Policy</button>
            <button class="mob-item" on:click={() => nav('terms')}>Terms of Service</button>
            <button class="mob-item" on:click={() => nav('contact')}>Contact</button>
          </div>
        {/if}
      </div>

      <div class="mob-divider"></div>
      <button class="mob-section-head" on:click={() => nav('pricing')}>Pricing</button>

      <div class="mob-ctas">
        <button class="mob-signin" on:click={() => anchor('signin')}>Sign In</button>
        <button class="mob-start" on:click={() => anchor('signin')}>Get Started Free</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── NAV ──────────────────────────────────────────────────────────────── */
  .lp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 200;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px; height: 68px;
    background: rgba(5,8,15,0.88);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid rgba(26,40,64,0.8);
    transition: box-shadow 0.2s;
  }

  /* Logo */
  .nav-logo {
    display: flex; align-items: center; gap: 10px;
    background: none; border: none; cursor: pointer; padding: 0;
    text-decoration: none; flex-shrink: 0;
  }
  .nav-logo-mark {
    width: 34px; height: 34px; background: var(--lp-lime);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-family: var(--lp-font-head); font-size: 17px; color: #05080F; letter-spacing: 0;
    font-weight: 900;
  }
  .nav-logo-text {
    font-family: var(--lp-font-body); font-size: 15px; font-weight: 700;
    color: var(--lp-text); letter-spacing: -0.01em;
  }
  .nav-logo-text span { color: var(--lp-lime); }

  /* Desktop nav links */
  .nav-links {
    display: flex; align-items: center; gap: 2px;
    list-style: none; margin: 0; padding: 0;
  }
  .nav-link {
    background: none; border: none; cursor: pointer;
    font-family: var(--lp-font-body); font-size: 14px; font-weight: 500;
    color: var(--lp-text2); padding: 8px 14px; border-radius: 8px;
    transition: color 0.15s, background 0.15s;
    display: flex; align-items: center; gap: 5px;
  }
  .nav-link:hover { color: var(--lp-text); background: rgba(255,255,255,0.05); }
  .drop-chevron { transition: transform 0.2s; flex-shrink: 0; }

  /* Dropdown wrapper */
  .nav-dropdown-wrap {
    position: relative; list-style: none;
  }
  /* Invisible bridge fills the gap between nav link and dropdown so hover isn't lost */
  .nav-dropdown-wrap::after {
    content: ''; position: absolute; top: 100%; left: -20px; right: -20px; height: 14px;
  }
  .nav-dropdown-wrap:hover .drop-chevron { transform: rotate(180deg); }

  /* Dropdown panel */
  .dropdown {
    position: absolute; top: calc(100% + 10px); left: 50%;
    transform: translateX(-50%) translateY(-6px);
    opacity: 0; pointer-events: none;
    transition: opacity 0.18s ease, transform 0.18s ease;
    background: #0A1120;
    border: 1px solid rgba(26,40,64,0.9);
    border-radius: 14px;
    box-shadow: 0 16px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4);
    z-index: 300;
    min-width: 260px;
  }
  .dropdown-wide { min-width: 520px; }
  .dropdown-narrow { min-width: 280px; }
  .nav-dropdown-wrap:hover .dropdown {
    opacity: 1; pointer-events: auto;
    transform: translateX(-50%) translateY(0);
  }

  /* Arrow above dropdown */
  .dropdown::before {
    content: ''; position: absolute; top: -6px; left: 50%;
    transform: translateX(-50%);
    width: 12px; height: 6px;
    background: #0A1120;
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
    border-top: 1px solid rgba(26,40,64,0.9);
  }

  .dropdown-inner { padding: 10px; }
  .dropdown-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 2px;
  }

  /* Dropdown items */
  .dd-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px 14px; border-radius: 10px;
    background: none; border: none; cursor: pointer;
    text-align: left; width: 100%; transition: background 0.12s;
    font-family: var(--lp-font-body);
  }
  .dd-item:hover { background: rgba(255,255,255,0.05); }

  .dd-icon {
    width: 36px; height: 36px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .dd-icon-lime  { background: rgba(186,255,41,0.12);  color: var(--lp-lime); }
  .dd-icon-amber { background: rgba(255,184,0,0.12);   color: var(--lp-amber); }
  .dd-icon-blue  { background: rgba(96,165,250,0.12);  color: #60A5FA; }
  .dd-icon-red   { background: rgba(255,58,58,0.12);   color: var(--lp-red); }

  .dd-text { display: flex; flex-direction: column; gap: 2px; }
  .dd-title { font-size: 13px; font-weight: 600; color: var(--lp-text); line-height: 1.3; }
  .dd-desc  { font-size: 12px; color: var(--lp-text3); line-height: 1.4; }

  /* Desktop CTAs */
  .nav-ctas { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .nav-signin {
    background: none; border: 1px solid rgba(255,255,255,0.12);
    color: var(--lp-text2); font-family: var(--lp-font-body);
    font-size: 14px; font-weight: 500; padding: 8px 16px; border-radius: 8px;
    cursor: pointer; transition: all 0.15s;
  }
  .nav-signin:hover { border-color: rgba(255,255,255,0.3); color: var(--lp-text); }
  .nav-start {
    background: var(--lp-lime); color: #05080F;
    border: none; font-family: var(--lp-font-body);
    font-size: 14px; font-weight: 700; padding: 8px 18px; border-radius: 8px;
    cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px;
  }
  .nav-start:hover { background: #CBFF4A; transform: translateY(-1px); }
  .nav-start-arrow { font-size: 16px; }

  /* Mobile hamburger */
  .nav-hamburger {
    display: none; background: none; border: none;
    color: var(--lp-text2); cursor: pointer; padding: 6px;
    border-radius: 8px; transition: background 0.15s;
  }
  .nav-hamburger:hover { background: rgba(255,255,255,0.06); }

  /* Mobile menu */
  .mobile-menu {
    position: fixed; top: 68px; left: 0; right: 0; bottom: 0; z-index: 190;
    background: rgba(5,8,15,0.98);
    backdrop-filter: blur(20px);
    overflow-y: auto;
    border-top: 1px solid var(--lp-border);
  }
  .mobile-menu-inner { padding: 16px 20px 40px; max-width: 480px; margin: 0 auto; }

  .mob-section { border-bottom: 1px solid rgba(26,40,64,0.6); }
  .mob-section-head {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 16px 4px;
    background: none; border: none; cursor: pointer;
    font-family: var(--lp-font-body); font-size: 16px; font-weight: 600;
    color: var(--lp-text); text-align: left;
  }
  .mob-chevron { transition: transform 0.2s; color: var(--lp-text3); }
  .mob-chevron.open { transform: rotate(180deg); }

  .mob-items { padding: 4px 0 12px; display: flex; flex-direction: column; gap: 2px; }
  .mob-item {
    background: none; border: none; cursor: pointer;
    font-family: var(--lp-font-body); font-size: 15px; color: var(--lp-text2);
    text-align: left; padding: 10px 12px; border-radius: 8px; width: 100%;
    transition: background 0.12s, color 0.12s;
  }
  .mob-item:hover { background: rgba(255,255,255,0.05); color: var(--lp-text); }

  .mob-divider { height: 1px; background: rgba(26,40,64,0.6); margin: 4px 0; }

  .mob-ctas { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
  .mob-signin {
    width: 100%; padding: 14px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.14); background: none;
    color: var(--lp-text); font-family: var(--lp-font-body); font-size: 16px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .mob-signin:hover { background: rgba(255,255,255,0.06); }
  .mob-start {
    width: 100%; padding: 14px; border-radius: 10px;
    border: none; background: var(--lp-lime);
    color: #05080F; font-family: var(--lp-font-body); font-size: 16px; font-weight: 700;
    cursor: pointer; transition: background 0.15s;
  }
  .mob-start:hover { background: #CBFF4A; }

  /* ── RESPONSIVE ─────────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .lp-nav { padding: 0 20px; }
    .nav-links, .nav-ctas { display: none; }
    .nav-hamburger { display: flex; }
  }
</style>
