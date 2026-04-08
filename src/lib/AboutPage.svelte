<script>
  import LpNav from './LpNav.svelte'
  import LpFooter from './LpFooter.svelte'
  import { onMount } from 'svelte'

  export let onNavigate = () => {}

  onMount(() => {
    const els = document.querySelectorAll('.about-page .reveal')
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
    }, { threshold: 0.05 })
    els.forEach(el => io.observe(el))
    setTimeout(() => els.forEach(el => el.classList.add('in')), 1500)
    return () => io.disconnect()
  })
</script>

<div class="lp about-page">
  <div class="lp-noise"></div>
  <LpNav {onNavigate} currentPage="about" />

  <!-- Hero -->
  <section class="ab-hero">
    <div class="ab-hero-inner">
      <div class="ab-eyebrow reveal">Our Story</div>
      <h1 class="ab-title reveal">Built on the sideline.<br>For the sideline.</h1>
      <p class="ab-sub reveal">
        Hurling Stats started as a notes app on a phone at a training pitch in Clare.
        It became something bigger.
      </p>
    </div>
    <div class="ab-hero-img reveal">
      <svg viewBox="0 0 520 300" xmlns="http://www.w3.org/2000/svg">
        <!-- Pitch background -->
        <rect width="520" height="300" rx="12" fill="#0C1422"/>
        <!-- Sideline figure -->
        <rect x="30" y="80" width="460" height="140" rx="8" fill="#0e1a2d"/>
        <!-- Pitch lines -->
        <rect x="50" y="100" width="420" height="100" rx="4" fill="none" stroke="#1e3a5f" stroke-width="1.5"/>
        <line x1="260" y1="100" x2="260" y2="200" stroke="#1e3a5f" stroke-width="1.5"/>
        <circle cx="260" cy="150" r="20" fill="none" stroke="#1e3a5f" stroke-width="1.5"/>
        <!-- Goal boxes -->
        <rect x="50" y="120" width="30" height="60" rx="2" fill="none" stroke="#1e3a5f" stroke-width="1.5"/>
        <rect x="440" y="120" width="30" height="60" rx="2" fill="none" stroke="#1e3a5f" stroke-width="1.5"/>
        <!-- Player dots -->
        <circle cx="120" cy="130" r="5" fill="#BAFF29"/>
        <circle cx="160" cy="155" r="5" fill="#BAFF29"/>
        <circle cx="200" cy="135" r="5" fill="#BAFF29"/>
        <circle cx="260" cy="145" r="5" fill="#BAFF29"/>
        <circle cx="320" cy="160" r="5" fill="#BAFF29"/>
        <circle cx="360" cy="130" r="5" fill="#BAFF29"/>
        <circle cx="400" cy="155" r="5" fill="#BAFF29"/>
        <!-- Opposition dots -->
        <circle cx="130" cy="170" r="5" fill="#FF3A3A"/>
        <circle cx="175" cy="145" r="5" fill="#FF3A3A"/>
        <circle cx="230" cy="165" r="5" fill="#FF3A3A"/>
        <circle cx="290" cy="140" r="5" fill="#FF3A3A"/>
        <circle cx="340" cy="170" r="5" fill="#FF3A3A"/>
        <circle cx="390" cy="145" r="5" fill="#FF3A3A"/>
        <!-- Stat card bottom-left -->
        <rect x="30" y="235" width="140" height="50" rx="6" fill="#0C1422" stroke="#1e3a5f" stroke-width="1"/>
        <text x="44" y="255" fill="#4A6280" font-family="Outfit,sans-serif" font-size="9">PUCKOUTS WON</text>
        <text x="44" y="273" fill="#BAFF29" font-family="Bebas Neue,sans-serif" font-size="20">14 / 22</text>
        <!-- Stat card bottom-right -->
        <rect x="350" y="235" width="140" height="50" rx="6" fill="#0C1422" stroke="#1e3a5f" stroke-width="1"/>
        <text x="364" y="255" fill="#4A6280" font-family="Outfit,sans-serif" font-size="9">SCORES LOGGED</text>
        <text x="364" y="273" fill="#BAFF29" font-family="Bebas Neue,sans-serif" font-size="20">0-13</text>
        <!-- Phone silhouette right -->
        <rect x="430" y="20" width="70" height="120" rx="10" fill="#0C1422" stroke="#1e3a5f" stroke-width="1.5"/>
        <rect x="436" y="32" width="58" height="96" rx="4" fill="#0e1a2d"/>
        <circle cx="465" cy="130" r="5" fill="#1e3a5f"/>
        <text x="450" y="55" fill="#4A6280" font-family="Outfit,sans-serif" font-size="7">MATCH</text>
        <text x="444" y="68" fill="#E4EDF8" font-family="Bebas Neue,sans-serif" font-size="13">0-07 vs 0-05</text>
        <rect x="439" y="75" width="52" height="1" fill="#1e3a5f"/>
        <text x="443" y="87" fill="#8CA3BF" font-family="Outfit,sans-serif" font-size="7">B. Murphy</text>
        <rect x="472" y="82" width="14" height="9" rx="2" fill="#BAFF29" opacity="0.9"/>
        <text x="476" y="89" fill="#05080F" font-family="Outfit,sans-serif" font-size="7" font-weight="700">+</text>
        <text x="443" y="100" fill="#8CA3BF" font-family="Outfit,sans-serif" font-size="7">S. Collins</text>
        <rect x="472" y="95" width="14" height="9" rx="2" fill="#BAFF29" opacity="0.9"/>
        <text x="476" y="102" fill="#05080F" font-family="Outfit,sans-serif" font-size="7" font-weight="700">+</text>
        <text x="443" y="113" fill="#8CA3BF" font-family="Outfit,sans-serif" font-size="7">C. Ryan</text>
        <rect x="472" y="108" width="14" height="9" rx="2" fill="#BAFF29" opacity="0.9"/>
        <text x="476" y="115" fill="#05080F" font-family="Outfit,sans-serif" font-size="7" font-weight="700">+</text>
      </svg>
    </div>
  </section>

  <!-- Origin story -->
  <section class="ab-section ab-origin">
    <div class="ab-inner">
      <div class="ab-story reveal">
        <div class="ab-story-eyebrow">Where it started</div>
        <h2 class="ab-story-title">Doora Barefield, Clare, 2025</h2>
        <p>
          The idea came from frustration. Watching a county championship match, a coach was
          scribbling puckout outcomes onto a notepad — trying to figure out which zones the
          opposition was targeting, which of our players was losing their matchup.
        </p>
        <p>
          By the time the half-time whistle went, the notes were unreadable. Wrong player,
          wrong zone, wrong time. The data that could have changed the second half was gone.
        </p>
        <p>
          Hurling Stats was built to fix that. A tool fast enough to keep up with the game,
          accurate enough to trust at half-time, and smart enough to show you what matters
          without making you do the maths in your head.
        </p>
        <p>
          It started as a scrappy internal tool for one panel. Now it tracks matches across
          clubs, counties, and age groups — always offline-first, always free to try.
        </p>
      </div>
      <div class="ab-story-graphic reveal">
        <div class="ab-quote-card">
          <div class="ab-quote-mark">"</div>
          <p class="ab-quote-text">
            The data that could have changed the second half was gone.
            We needed something that kept up with the game.
          </p>
          <div class="ab-quote-attr">— Doora Barefield GAA, Clare</div>
        </div>
        <div class="ab-stat-pills">
          <div class="ab-stat-pill">
            <span class="ab-stat-n">9</span>
            <span class="ab-stat-l">versions shipped</span>
          </div>
          <div class="ab-stat-pill">
            <span class="ab-stat-n">100%</span>
            <span class="ab-stat-l">offline capable</span>
          </div>
          <div class="ab-stat-pill">
            <span class="ab-stat-n">GAA</span>
            <span class="ab-stat-l">built-for-hurling</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Mission -->
  <section class="ab-section ab-mission">
    <div class="ab-inner ab-mission-inner">
      <div class="ab-mission-text reveal">
        <div class="ab-eyebrow-sm">Mission</div>
        <h2 class="ab-section-title">Give every GAA coach the same edge the pros have</h2>
        <p class="ab-section-sub">
          Elite teams have analysts, laptops, and dedicated stats operators. Most county and
          club coaches have a pen and a page. We're closing that gap — one match at a time.
        </p>
      </div>
      <div class="ab-mission-cards reveal">
        <div class="ab-mission-card">
          <div class="ab-mission-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="ab-mission-card-title">Real-time, not retrospective</div>
          <p>Stats logged during the match, not from video afterwards. Half-time decisions need half-time data.</p>
        </div>
        <div class="ab-mission-card">
          <div class="ab-mission-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="ab-mission-card-title">No internet required</div>
          <p>Every GAA ground is different. The app works fully offline — no hotspot, no roaming, no excuses.</p>
        </div>
        <div class="ab-mission-card">
          <div class="ab-mission-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="ab-mission-card-title">Built for teams, not individuals</div>
          <p>Club owners, multiple coaches, sub-teams — the whole panel in one place with proper access control.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Values -->
  <section class="ab-section ab-values">
    <div class="ab-inner">
      <div class="ab-values-header reveal">
        <div class="ab-eyebrow-sm">Values</div>
        <h2 class="ab-section-title">How we build</h2>
      </div>
      <div class="ab-values-grid reveal">
        <div class="ab-value">
          <div class="ab-value-num">01</div>
          <div class="ab-value-title">Speed over features</div>
          <p class="ab-value-body">Every tap in a match is a second not watching the game. We optimise relentlessly for one-handed, glanceable logging — never for dashboard complexity.</p>
        </div>
        <div class="ab-value">
          <div class="ab-value-num">02</div>
          <div class="ab-value-title">Data never disappears</div>
          <p class="ab-value-body">Auto-save on every action, cloud backup in the background, wall-clock timer that survives the app closing. You never lose a puckout count because your phone locked.</p>
        </div>
        <div class="ab-value">
          <div class="ab-value-num">03</div>
          <div class="ab-value-title">Simple pricing, no surprises</div>
          <p class="ab-value-body">Free tier that's genuinely useful. Paid plans that are straightforward — no per-seat traps, no feature-gating the basics. Club Pro unlocks live sharing; everything else is accessible.</p>
        </div>
        <div class="ab-value">
          <div class="ab-value-num">04</div>
          <div class="ab-value-title">GAA-first design</div>
          <p class="ab-value-body">Puckout zones, county colour presets, hurling scoring — not generic sports analytics reskinned. Built specifically for how GAA teams prepare and train.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Built with -->
  <section class="ab-section ab-tech">
    <div class="ab-inner ab-tech-inner reveal">
      <div class="ab-tech-text">
        <div class="ab-eyebrow-sm">Technology</div>
        <h2 class="ab-section-title">Modern stack, offline DNA</h2>
        <p class="ab-section-sub">
          Built as a Progressive Web App so it installs like a native app but ships like a website.
          No App Store gatekeeping. No review delays. Updates reach every coach instantly.
        </p>
        <div class="ab-tech-list">
          <div class="ab-tech-item">
            <span class="ab-tech-dot"></span>
            <span>Svelte + Vite — fast, lightweight, no bundle bloat</span>
          </div>
          <div class="ab-tech-item">
            <span class="ab-tech-dot"></span>
            <span>IndexedDB — match data persists entirely on-device</span>
          </div>
          <div class="ab-tech-item">
            <span class="ab-tech-dot"></span>
            <span>Supabase — cloud sync and auth without a custom backend</span>
          </div>
          <div class="ab-tech-item">
            <span class="ab-tech-dot"></span>
            <span>Service worker — cache-first offline, works at 0% signal</span>
          </div>
          <div class="ab-tech-item">
            <span class="ab-tech-dot"></span>
            <span>Stripe — subscriptions with a proper Customer Portal</span>
          </div>
        </div>
      </div>
      <div class="ab-tech-badges">
        <div class="ab-badge">Svelte</div>
        <div class="ab-badge">Vite</div>
        <div class="ab-badge">Supabase</div>
        <div class="ab-badge">Stripe</div>
        <div class="ab-badge">IndexedDB</div>
        <div class="ab-badge">PWA</div>
        <div class="ab-badge">Service Worker</div>
        <div class="ab-badge">Chart.js</div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="ab-cta reveal">
    <div class="ab-cta-inner">
      <h2 class="ab-cta-title">Ready to track your next match?</h2>
      <p class="ab-cta-sub">Free to get started. No credit card. Works offline from day one.</p>
      <button class="ab-cta-btn" on:click={() => onNavigate('home')}>Get started free</button>
    </div>
  </section>

  <LpFooter {onNavigate} />
</div>

<style>
  .about-page { font-family: var(--lp-font-body); }
  .lp-noise {
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px; pointer-events: none; z-index: 9999; opacity: 0.6;
  }

  /* Reveal animation */
  .reveal { transform: translateY(20px); transition: transform 0.6s ease, opacity 0.6s ease; opacity: 0; }
  .reveal.in { transform: none; opacity: 1; }

  /* Hero */
  .ab-hero {
    padding-top: 68px;
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 48px; align-items: center;
    max-width: 1100px; margin: 0 auto;
    padding-left: 40px; padding-right: 40px;
    padding-bottom: 80px; padding-top: calc(68px + 80px);
  }
  .ab-eyebrow {
    display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--lp-lime); background: rgba(186,255,41,0.1);
    border: 1px solid rgba(186,255,41,0.2); padding: 5px 14px; border-radius: 20px; margin-bottom: 24px;
  }
  .ab-title {
    font-family: var(--lp-font-head); font-size: clamp(48px, 6vw, 72px);
    line-height: 1.0; color: var(--lp-text); margin-bottom: 20px; letter-spacing: 0.01em;
  }
  .ab-sub { font-size: 18px; color: var(--lp-text2); line-height: 1.7; }
  .ab-hero-img svg { width: 100%; border-radius: 12px; border: 1px solid var(--lp-border); }

  /* Sections */
  .ab-section { padding: 80px 40px; }
  .ab-inner { max-width: 1100px; margin: 0 auto; }

  /* Origin */
  .ab-origin { background: var(--lp-surface); border-top: 1px solid var(--lp-border); border-bottom: 1px solid var(--lp-border); }
  .ab-origin .ab-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start; }
  .ab-story-eyebrow {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--lp-lime); margin-bottom: 12px;
  }
  .ab-story-title { font-family: var(--lp-font-head); font-size: 32px; color: var(--lp-text); margin-bottom: 24px; }
  .ab-story p { font-size: 15px; color: var(--lp-text2); line-height: 1.75; margin-bottom: 16px; }
  .ab-story p:last-child { margin-bottom: 0; }

  .ab-quote-card {
    background: var(--lp-bg); border: 1px solid var(--lp-border); border-radius: 12px;
    padding: 32px; margin-bottom: 24px;
  }
  .ab-quote-mark { font-family: var(--lp-font-head); font-size: 64px; color: var(--lp-lime); line-height: 0.7; margin-bottom: 16px; }
  .ab-quote-text { font-size: 17px; color: var(--lp-text); line-height: 1.6; font-style: italic; margin-bottom: 16px; }
  .ab-quote-attr { font-size: 12px; color: var(--lp-text3); text-transform: uppercase; letter-spacing: 0.08em; }

  .ab-stat-pills { display: flex; flex-direction: column; gap: 12px; }
  .ab-stat-pill {
    display: flex; align-items: center; gap: 16px;
    background: var(--lp-bg); border: 1px solid var(--lp-border);
    border-radius: 8px; padding: 14px 20px;
  }
  .ab-stat-n { font-family: var(--lp-font-head); font-size: 28px; color: var(--lp-lime); min-width: 60px; }
  .ab-stat-l { font-size: 13px; color: var(--lp-text2); text-transform: uppercase; letter-spacing: 0.06em; }

  /* Mission */
  .ab-mission-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start; }
  .ab-eyebrow-sm {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--lp-lime); margin-bottom: 16px;
  }
  .ab-section-title { font-family: var(--lp-font-head); font-size: clamp(28px, 4vw, 42px); color: var(--lp-text); margin-bottom: 16px; line-height: 1.1; }
  .ab-section-sub { font-size: 15px; color: var(--lp-text2); line-height: 1.7; }
  .ab-mission-cards { display: flex; flex-direction: column; gap: 20px; }
  .ab-mission-card {
    background: var(--lp-surface); border: 1px solid var(--lp-border);
    border-radius: 10px; padding: 24px;
  }
  .ab-mission-icon {
    width: 36px; height: 36px; border-radius: 8px;
    background: rgba(186,255,41,0.1); border: 1px solid rgba(186,255,41,0.2);
    display: flex; align-items: center; justify-content: center;
    color: var(--lp-lime); margin-bottom: 14px;
  }
  .ab-mission-card-title { font-size: 15px; font-weight: 600; color: var(--lp-text); margin-bottom: 8px; }
  .ab-mission-card p { font-size: 13px; color: var(--lp-text2); line-height: 1.6; margin: 0; }

  /* Values */
  .ab-values { background: var(--lp-surface); border-top: 1px solid var(--lp-border); border-bottom: 1px solid var(--lp-border); }
  .ab-values-header { margin-bottom: 48px; }
  .ab-values-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .ab-value-num { font-family: var(--lp-font-head); font-size: 40px; color: rgba(186,255,41,0.2); line-height: 1; margin-bottom: 12px; }
  .ab-value-title { font-size: 17px; font-weight: 600; color: var(--lp-text); margin-bottom: 10px; }
  .ab-value-body { font-size: 14px; color: var(--lp-text2); line-height: 1.7; margin: 0; }

  /* Tech */
  .ab-tech-inner { display: grid; grid-template-columns: 1fr auto; gap: 64px; align-items: start; }
  .ab-tech-list { margin-top: 24px; display: flex; flex-direction: column; gap: 10px; }
  .ab-tech-item { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--lp-text2); }
  .ab-tech-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--lp-lime); flex-shrink: 0; }
  .ab-tech-badges { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
  .ab-badge {
    background: var(--lp-surface); border: 1px solid var(--lp-border);
    border-radius: 8px; padding: 8px 20px; font-size: 13px; font-weight: 500;
    color: var(--lp-text2); text-align: center; white-space: nowrap;
  }

  /* CTA */
  .ab-cta {
    background: linear-gradient(135deg, rgba(186,255,41,0.06) 0%, rgba(186,255,41,0.02) 100%);
    border-top: 1px solid var(--lp-border); padding: 100px 40px;
    text-align: center;
  }
  .ab-cta-inner { max-width: 600px; margin: 0 auto; }
  .ab-cta-title { font-family: var(--lp-font-head); font-size: clamp(36px, 5vw, 56px); color: var(--lp-text); margin-bottom: 16px; }
  .ab-cta-sub { font-size: 16px; color: var(--lp-text2); margin-bottom: 32px; }
  .ab-cta-btn {
    background: var(--lp-lime); color: #05080F; font-family: var(--lp-font-body);
    font-size: 15px; font-weight: 700; border: none; border-radius: 8px;
    padding: 14px 36px; cursor: pointer; transition: opacity 0.2s;
  }
  .ab-cta-btn:hover { opacity: 0.88; }

  @media (max-width: 900px) {
    .ab-hero { grid-template-columns: 1fr; padding-top: calc(68px + 48px); }
    .ab-hero-img { order: -1; }
    .ab-origin .ab-inner { grid-template-columns: 1fr; gap: 40px; }
    .ab-mission-inner { grid-template-columns: 1fr; gap: 40px; }
    .ab-tech-inner { grid-template-columns: 1fr; gap: 32px; }
    .ab-tech-badges { flex-direction: row; flex-wrap: wrap; }
    .ab-badge { flex: 1; min-width: 80px; }
  }
  @media (max-width: 600px) {
    .ab-section { padding: 60px 20px; }
    .ab-hero { padding-left: 20px; padding-right: 20px; }
    .ab-values-grid { grid-template-columns: 1fr; gap: 28px; }
    .ab-cta { padding: 60px 20px; }
  }
</style>
