<script>
  import { onMount } from 'svelte'
  import { signIn, signUp } from './auth-store.js'

  // Auth state
  let mode = 'login' // 'login' | 'choose' | 'personal' | 'club' | 'join'
  let email = '', password = '', clubName = '', teamCode = ''
  let loading = false
  let error = null
  let successMsg = null

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { error = 'Please enter your email and password'; return }
    loading = true; error = null
    try { await signIn(email, password) }
    catch (e) { error = e.message }
    loading = false
  }

  async function handlePersonalSignup() {
    if (!email.trim() || !password.trim()) { error = 'Please enter your email and password'; return }
    loading = true; error = null
    try {
      localStorage.setItem('signup_intent', JSON.stringify({ type: 'personal' }))
      await signUp(email, password)
      successMsg = 'Check your email to confirm your account, then sign in.'
    } catch (e) { error = e.message }
    loading = false
  }

  async function handleClubSignup() {
    if (!clubName.trim()) { error = 'Please enter your club name'; return }
    if (!email.trim() || !password.trim()) { error = 'Please enter your email and password'; return }
    loading = true; error = null
    try {
      localStorage.setItem('signup_intent', JSON.stringify({ type: 'club', clubName: clubName.trim() }))
      await signUp(email, password)
      successMsg = 'Check your email to confirm your account, then sign in to set up your teams.'
    } catch (e) { error = e.message }
    loading = false
  }

  async function handleJoinTeam() {
    const code = teamCode.trim()
    if (code.length !== 6 || !/^\d{6}$/.test(code)) { error = 'Team code must be 6 digits'; return }
    if (!email.trim() || !password.trim()) { error = 'Please enter your email and password'; return }
    loading = true; error = null
    try {
      localStorage.setItem('signup_intent', JSON.stringify({ type: 'join', teamCode: code }))
      await signUp(email, password)
      successMsg = 'Check your email to confirm your account, then sign in.'
    } catch (e) { error = e.message }
    loading = false
  }

  function reset() { error = null; successMsg = null }
  function setMode(m) { mode = m; reset() }

  onMount(() => {
    // Scroll reveal
    const revealEls = document.querySelectorAll('.lp .reveal')
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      })
    }, { threshold: 0.12 })
    revealEls.forEach(el => io.observe(el))

    // Count-up animation
    function animateCount(el) {
      const target = parseInt(el.dataset.target)
      if (!target) { el.textContent = el.dataset.target; return }
      const duration = 1600
      const start = performance.now()
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        el.textContent = Math.round(ease * target)
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
    const countEls = document.querySelectorAll('.lp .count-up')
    const countIO = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { animateCount(e.target); countIO.unobserve(e.target) }
      })
    }, { threshold: 0.5 })
    countEls.forEach(el => countIO.observe(el))

    // Nav scroll shadow
    const nav = document.querySelector('.lp-nav')
    const onScroll = () => {
      if (nav) nav.style.boxShadow = window.scrollY > 20 ? '0 4px 30px rgba(0,0,0,0.4)' : 'none'
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // Parallax glow
    const glow = document.querySelector('.lp .hero-glow')
    const onMousemove = (e) => {
      if (!glow) return
      const x = (e.clientX / window.innerWidth - 0.5) * 40
      const y = (e.clientY / window.innerHeight - 0.5) * 40
      glow.style.transform = `translate(${x}px, ${y}px)`
    }
    window.addEventListener('mousemove', onMousemove, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('mousemove', onMousemove)
    }
  })
</script>

<div class="lp">
  <!-- Noise overlay -->
  <div class="lp-noise"></div>

  <!-- ── NAV ────────────────────────────────────────────────────────────── -->
  <nav class="lp-nav">
    <div class="nav-logo">
      <div class="nav-logo-mark">G</div>
      <span class="nav-logo-text">GAA <span>Stats</span> App</span>
    </div>
    <ul class="nav-links">
      <li><a href="#features">Features</a></li>
      <li><a href="#pricing">Pricing</a></li>
      <li><a href="#offline">Offline</a></li>
      <li><a href="#analytics">Analytics</a></li>
    </ul>
    <a href="#signin" class="nav-cta">Sign In</a>
  </nav>

  <!-- ── HERO ───────────────────────────────────────────────────────────── -->
  <section class="hero">
    <div class="hero-grid-bg"></div>
    <div class="hero-glow"></div>
    <div class="hero-glow-amber"></div>

    <div class="hero-content">
      <div class="hero-eyebrow">Built for GAA Coaches</div>
      <h1 class="hero-title">
        Coach<br>
        <span class="accent">Smarter.</span><br>
        Win <span class="amber-accent">More.</span>
      </h1>
      <p class="hero-sub">
        Real-time match statistics for hurling coaches. Log every stat, track every player, and analyse performance — even with zero signal at the ground.
      </p>
      <div class="hero-actions">
        <a href="#signin" class="btn-primary">
          Get Started Free
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <a href="#features" class="btn-secondary">
          See all features
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
      </div>
      <div class="hero-stats">
        <div>
          <div class="hero-stat-num">15+</div>
          <div class="hero-stat-label">Default Stats</div>
        </div>
        <div>
          <div class="hero-stat-num">100%</div>
          <div class="hero-stat-label">Offline</div>
        </div>
        <div>
          <div class="hero-stat-num">∞</div>
          <div class="hero-stat-label">Custom Stats</div>
        </div>
      </div>
    </div>

    <!-- Auth card in hero (desktop) -->
    <div class="hero-auth" id="signin">
      <div class="auth-card-dark">
        <div class="auth-dark-header">
          <div class="auth-dark-logo-mark">G</div>
          <div>
            <div class="auth-dark-title">GAA Stats App</div>
            <div class="auth-dark-sub">Hurling match analytics</div>
          </div>
        </div>

        <!-- LOGIN -->
        {#if mode === 'login'}
          <div class="auth-dark-fields">
            <div class="auth-dark-field">
              <label>Email</label>
              <input type="email" bind:value={email} placeholder="coach@example.com"
                on:keydown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div class="auth-dark-field">
              <label>Password</label>
              <input type="password" bind:value={password} placeholder="••••••••"
                on:keydown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            {#if error}<div class="auth-dark-error">{error}</div>{/if}
            <button class="auth-dark-btn-primary" on:click={handleLogin} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button class="auth-dark-btn-outline" on:click={() => setMode('choose')}>
              Create an account
            </button>
          </div>

        <!-- CHOOSE -->
        {:else if mode === 'choose'}
          <p class="auth-dark-choose-sub">How are you using GAA Stats?</p>
          <div class="auth-dark-option-list">
            <button class="auth-dark-option" on:click={() => setMode('join')}>
              <div class="auth-dark-option-icon blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              </div>
              <div class="auth-dark-option-body">
                <strong>Join my team</strong>
                <span>I have a 6-digit code from my manager</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button class="auth-dark-option" on:click={() => setMode('personal')}>
              <div class="auth-dark-option-icon lime">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div class="auth-dark-option-body">
                <strong>Personal account</strong>
                <span>1 coach, 1 team</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button class="auth-dark-option" on:click={() => setMode('club')}>
              <div class="auth-dark-option-icon amber">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div class="auth-dark-option-body">
                <strong>Set up my club</strong>
                <span>Multiple teams, shared codes</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <button class="auth-dark-back" on:click={() => setMode('login')}>← Back to sign in</button>

        <!-- JOIN TEAM -->
        {:else if mode === 'join'}
          {#if successMsg}
            <div class="auth-dark-success">{successMsg}</div>
            <button class="auth-dark-btn-primary" on:click={() => setMode('login')}>Go to sign in</button>
          {:else}
            <div class="auth-dark-flow-header">
              <button class="auth-dark-back-btn" on:click={() => setMode('choose')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span>Join my team</span>
            </div>
            <div class="auth-dark-fields">
              <div class="auth-dark-field">
                <label>6-digit team code</label>
                <input type="text" inputmode="numeric" pattern="\d*" maxlength="6"
                  bind:value={teamCode} placeholder="e.g. 482651"
                  style="font-size:22px;font-weight:800;letter-spacing:0.2em;text-align:center" />
                <div class="auth-dark-hint">Your manager will have shared this with you</div>
              </div>
              <div class="auth-dark-field">
                <label>Your email</label>
                <input type="email" bind:value={email} placeholder="coach@example.com" />
              </div>
              <div class="auth-dark-field">
                <label>Create a password</label>
                <input type="password" bind:value={password} placeholder="••••••••" />
              </div>
              {#if error}<div class="auth-dark-error">{error}</div>{/if}
              <button class="auth-dark-btn-primary" on:click={handleJoinTeam} disabled={loading}>
                {loading ? 'Joining…' : 'Join team'}
              </button>
            </div>
          {/if}

        <!-- PERSONAL -->
        {:else if mode === 'personal'}
          {#if successMsg}
            <div class="auth-dark-success">{successMsg}</div>
            <button class="auth-dark-btn-primary" on:click={() => setMode('login')}>Go to sign in</button>
          {:else}
            <div class="auth-dark-flow-header">
              <button class="auth-dark-back-btn" on:click={() => setMode('choose')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span>Personal account</span>
            </div>
            <div class="auth-dark-fields">
              <div class="auth-dark-field">
                <label>Email</label>
                <input type="email" bind:value={email} placeholder="coach@example.com" />
              </div>
              <div class="auth-dark-field">
                <label>Create a password</label>
                <input type="password" bind:value={password} placeholder="••••••••" />
              </div>
              {#if error}<div class="auth-dark-error">{error}</div>{/if}
              <button class="auth-dark-btn-primary" on:click={handlePersonalSignup} disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
              <div class="auth-dark-tier-note">
                Free to start · Upgrade to <strong>Personal Pro at €7.99/month</strong> for full analytics
              </div>
            </div>
          {/if}

        <!-- CLUB -->
        {:else if mode === 'club'}
          {#if successMsg}
            <div class="auth-dark-success">{successMsg}</div>
            <button class="auth-dark-btn-primary" on:click={() => setMode('login')}>Go to sign in</button>
          {:else}
            <div class="auth-dark-flow-header">
              <button class="auth-dark-back-btn" on:click={() => setMode('choose')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span>Set up my club</span>
            </div>
            <div class="auth-dark-fields">
              <div class="auth-dark-field">
                <label>Club name</label>
                <input type="text" bind:value={clubName} placeholder="e.g. Doora Barefield GAA" />
              </div>
              <div class="auth-dark-field">
                <label>Your email</label>
                <input type="email" bind:value={email} placeholder="manager@example.com" />
              </div>
              <div class="auth-dark-field">
                <label>Create a password</label>
                <input type="password" bind:value={password} placeholder="••••••••" />
              </div>
              {#if error}<div class="auth-dark-error">{error}</div>{/if}
              <button class="auth-dark-btn-primary" on:click={handleClubSignup} disabled={loading}>
                {loading ? 'Creating club…' : 'Create club'}
              </button>
              <div class="auth-dark-tier-note">
                After signing in you'll create your teams and get codes to share with your coaches.
                Upgrade to <strong>Club at €15/month</strong> for all features.
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </section>

  <!-- ── MARQUEE STRIP ───────────────────────────────────────────────────── -->
  <div class="strip">
    <div class="strip-inner">
      <span class="strip-item"><span class="strip-dot"></span> Live Match Logging</span>
      <span class="strip-item"><span class="strip-dot"></span> Puckout Zone Tracking</span>
      <span class="strip-item"><span class="strip-dot"></span> Player Analytics</span>
      <span class="strip-item"><span class="strip-dot"></span> Works 100% Offline</span>
      <span class="strip-item"><span class="strip-dot"></span> Cloud Sync</span>
      <span class="strip-item"><span class="strip-dot"></span> PDF Match Reports</span>
      <span class="strip-item"><span class="strip-dot"></span> Squad Management</span>
      <span class="strip-item"><span class="strip-dot"></span> Stripe Payments</span>
      <span class="strip-item"><span class="strip-dot"></span> Live Match Logging</span>
      <span class="strip-item"><span class="strip-dot"></span> Puckout Zone Tracking</span>
      <span class="strip-item"><span class="strip-dot"></span> Player Analytics</span>
      <span class="strip-item"><span class="strip-dot"></span> Works 100% Offline</span>
      <span class="strip-item"><span class="strip-dot"></span> Cloud Sync</span>
      <span class="strip-item"><span class="strip-dot"></span> PDF Match Reports</span>
      <span class="strip-item"><span class="strip-dot"></span> Squad Management</span>
      <span class="strip-item"><span class="strip-dot"></span> Stripe Payments</span>
    </div>
  </div>

  <!-- ── FEATURES ────────────────────────────────────────────────────────── -->
  <section class="features-section" id="features">
    <div class="features-header">
      <div>
        <div class="section-eyebrow reveal">Everything you need</div>
        <h2 class="section-title reveal reveal-delay-1">Every stat.<br>Every match.</h2>
      </div>
      <p class="section-body reveal reveal-delay-2">
        GAA Stats App gives every sideline coach a full data team in their pocket. Tap to log, swipe to analyse, share with your selectors instantly.
      </p>
    </div>
    <div class="features-grid">

      <div class="feature-card reveal">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="feature-title">Live Match Logging</div>
        <div class="feature-desc">One tap to log any stat. Player rows mode or quick-tap mode. Designed to be used one-handed on the sideline while watching the match.</div>
      </div>

      <div class="feature-card reveal reveal-delay-1">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <div class="feature-title">Player Analytics</div>
        <div class="feature-desc">Individual player stat trends across every match. Compare any two players side-by-side. Spot form slumps and breakouts over the season.</div>
      </div>

      <div class="feature-card reveal reveal-delay-2">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </div>
        <div class="feature-title">Team Stats & Pitch Map</div>
        <div class="feature-desc">Full team performance overview with an interactive pitch map. See where every score, turnover, and puckout happened on the field.</div>
      </div>

      <div class="feature-card amber reveal reveal-delay-3">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#FFB800" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div class="feature-title">Puckout Zone Tracking</div>
        <div class="feature-desc">Log every puckout with a 10-zone pitch map tap. Track win %, which zones you target, which opposition players are winning your puckouts and who's marking them.</div>
      </div>

      <div class="feature-card reveal reveal-delay-1">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="feature-title">PDF Match Reports</div>
        <div class="feature-desc">Export a full match report as a formatted PDF. Share with selectors, upload to the club system, or keep for your own records.</div>
      </div>

      <div class="feature-card reveal reveal-delay-2">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <div class="feature-title">Performance Targets</div>
        <div class="feature-desc">Set team targets for each stat — puckout win %, scores per game, turnovers. Track progress against goals across the season with trend charts.</div>
      </div>

      <div class="feature-card reveal">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
        <div class="feature-title">Match Timeline</div>
        <div class="feature-desc">A chronological event feed for every match. Scores, puckouts, subs — all timestamped. Filter by event type. The full story of the match in one scroll.</div>
      </div>

      <div class="feature-card reveal reveal-delay-1">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div class="feature-title">Squad Management</div>
        <div class="feature-desc">Save your full squad once, then tap to add them to any match. Edit numbers, positions, and names any time. Carry over from season to season.</div>
      </div>

      <div class="feature-card amber reveal reveal-delay-2">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#FFB800" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="feature-title">Opposition Tracking</div>
        <div class="feature-desc">Log opposition scores with the scorer's jersey number and which of your players was marking them. Instantly spot who's getting burned in defence.</div>
      </div>

    </div>
  </section>

  <!-- ── PITCH MAP ───────────────────────────────────────────────────────── -->
  <section class="pitch-section" id="pitch">
    <div>
      <div class="section-eyebrow reveal">Spatial intelligence</div>
      <h2 class="section-title reveal reveal-delay-1">See the<br><span style="color:var(--lp-lime)">whole</span><br>picture.</h2>
      <p class="section-body reveal reveal-delay-2" style="margin-bottom:24px">
        The interactive pitch map shows you exactly where every stat happened on the field — scored from, won in, turned over.
      </p>
      <ul class="check-list reveal reveal-delay-3">
        <li>10-zone puckout heatmap — colour-coded by win rate</li>
        <li>Tap any zone to filter all stats to that area</li>
        <li>Filter by period — H1, H2, or full match</li>
        <li>Top scorer locations layered onto the pitch</li>
        <li>DB end vs opposition end stats split</li>
      </ul>
    </div>
    <div class="pitch-mockup reveal reveal-delay-2">
      <div class="pitch-svg-wrap">
        <svg class="pitch-svg" viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg">
          <rect width="360" height="220" rx="8" fill="#0D1F14"/>
          <rect x="10" y="10" width="340" height="200" rx="4" fill="none" stroke="#1A3022" stroke-width="1.5"/>
          <line x1="180" y1="10" x2="180" y2="210" stroke="#1A3022" stroke-width="1"/>
          <circle cx="180" cy="110" r="22" fill="none" stroke="#1A3022" stroke-width="1"/>
          <rect x="10" y="70" width="28" height="80" fill="none" stroke="#1A3022" stroke-width="1"/>
          <rect x="10" y="52" width="55" height="116" fill="none" stroke="#1A3022" stroke-width="1"/>
          <rect x="322" y="70" width="28" height="80" fill="none" stroke="#1A3022" stroke-width="1"/>
          <rect x="295" y="52" width="55" height="116" fill="none" stroke="#1A3022" stroke-width="1"/>
          <line x1="90" y1="10" x2="90" y2="210" stroke="#1A3022" stroke-width="0.5" stroke-dasharray="3,4"/>
          <line x1="270" y1="10" x2="270" y2="210" stroke="#1A3022" stroke-width="0.5" stroke-dasharray="3,4"/>
          <rect x="10" y="10" width="80" height="100" fill="rgba(45,122,45,0.22)" rx="2"/>
          <rect x="10" y="110" width="80" height="100" fill="rgba(45,122,45,0.18)" rx="2"/>
          <rect x="90" y="10" width="90" height="100" fill="rgba(255,184,0,0.15)" rx="2"/>
          <rect x="90" y="110" width="90" height="100" fill="rgba(45,122,45,0.14)" rx="2"/>
          <rect x="180" y="10" width="90" height="100" fill="rgba(255,58,58,0.15)" rx="2"/>
          <rect x="180" y="110" width="90" height="100" fill="rgba(255,184,0,0.12)" rx="2"/>
          <rect x="270" y="10" width="80" height="100" fill="rgba(255,58,58,0.12)" rx="2"/>
          <rect x="270" y="110" width="80" height="100" fill="rgba(255,58,58,0.08)" rx="2"/>
          <text x="50" y="62" text-anchor="middle" fill="#BAFF29" font-size="9" font-family="Barlow Condensed" font-weight="700">72%</text>
          <text x="135" y="62" text-anchor="middle" fill="#FFB800" font-size="9" font-family="Barlow Condensed" font-weight="700">54%</text>
          <text x="225" y="62" text-anchor="middle" fill="#FF3A3A" font-size="9" font-family="Barlow Condensed" font-weight="700">38%</text>
          <text x="310" y="62" text-anchor="middle" fill="#FF3A3A" font-size="9" font-family="Barlow Condensed" font-weight="700">22%</text>
          <circle cx="68" cy="92" r="5" fill="#BAFF29" opacity="0.9"/>
          <circle cx="80" cy="75" r="5" fill="#BAFF29" opacity="0.8"/>
          <circle cx="55" cy="108" r="5" fill="#BAFF29" opacity="0.85"/>
          <circle cx="110" cy="88" r="4" fill="#BAFF29" opacity="0.7"/>
          <circle cx="130" cy="68" r="5" fill="#BAFF29" opacity="0.75"/>
          <circle cx="72" cy="140" r="4" fill="#BAFF29" opacity="0.6"/>
          <circle cx="95" cy="155" r="5" fill="#FFB800" opacity="0.8"/>
          <circle cx="82" cy="60" r="6" fill="#FFB800" opacity="0.9"/>
          <path d="M 40 110 Q 120 60 180 110" fill="none" stroke="#BAFF29" stroke-width="1" opacity="0.3"/>
          <path d="M 40 110 Q 160 40 225 95" fill="none" stroke="#BAFF29" stroke-width="1" opacity="0.25"/>
          <path d="M 40 110 Q 100 80 135 88" fill="none" stroke="#BAFF29" stroke-width="1" opacity="0.35"/>
          <rect x="14" y="195" width="8" height="8" rx="2" fill="rgba(45,122,45,0.6)"/>
          <text x="25" y="202" fill="#8CA3BF" font-size="8" font-family="Barlow Condensed">High win rate</text>
          <rect x="90" y="195" width="8" height="8" rx="2" fill="rgba(255,184,0,0.6)"/>
          <text x="101" y="202" fill="#8CA3BF" font-size="8" font-family="Barlow Condensed">Mixed</text>
          <rect x="148" y="195" width="8" height="8" rx="2" fill="rgba(255,58,58,0.6)"/>
          <text x="159" y="202" fill="#8CA3BF" font-size="8" font-family="Barlow Condensed">Low win rate</text>
          <circle cx="222" cy="199" r="4" fill="#BAFF29" opacity="0.9"/>
          <text x="229" y="202" fill="#8CA3BF" font-size="8" font-family="Barlow Condensed">Score</text>
        </svg>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
          <div class="pitch-badge lime">Puckouts 18W / 8L</div>
          <div class="pitch-badge amber">69% Win Rate</div>
          <div class="pitch-badge neutral">Full Match</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── OFFLINE ─────────────────────────────────────────────────────────── -->
  <section class="offline-section" id="offline">
    <div class="offline-inner">
      <div>
        <div class="signal-bars">
          <div class="signal-bar" style="height:8px"></div>
          <div class="signal-bar" style="height:14px"></div>
          <div class="signal-bar" style="height:20px"></div>
          <div class="signal-bar" style="height:28px"></div>
          <div class="signal-bar off" style="height:28px"></div>
        </div>
        <div class="offline-badge-tag">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v7M4 10l4-2 4 2" stroke="#BAFF29" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 14h12" stroke="#BAFF29" stroke-width="1.5" stroke-linecap="round"/></svg>
          100% Offline Ready
        </div>
        <div class="section-eyebrow reveal">PWA Technology</div>
        <h2 class="section-title reveal reveal-delay-1">No signal?<br><span style="color:var(--lp-lime)">No problem.</span></h2>
        <p class="section-body reveal reveal-delay-2" style="margin-bottom:32px">
          GAA grounds are notorious for poor mobile reception. GAA Stats App installs directly to your phone's home screen and works completely offline — every match, every stat, every time.
        </p>
        <ul class="check-list reveal reveal-delay-3">
          <li>Installs as a PWA — works like a native app</li>
          <li>All data saved locally to your device instantly</li>
          <li>Timer accurate even if phone is powered off mid-match</li>
          <li>Draft auto-saves on every tap — never lose a match</li>
          <li>Syncs to cloud automatically when you get signal back</li>
          <li>Works in airplane mode, underground, anywhere</li>
        </ul>
      </div>
      <div class="offline-visual reveal reveal-delay-2">
        <div class="ground-card">
          <div class="ground-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div class="ground-name">Cusack Park, Ennis</div>
            <div class="ground-status">Signal: Poor · App status: <span>Fully operational</span></div>
          </div>
        </div>
        <div class="ground-card">
          <div class="ground-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div class="ground-name">Doora Barefield GAA</div>
            <div class="ground-status">Signal: None · App status: <span>Fully operational</span></div>
          </div>
        </div>
        <div class="ground-card">
          <div class="ground-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BAFF29" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div class="ground-name">Any Rural Ground</div>
            <div class="ground-status">Signal: None · App status: <span>Fully operational</span></div>
          </div>
        </div>
        <div class="data-flow-box">
          <div class="data-flow-label">Data Flow</div>
          <div class="connectivity-vis">
            <div class="signal-dot"></div>
            <div style="font-size:10px;font-family:var(--lp-font-sub);color:var(--lp-lime);font-weight:700">DEVICE</div>
            <div class="signal-line"></div>
            <div style="font-size:10px;font-family:var(--lp-font-sub);color:var(--lp-text3)">IndexedDB</div>
            <div class="signal-line"></div>
            <div style="font-size:10px;font-family:var(--lp-font-sub);color:var(--lp-text3)">→ Cloud sync when online</div>
            <div class="signal-dot off"></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── STATS NUMBERS ──────────────────────────────────────────────────── -->
  <section class="stats-showcase">
    <div class="section-eyebrow reveal" style="justify-content:center;text-align:center">By the numbers</div>
    <h2 class="section-title reveal reveal-delay-1" style="text-align:center">
      Everything counted.<br><span style="color:var(--lp-lime)">Nothing missed.</span>
    </h2>
    <div class="big-stats reveal reveal-delay-2">
      <div class="big-stat-card">
        <div class="big-stat-num"><span class="count-up" data-target="15">0</span><span class="unit">+</span></div>
        <div class="big-stat-label">Default Stat Types</div>
      </div>
      <div class="big-stat-card">
        <div class="big-stat-num"><span class="count-up" data-target="10">0</span></div>
        <div class="big-stat-label">Puckout Zones</div>
      </div>
      <div class="big-stat-card">
        <div class="big-stat-num"><span class="count-up" data-target="100">0</span><span class="unit">%</span></div>
        <div class="big-stat-label">Offline Capable</div>
      </div>
      <div class="big-stat-card">
        <div class="big-stat-num"><span class="count-up" data-target="0">0</span><span class="unit">s</span></div>
        <div class="big-stat-label">Data Loss Guarantee</div>
      </div>
    </div>
  </section>

  <!-- ── ANALYTICS ──────────────────────────────────────────────────────── -->
  <section class="analytics-section" id="analytics">
    <div class="analytics-inner">
      <div class="chart-mockup reveal">
        <div class="chart-header">
          <div class="chart-title">Player Performance — Points</div>
          <div class="chart-period">Last 6 Matches</div>
        </div>
        <div class="chart-area">
          <svg class="bar-chart" viewBox="0 0 300 140" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="0" x2="300" y2="0" stroke="#1A2840" stroke-width="0.5"/>
            <line x1="0" y1="35" x2="300" y2="35" stroke="#1A2840" stroke-width="0.5"/>
            <line x1="0" y1="70" x2="300" y2="70" stroke="#1A2840" stroke-width="0.5"/>
            <line x1="0" y1="105" x2="300" y2="105" stroke="#1A2840" stroke-width="0.5"/>
            <rect x="8" y="70" width="28" height="70" rx="3" fill="#BAFF29" opacity="0.7"/>
            <rect x="58" y="42" width="28" height="98" rx="3" fill="#BAFF29" opacity="0.75"/>
            <rect x="108" y="56" width="28" height="84" rx="3" fill="#BAFF29" opacity="0.8"/>
            <rect x="158" y="14" width="28" height="126" rx="3" fill="#BAFF29" opacity="0.9"/>
            <rect x="208" y="28" width="28" height="112" rx="3" fill="#BAFF29"/>
            <rect x="258" y="21" width="28" height="119" rx="3" fill="#BAFF29"/>
            <text x="22" y="65" text-anchor="middle" fill="#BAFF29" font-size="9" font-family="Bebas Neue">4</text>
            <text x="72" y="37" text-anchor="middle" fill="#BAFF29" font-size="9" font-family="Bebas Neue">6</text>
            <text x="122" y="51" text-anchor="middle" fill="#BAFF29" font-size="9" font-family="Bebas Neue">5</text>
            <text x="172" y="9" text-anchor="middle" fill="#BAFF29" font-size="9" font-family="Bebas Neue">8</text>
            <text x="222" y="23" text-anchor="middle" fill="#BAFF29" font-size="9" font-family="Bebas Neue">7</text>
            <text x="272" y="16" text-anchor="middle" fill="#BAFF29" font-size="9" font-family="Bebas Neue">8</text>
          </svg>
        </div>
        <div class="chart-labels">
          <span class="chart-label">M1</span><span class="chart-label">M2</span>
          <span class="chart-label">M3</span><span class="chart-label">M4</span>
          <span class="chart-label">M5</span><span class="chart-label">M6</span>
        </div>
        <div class="player-compare">
          <div class="compare-sub">Player Compare — Avg Points</div>
          <div class="compare-row"><div class="compare-name">B. Murphy</div><div class="compare-bar-wrap"><div class="compare-bar" style="width:90%"></div></div><div class="compare-val">6.3</div></div>
          <div class="compare-row"><div class="compare-name">S. Collins</div><div class="compare-bar-wrap"><div class="compare-bar amber" style="width:72%"></div></div><div class="compare-val amber">5.1</div></div>
          <div class="compare-row"><div class="compare-name">C. Ryan</div><div class="compare-bar-wrap"><div class="compare-bar" style="width:56%"></div></div><div class="compare-val">3.9</div></div>
          <div class="compare-row"><div class="compare-name">M. Keane</div><div class="compare-bar-wrap"><div class="compare-bar amber" style="width:43%"></div></div><div class="compare-val amber">3.0</div></div>
        </div>
      </div>
      <div>
        <div class="section-eyebrow reveal">Deep analytics</div>
        <h2 class="section-title reveal reveal-delay-1">Know your<br><span style="color:var(--lp-lime)">players</span><br>completely.</h2>
        <p class="section-body reveal reveal-delay-2" style="margin-bottom:28px">
          GAA Stats App doesn't just count — it analyses. Every player's stats are tracked across every match so you can spot trends, compare players, and make selection decisions based on data.
        </p>
        <ul class="check-list reveal reveal-delay-3">
          <li>Per-player trend charts across the full season</li>
          <li>Side-by-side player comparison view</li>
          <li>Per-match breakdown table — drill into any game</li>
          <li>Custom stats tracked the same as default stats</li>
          <li>Aggregate totals across all matches with one tap</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- ── TIMELINE ────────────────────────────────────────────────────────── -->
  <section class="timeline-section" id="timeline">
    <div>
      <div class="section-eyebrow reveal">Match Story</div>
      <h2 class="section-title reveal reveal-delay-1">The full<br><span style="color:var(--lp-amber)">timeline</span><br>of every game.</h2>
      <p class="section-body reveal reveal-delay-2" style="margin-bottom:28px">
        Every event in the match — every score, puckout, sub, and stat — logged with a timestamp. Scroll through the entire match narrative after the final whistle.
      </p>
      <ul class="check-list reveal reveal-delay-3">
        <li>Timestamped event feed for every match</li>
        <li>Filter by event type — puckouts, scores, subs</li>
        <li>Share the timeline with your management team</li>
        <li>Stored permanently in match history</li>
        <li>Works retroactively from auto-saved draft data</li>
      </ul>
    </div>
    <div class="timeline-mockup reveal reveal-delay-2">
      <div class="tl-header">Match Timeline — Doora vs Clarecastle</div>
      <div class="tl-events">
        <div class="tl-event"><div class="tl-time">02'</div><div class="tl-dot lime"></div><div class="tl-text">Point scored</div><div class="tl-player">B. Murphy</div></div>
        <div class="tl-event"><div class="tl-time">05'</div><div class="tl-dot blue"></div><div class="tl-text">Puckout Won</div><div class="tl-player">Own Half · C. Ryan</div></div>
        <div class="tl-event"><div class="tl-time">08'</div><div class="tl-dot amber"></div><div class="tl-text">Goal scored</div><div class="tl-player">S. Collins</div></div>
        <div class="tl-event"><div class="tl-time">12'</div><div class="tl-dot red"></div><div class="tl-text">Puckout Lost</div><div class="tl-player">Midfield · #7 won it</div></div>
        <div class="tl-event"><div class="tl-time">17'</div><div class="tl-dot lime"></div><div class="tl-text">Point scored</div><div class="tl-player">M. Keane</div></div>
        <div class="tl-event"><div class="tl-time">22'</div><div class="tl-dot lime"></div><div class="tl-text">Point scored</div><div class="tl-player">B. Murphy</div></div>
        <div class="tl-event tl-sub"><div class="tl-time">27'</div><div class="tl-dot amber"></div><div class="tl-text">Substitution</div><div class="tl-player">P. Quinn → N. Barry</div></div>
        <div class="tl-event"><div class="tl-time">31'</div><div class="tl-dot lime"></div><div class="tl-text">Point scored</div><div class="tl-player">S. Collins</div></div>
        <div class="tl-halftime">Half Time — 1-08 to 0-04</div>
      </div>
    </div>
  </section>

  <!-- ── PRICING ─────────────────────────────────────────────────────────── -->
  <section class="pricing-section" id="pricing">
    <div class="pricing-header">
      <div class="section-eyebrow reveal" style="justify-content:center">Simple pricing</div>
      <h2 class="section-title reveal reveal-delay-1" style="text-align:center">
        Pick your plan.<br><span style="color:var(--lp-lime)">Or build your own.</span>
      </h2>
      <p class="section-body reveal reveal-delay-2" style="text-align:center;margin:0 auto;max-width:500px">
        Start free and upgrade when you're ready. Every plan includes offline-first logging, cloud sync, and squad management. Need something different? We'll build it with you.
      </p>
    </div>

    <div class="pricing-grid reveal reveal-delay-2">

      <!-- FREE -->
      <div class="plan-card">
        <div class="plan-name">Free</div>
        <div class="plan-price">€0<span class="plan-period">/month</span></div>
        <div class="plan-tagline">Get started today</div>
        <ul class="plan-features">
          <li>1 coach, 1 team</li>
          <li>Full match logging</li>
          <li>100% offline</li>
          <li>Cloud sync & backup</li>
          <li>Squad management</li>
          <li class="plan-feature-faded">Advanced analytics</li>
          <li class="plan-feature-faded">PDF match reports</li>
          <li class="plan-feature-faded">Performance targets</li>
        </ul>
        <button class="plan-btn" on:click={() => setMode('personal')}>
          Get Started Free
        </button>
      </div>

      <!-- PERSONAL PRO -->
      <div class="plan-card plan-featured">
        <div class="plan-badge">Most Popular</div>
        <div class="plan-name">Personal Pro</div>
        <div class="plan-price">€7.99<span class="plan-period">/month</span></div>
        <div class="plan-tagline">Full analytics for one coach</div>
        <ul class="plan-features">
          <li>1 coach, 1 team</li>
          <li>Full match logging</li>
          <li>100% offline</li>
          <li>Cloud sync & backup</li>
          <li>Squad management</li>
          <li>Full player analytics</li>
          <li>PDF match reports</li>
          <li>Performance targets</li>
        </ul>
        <button class="plan-btn plan-btn-featured" on:click={() => setMode('personal')}>
          Start Free Trial
        </button>
      </div>

      <!-- CLUB -->
      <div class="plan-card">
        <div class="plan-name">Club</div>
        <div class="plan-price">€15<span class="plan-period">/month</span></div>
        <div class="plan-tagline">Multiple teams, one club</div>
        <ul class="plan-features">
          <li>Multiple teams</li>
          <li>Multi-coach access</li>
          <li>Shared team codes</li>
          <li>Full match logging</li>
          <li>100% offline</li>
          <li>Full player analytics</li>
          <li>PDF match reports</li>
          <li>Performance targets</li>
        </ul>
        <button class="plan-btn" on:click={() => setMode('club')}>
          Set Up My Club
        </button>
      </div>

      <!-- CLUB PRO -->
      <div class="plan-card">
        <div class="plan-name">Club Pro</div>
        <div class="plan-price">€25<span class="plan-period">/month</span></div>
        <div class="plan-tagline">Everything, for serious clubs</div>
        <ul class="plan-features">
          <li>Everything in Club</li>
          <li>Priority support</li>
          <li>Early access to features</li>
          <li>Custom club branding</li>
          <li>Export all data (CSV)</li>
          <li>Season comparison tools</li>
          <li>Live match sharing</li>
          <li>Unlimited history</li>
        </ul>
        <button class="plan-btn" on:click={() => setMode('club')}>
          Start Club Pro
        </button>
      </div>

      <!-- CUSTOM -->
      <div class="plan-card plan-custom">
        <div class="plan-custom-badge">Enterprise</div>
        <div class="plan-name">Custom Plan</div>
        <div class="plan-price-custom">Let's talk</div>
        <div class="plan-tagline">Built around your needs</div>
        <ul class="plan-features">
          <li>Everything in Club Pro</li>
          <li>Custom stat types</li>
          <li>White-label option</li>
          <li>Multi-county / board</li>
          <li>API access</li>
          <li>Dedicated onboarding</li>
          <li>SLA & priority support</li>
          <li>Custom integrations</li>
        </ul>
        <a href="mailto:contact@gaastatsapp.com" class="plan-btn plan-btn-custom">
          Contact Us
        </a>
        <div class="plan-custom-note">
          Working with a county board, school, or large organisation? We'll design a plan that fits exactly what you need.
        </div>
      </div>

    </div>
  </section>

  <!-- ── CTA ────────────────────────────────────────────────────────────── -->
  <section class="cta-section" id="cta">
    <div class="cta-inner">
      <div class="cta-tag">Ready to try it?</div>
      <h2 class="cta-title reveal">
        Data-driven<br><span class="lime">hurling</span> starts<br>here.
      </h2>
      <p class="cta-sub reveal reveal-delay-1">
        Join GAA coaches already using GAA Stats App on the sideline. Works on any phone, fully offline. Free to start — Pro plans from €7.99/month.
      </p>
      <div class="cta-actions reveal reveal-delay-2">
        <a href="#signin" class="btn-large primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          Get Started Free
        </a>
        <a href="#features" class="btn-large ghost">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 16 12 12 16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          Explore Features
        </a>
      </div>
      <div class="cta-note reveal reveal-delay-3">
        Installs to your home screen · No app store required · Works on iOS and Android
      </div>
    </div>
  </section>

  <!-- ── FOOTER ──────────────────────────────────────────────────────────── -->
  <footer class="lp-footer">
    <div class="footer-logo">GAA <span>Stats</span> App</div>
    <ul class="footer-links">
      <li><a href="#features">Features</a></li>
      <li><a href="#pricing">Pricing</a></li>
      <li><a href="#offline">Offline</a></li>
      <li><a href="#analytics">Analytics</a></li>
      <li><a href="#signin">Sign In</a></li>
    </ul>
    <div class="footer-copy">© 2026 GAA Stats App. Built for GAA coaches.</div>
  </footer>

</div>

<style>
  /* ── TOKENS ───────────────────────────────────────────────────────────── */
  .lp {
    --lp-bg:        #05080F;
    --lp-bg2:       #080D18;
    --lp-surface:   #0C1422;
    --lp-surface2:  #101C30;
    --lp-border:    #1A2840;
    --lp-lime:      #BAFF29;
    --lp-lime-dim:  #8FCC00;
    --lp-amber:     #FFB800;
    --lp-amber-dim: #CC9200;
    --lp-red:       #FF3A3A;
    --lp-text:      #E4EDF8;
    --lp-text2:     #8CA3BF;
    --lp-text3:     #4A6280;
    --lp-font-head: 'Bebas Neue', sans-serif;
    --lp-font-sub:  'Barlow Condensed', sans-serif;
    --lp-font-body: 'Outfit', sans-serif;

    background: var(--lp-bg);
    color: var(--lp-text);
    font-family: var(--lp-font-body);
    font-size: 16px;
    line-height: 1.6;
    overflow-x: hidden;
    position: relative;
    min-height: 100vh;
  }

  /* ── NOISE ────────────────────────────────────────────────────────────── */
  .lp-noise {
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.6;
  }

  /* ── NAV ──────────────────────────────────────────────────────────────── */
  .lp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px; height: 68px;
    background: rgba(5,8,15,0.85);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--lp-border);
  }
  .nav-logo { display: flex; align-items: center; gap: 10px; }
  .nav-logo-mark {
    width: 36px; height: 36px; background: var(--lp-lime);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-family: var(--lp-font-head); font-size: 18px; color: var(--lp-bg); letter-spacing: 0;
  }
  .nav-logo-text {
    font-family: var(--lp-font-sub); font-weight: 700; font-size: 18px;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--lp-text);
  }
  .nav-logo-text span { color: var(--lp-lime); }
  .nav-links { display: flex; gap: 36px; list-style: none; }
  .nav-links a {
    font-family: var(--lp-font-sub); font-size: 15px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--lp-text2);
    transition: color .2s; text-decoration: none;
  }
  .nav-links a:hover { color: var(--lp-lime); }
  .nav-cta {
    background: var(--lp-lime); color: var(--lp-bg);
    font-family: var(--lp-font-sub); font-weight: 700; font-size: 14px;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 10px 22px; border-radius: 6px;
    transition: background .2s, transform .15s;
    text-decoration: none;
  }
  .nav-cta:hover { background: var(--lp-lime-dim); transform: translateY(-1px); }

  /* ── HERO ─────────────────────────────────────────────────────────────── */
  .hero {
    min-height: 100vh; padding-top: 68px;
    position: relative; display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center; overflow: hidden;
  }
  .hero-grid-bg {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(186,255,41,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(186,255,41,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%);
  }
  .hero-glow {
    position: absolute; top: -200px; left: -200px;
    width: 700px; height: 700px;
    background: radial-gradient(circle, rgba(186,255,41,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-glow-amber {
    position: absolute; bottom: -100px; right: -100px;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(255,184,0,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-content {
    padding: 80px 0 80px 80px; position: relative; z-index: 2;
  }
  .hero-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(186,255,41,0.1); border: 1px solid rgba(186,255,41,0.25);
    border-radius: 100px; padding: 5px 14px;
    font-family: var(--lp-font-sub); font-size: 13px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--lp-lime);
    margin-bottom: 28px;
  }
  .hero-eyebrow::before {
    content: ''; width: 6px; height: 6px;
    background: var(--lp-lime); border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.7); }
  }
  .hero-title {
    font-family: var(--lp-font-head);
    font-size: clamp(64px, 7vw, 108px);
    line-height: 0.92; letter-spacing: 0.01em;
    text-transform: uppercase; margin-bottom: 28px;
  }
  .hero-title .accent { color: var(--lp-lime); }
  .hero-title .amber-accent { color: var(--lp-amber); }
  .hero-sub {
    font-size: 18px; font-weight: 300; color: var(--lp-text2);
    max-width: 460px; margin-bottom: 44px; line-height: 1.7;
  }
  .hero-actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  .btn-primary {
    background: var(--lp-lime); color: var(--lp-bg);
    font-family: var(--lp-font-sub); font-weight: 700; font-size: 16px;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 16px 32px; border-radius: 8px;
    display: inline-flex; align-items: center; gap: 10px;
    transition: background .2s, transform .15s, box-shadow .2s;
    text-decoration: none;
  }
  .btn-primary:hover { background: var(--lp-lime-dim); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(186,255,41,0.2); }
  .btn-secondary {
    font-family: var(--lp-font-sub); font-weight: 600; font-size: 16px;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--lp-text2);
    display: inline-flex; align-items: center; gap: 8px;
    transition: color .2s; padding: 16px 8px; text-decoration: none;
  }
  .btn-secondary:hover { color: var(--lp-text); }
  .hero-stats {
    display: flex; gap: 40px; margin-top: 52px; padding-top: 40px;
    border-top: 1px solid var(--lp-border);
  }
  .hero-stat-num { font-family: var(--lp-font-head); font-size: 42px; color: var(--lp-lime); line-height: 1; }
  .hero-stat-label { font-size: 13px; color: var(--lp-text3); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }

  /* ── HERO AUTH CARD ───────────────────────────────────────────────────── */
  .hero-auth {
    position: relative; z-index: 2;
    display: flex; align-items: center; justify-content: center;
    padding: 80px 80px 80px 40px;
  }
  .auth-card-dark {
    background: rgba(12, 20, 34, 0.95);
    border: 1px solid var(--lp-border);
    border-radius: 20px; padding: 28px;
    width: 100%; max-width: 400px;
    display: flex; flex-direction: column; gap: 14px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03);
    backdrop-filter: blur(20px);
  }
  .auth-dark-header {
    display: flex; align-items: center; gap: 14px;
    padding-bottom: 4px;
  }
  .auth-dark-logo-mark {
    width: 44px; height: 44px; background: var(--lp-lime);
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    font-family: var(--lp-font-head); font-size: 22px; color: var(--lp-bg);
    flex-shrink: 0;
  }
  .auth-dark-title { font-family: var(--lp-font-sub); font-size: 18px; font-weight: 700; color: var(--lp-text); text-transform: uppercase; letter-spacing: 0.06em; }
  .auth-dark-sub { font-size: 12px; color: var(--lp-text3); margin-top: 2px; }

  .auth-dark-fields { display: flex; flex-direction: column; gap: 12px; }
  .auth-dark-field { display: flex; flex-direction: column; gap: 5px; }
  .auth-dark-field label { font-size: 11px; font-weight: 600; color: var(--lp-text3); text-transform: uppercase; letter-spacing: 0.08em; }
  .auth-dark-field input {
    padding: 12px 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--lp-border);
    border-radius: 8px; font-size: 15px; color: var(--lp-text);
    font-family: var(--lp-font-body);
    transition: all 0.15s;
    outline: none;
  }
  .auth-dark-field input::placeholder { color: var(--lp-text3); }
  .auth-dark-field input:focus { border-color: var(--lp-lime); background: rgba(186,255,41,0.04); box-shadow: 0 0 0 3px rgba(186,255,41,0.08); }
  .auth-dark-hint { font-size: 11px; color: var(--lp-text3); }

  .auth-dark-btn-primary {
    width: 100%; padding: 14px;
    background: var(--lp-lime); color: var(--lp-bg);
    border: none; border-radius: 8px;
    font-size: 15px; font-weight: 700; font-family: var(--lp-font-sub);
    letter-spacing: 0.06em; text-transform: uppercase;
    cursor: pointer; transition: background .15s; min-height: 48px;
  }
  .auth-dark-btn-primary:hover { background: var(--lp-lime-dim); }
  .auth-dark-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .auth-dark-btn-outline {
    width: 100%; padding: 14px;
    background: none; color: var(--lp-lime);
    border: 1.5px solid var(--lp-lime); border-radius: 8px;
    font-size: 15px; font-weight: 700; font-family: var(--lp-font-sub);
    letter-spacing: 0.06em; text-transform: uppercase;
    cursor: pointer; transition: all .15s; min-height: 48px;
  }
  .auth-dark-btn-outline:hover { background: rgba(186,255,41,0.06); }
  .auth-dark-error {
    padding: 10px 14px; border-radius: 8px; font-size: 13px;
    background: rgba(255,58,58,0.1); color: #ff8080; border: 1px solid rgba(255,58,58,0.25);
  }
  .auth-dark-success {
    padding: 10px 14px; border-radius: 8px; font-size: 13px;
    background: rgba(186,255,41,0.08); color: var(--lp-lime); border: 1px solid rgba(186,255,41,0.25);
  }

  .auth-dark-choose-sub { font-size: 13px; color: var(--lp-text2); text-align: center; }
  .auth-dark-option-list { display: flex; flex-direction: column; gap: 8px; }
  .auth-dark-option {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border: 1px solid var(--lp-border);
    border-radius: 10px; background: rgba(255,255,255,0.02);
    cursor: pointer; text-align: left;
    font-family: var(--lp-font-body); color: var(--lp-text);
    transition: all .15s; -webkit-tap-highlight-color: transparent;
  }
  .auth-dark-option:hover { border-color: var(--lp-lime); background: rgba(186,255,41,0.04); }
  .auth-dark-option-icon {
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .auth-dark-option-icon.blue { background: rgba(59,130,246,0.15); color: #3b82f6; }
  .auth-dark-option-icon.lime { background: rgba(186,255,41,0.12); color: var(--lp-lime); }
  .auth-dark-option-icon.amber { background: rgba(255,184,0,0.12); color: var(--lp-amber); }
  .auth-dark-option-body { flex: 1; }
  .auth-dark-option-body strong { display: block; font-size: 14px; font-weight: 600; }
  .auth-dark-option-body span { font-size: 12px; color: var(--lp-text3); }
  .auth-dark-back {
    background: none; border: none; color: var(--lp-text3); font-size: 13px;
    cursor: pointer; font-family: var(--lp-font-body); text-align: center; padding: 4px 0;
  }
  .auth-dark-back:hover { color: var(--lp-lime); }
  .auth-dark-flow-header { display: flex; align-items: center; gap: 10px; }
  .auth-dark-flow-header span { font-size: 15px; font-weight: 600; color: var(--lp-text); font-family: var(--lp-font-sub); text-transform: uppercase; letter-spacing: 0.04em; }
  .auth-dark-back-btn {
    width: 30px; height: 30px; border-radius: 7px;
    border: 1px solid var(--lp-border); background: rgba(255,255,255,0.03);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--lp-text2); flex-shrink: 0;
  }
  .auth-dark-back-btn:hover { border-color: var(--lp-lime); color: var(--lp-lime); }
  .auth-dark-tier-note {
    font-size: 12px; color: var(--lp-text3);
    background: rgba(255,255,255,0.03); border: 1px solid var(--lp-border);
    border-radius: 8px; padding: 10px 12px; line-height: 1.6;
  }
  .auth-dark-tier-note strong { color: var(--lp-lime); }

  /* ── STRIP ────────────────────────────────────────────────────────────── */
  .strip {
    border-top: 1px solid var(--lp-border); border-bottom: 1px solid var(--lp-border);
    background: var(--lp-bg2); padding: 24px 0; overflow: hidden;
  }
  .strip-inner {
    display: flex; gap: 60px; animation: marquee 20s linear infinite; width: max-content;
  }
  @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .strip-item {
    font-family: var(--lp-font-sub); font-size: 15px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--lp-text3);
    white-space: nowrap; display: flex; align-items: center; gap: 10px;
  }
  .strip-dot { width: 4px; height: 4px; background: var(--lp-lime); opacity: 0.5; border-radius: 50%; }

  /* ── SECTION COMMONS ──────────────────────────────────────────────────── */
  .section-eyebrow {
    font-family: var(--lp-font-sub); font-size: 13px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--lp-lime);
    margin-bottom: 14px; display: flex; align-items: center; gap: 12px;
  }
  .section-eyebrow::after { content: ''; flex: 1; max-width: 60px; height: 1px; background: var(--lp-lime); opacity: 0.4; }
  .section-title {
    font-family: var(--lp-font-head); font-size: clamp(42px, 5vw, 72px);
    line-height: 0.95; text-transform: uppercase; margin-bottom: 20px; letter-spacing: 0.01em;
  }
  .section-body { font-size: 17px; font-weight: 300; color: var(--lp-text2); max-width: 540px; line-height: 1.75; }
  .check-list { list-style: none; display: flex; flex-direction: column; gap: 14px; }
  .check-list li { display: flex; align-items: flex-start; gap: 12px; font-size: 15px; color: var(--lp-text2); }
  .check-list li::before {
    content: ''; width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px;
    background: rgba(186,255,41,0.15); border: 1px solid rgba(186,255,41,0.3); border-radius: 50%;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 8l3 3 7-6' stroke='%23BAFF29' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-size: 12px; background-position: center; background-repeat: no-repeat;
  }

  /* ── FEATURES ─────────────────────────────────────────────────────────── */
  .features-section {
    padding: 100px 80px; background: var(--lp-bg2); position: relative; overflow: hidden;
  }
  .features-section::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--lp-lime), transparent); opacity: 0.3;
  }
  .features-header { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: end; margin-bottom: 64px; }
  .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
  .feature-card {
    background: var(--lp-surface); padding: 36px 32px; position: relative; overflow: hidden;
    transition: background .3s; cursor: default;
  }
  .feature-card:hover { background: var(--lp-surface2); }
  .feature-card::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
    background: var(--lp-lime); transform: scaleX(0); transition: transform .3s; transform-origin: left;
  }
  .feature-card:hover::after { transform: scaleX(1); }
  .feature-icon {
    width: 48px; height: 48px; background: rgba(186,255,41,0.1); border-radius: 12px;
    display: flex; align-items: center; justify-content: center; margin-bottom: 20px;
    border: 1px solid rgba(186,255,41,0.15); transition: background .3s, border-color .3s;
  }
  .feature-icon :global(svg) { width: 22px; height: 22px; }
  .feature-card:hover .feature-icon { background: rgba(186,255,41,0.18); border-color: rgba(186,255,41,0.35); }
  .feature-title {
    font-family: var(--lp-font-sub); font-size: 18px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; color: var(--lp-text);
  }
  .feature-desc { font-size: 14px; color: var(--lp-text2); line-height: 1.65; }
  .feature-card.amber .feature-icon { background: rgba(255,184,0,0.1); border-color: rgba(255,184,0,0.15); }
  .feature-card.amber:hover .feature-icon { background: rgba(255,184,0,0.18); border-color: rgba(255,184,0,0.35); }
  .feature-card.amber::after { background: var(--lp-amber); }

  /* ── PITCH MAP ────────────────────────────────────────────────────────── */
  .pitch-section {
    padding: 100px 80px; display: grid; grid-template-columns: 1fr 1fr;
    gap: 80px; align-items: center; position: relative;
  }
  .pitch-mockup { position: relative; }
  .pitch-svg-wrap {
    background: var(--lp-surface); border-radius: 16px; padding: 24px;
    border: 1px solid var(--lp-border); box-shadow: 0 32px 80px rgba(0,0,0,0.4);
  }
  .pitch-svg { width: 100%; height: auto; }
  .pitch-badge {
    border-radius: 6px; padding: 6px 12px;
    font-family: var(--lp-font-sub); font-size: 11px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .pitch-badge.lime { background: rgba(186,255,41,0.1); border: 1px solid rgba(186,255,41,0.25); color: var(--lp-lime); }
  .pitch-badge.amber { background: rgba(255,184,0,0.1); border: 1px solid rgba(255,184,0,0.25); color: var(--lp-amber); }
  .pitch-badge.neutral { background: var(--lp-surface2); border: 1px solid var(--lp-border); color: var(--lp-text2); }

  /* ── OFFLINE ──────────────────────────────────────────────────────────── */
  .offline-section {
    background: var(--lp-surface); padding: 100px 80px;
    border-top: 1px solid var(--lp-border); border-bottom: 1px solid var(--lp-border);
    position: relative; overflow: hidden;
  }
  .offline-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
  .signal-bars { display: flex; align-items: flex-end; gap: 6px; margin-bottom: 24px; }
  .signal-bar { width: 12px; background: var(--lp-lime); border-radius: 2px 2px 0 0; }
  .signal-bar.off { background: var(--lp-border); }
  .offline-badge-tag {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(186,255,41,0.1); border: 1px solid rgba(186,255,41,0.25);
    border-radius: 8px; padding: 10px 18px;
    font-family: var(--lp-font-sub); font-weight: 700; font-size: 14px;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--lp-lime); margin-bottom: 32px;
  }
  .offline-visual { display: flex; flex-direction: column; gap: 16px; }
  .ground-card {
    background: var(--lp-bg2); border: 1px solid var(--lp-border); border-radius: 12px;
    padding: 20px 24px; display: flex; align-items: center; gap: 16px;
  }
  .ground-icon {
    width: 44px; height: 44px; background: rgba(186,255,41,0.1); border-radius: 10px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .ground-name { font-family: var(--lp-font-sub); font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; }
  .ground-status { font-size: 12px; color: var(--lp-text3); margin-top: 2px; }
  .ground-status span { color: var(--lp-lime); }
  .data-flow-box { margin-top: 8px; padding: 16px; background: var(--lp-bg); border-radius: 10px; border: 1px solid var(--lp-border); }
  .data-flow-label { font-family: var(--lp-font-sub); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lp-text3); margin-bottom: 10px; }
  .connectivity-vis { display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: var(--lp-bg2); border-radius: 8px; border: 1px solid var(--lp-border); }
  .signal-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--lp-lime); }
  .signal-dot.off { background: var(--lp-text3); }
  .signal-line { flex: 1; height: 1px; background: var(--lp-border); }

  /* ── STATS SHOWCASE ───────────────────────────────────────────────────── */
  .stats-showcase {
    padding: 100px 80px; text-align: center; background: var(--lp-bg);
    position: relative; overflow: hidden;
  }
  .stats-showcase::before {
    content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(186,255,41,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .big-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; margin: 64px 0; position: relative; }
  .big-stat-card { background: var(--lp-surface); padding: 40px 24px; }
  .big-stat-num { font-family: var(--lp-font-head); font-size: 72px; color: var(--lp-lime); line-height: 1; margin-bottom: 8px; }
  .big-stat-num .unit { font-size: 36px; }
  .big-stat-card:nth-child(2) .big-stat-num { color: var(--lp-amber); }
  .big-stat-card:nth-child(4) .big-stat-num { color: var(--lp-amber); }
  .big-stat-label { font-family: var(--lp-font-sub); font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--lp-text2); }

  /* ── ANALYTICS ────────────────────────────────────────────────────────── */
  .analytics-section { padding: 100px 80px; background: var(--lp-bg2); border-top: 1px solid var(--lp-border); }
  .analytics-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
  .chart-mockup { background: var(--lp-surface); border: 1px solid var(--lp-border); border-radius: 16px; padding: 24px; box-shadow: 0 24px 60px rgba(0,0,0,0.4); }
  .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .chart-title { font-family: var(--lp-font-sub); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lp-text2); }
  .chart-period { font-size: 11px; color: var(--lp-text3); font-family: var(--lp-font-sub); }
  .chart-area { height: 140px; position: relative; margin-bottom: 16px; }
  .bar-chart { width: 100%; height: 100%; }
  .chart-labels { display: flex; justify-content: space-between; }
  .chart-label { font-size: 10px; color: var(--lp-text3); font-family: var(--lp-font-sub); }
  .player-compare { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--lp-border); }
  .compare-sub { font-family: var(--lp-font-sub); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lp-text3); margin-bottom: 8px; }
  .compare-row { display: flex; align-items: center; gap: 10px; }
  .compare-name { font-size: 12px; font-family: var(--lp-font-sub); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; width: 80px; color: var(--lp-text2); }
  .compare-bar-wrap { flex: 1; height: 6px; background: var(--lp-border); border-radius: 3px; overflow: hidden; }
  .compare-bar { height: 100%; border-radius: 3px; background: var(--lp-lime); }
  .compare-bar.amber { background: var(--lp-amber); }
  .compare-val { font-size: 12px; font-family: var(--lp-font-head); color: var(--lp-lime); width: 28px; text-align: right; }
  .compare-val.amber { color: var(--lp-amber); }

  /* ── TIMELINE ─────────────────────────────────────────────────────────── */
  .timeline-section { padding: 100px 80px; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
  .timeline-mockup { background: var(--lp-surface); border: 1px solid var(--lp-border); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.4); }
  .tl-header { background: var(--lp-surface2); padding: 16px 20px; border-bottom: 1px solid var(--lp-border); font-family: var(--lp-font-sub); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lp-text2); }
  .tl-events { padding: 12px; display: flex; flex-direction: column; gap: 2px; }
  .tl-event { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; transition: background .2s; }
  .tl-event:hover { background: var(--lp-surface2); }
  .tl-sub { background: rgba(255,184,0,0.05); border-radius: 8px; }
  .tl-time { font-family: var(--lp-font-head); font-size: 16px; color: var(--lp-text3); width: 36px; flex-shrink: 0; }
  .tl-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .tl-dot.lime { background: var(--lp-lime); }
  .tl-dot.amber { background: var(--lp-amber); }
  .tl-dot.red { background: var(--lp-red); }
  .tl-dot.blue { background: #4B9EFF; }
  .tl-text { flex: 1; font-size: 13px; color: var(--lp-text); font-family: var(--lp-font-sub); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .tl-player { font-size: 11px; color: var(--lp-text3); font-family: var(--lp-font-sub); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .tl-halftime { padding: 10px 12px; text-align: center; font-family: var(--lp-font-sub); font-size: 11px; color: var(--lp-text3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; border-top: 1px solid var(--lp-border); margin-top: 4px; }

  /* ── PRICING ──────────────────────────────────────────────────────────── */
  .pricing-section {
    padding: 100px 80px; background: var(--lp-bg2);
    border-top: 1px solid var(--lp-border); position: relative; overflow: hidden;
  }
  .pricing-section::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--lp-lime), transparent); opacity: 0.3;
  }
  .pricing-header { text-align: center; margin-bottom: 64px; }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 2px;
    align-items: stretch;
  }
  .plan-card {
    background: var(--lp-surface); padding: 32px 24px;
    display: flex; flex-direction: column; gap: 0; position: relative;
    transition: background .3s;
  }
  .plan-card:hover { background: var(--lp-surface2); }
  .plan-name {
    font-family: var(--lp-font-sub); font-size: 16px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--lp-text2);
    margin-bottom: 12px;
  }
  .plan-price {
    font-family: var(--lp-font-head); font-size: 52px; line-height: 1;
    color: var(--lp-text); margin-bottom: 4px;
  }
  .plan-period { font-size: 16px; color: var(--lp-text3); }
  .plan-tagline { font-size: 13px; color: var(--lp-text3); margin-bottom: 24px; }
  .plan-features { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; flex: 1; }
  .plan-features li {
    font-size: 13px; color: var(--lp-text2);
    display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;
  }
  .plan-features li::before {
    content: ''; width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px;
    background: rgba(186,255,41,0.12); border: 1px solid rgba(186,255,41,0.25);
    border-radius: 50%;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 8l3 3 7-6' stroke='%23BAFF29' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-size: 10px; background-position: center; background-repeat: no-repeat;
  }
  .plan-feature-faded { opacity: 0.35; }
  .plan-feature-faded::before {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M5 8h6' stroke='%234A6280' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background: rgba(74,98,128,0.12); border-color: rgba(74,98,128,0.2);
  }
  .plan-btn {
    display: block; width: 100%; padding: 13px 16px; text-align: center;
    background: rgba(186,255,41,0.08); color: var(--lp-lime);
    border: 1px solid rgba(186,255,41,0.25); border-radius: 8px;
    font-family: var(--lp-font-sub); font-size: 14px; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    cursor: pointer; transition: all .2s; text-decoration: none;
  }
  .plan-btn:hover { background: rgba(186,255,41,0.14); border-color: var(--lp-lime); }

  /* Featured plan */
  .plan-featured {
    background: var(--lp-surface2);
    border-top: 2px solid var(--lp-lime) !important;
    position: relative;
  }
  .plan-badge {
    position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
    background: var(--lp-lime); color: var(--lp-bg);
    font-family: var(--lp-font-sub); font-size: 11px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 3px 12px; border-radius: 0 0 8px 8px;
  }
  .plan-featured .plan-price { color: var(--lp-lime); }
  .plan-btn-featured {
    background: var(--lp-lime); color: var(--lp-bg);
    border-color: var(--lp-lime);
  }
  .plan-btn-featured:hover { background: var(--lp-lime-dim); border-color: var(--lp-lime-dim); }

  /* Custom plan */
  .plan-custom {
    background: var(--lp-surface);
    border-left: 2px solid rgba(255,184,0,0.4);
    position: relative;
  }
  .plan-custom:hover { background: var(--lp-surface2); }
  .plan-custom-badge {
    display: inline-block; background: rgba(255,184,0,0.12);
    border: 1px solid rgba(255,184,0,0.3); color: var(--lp-amber);
    font-family: var(--lp-font-sub); font-size: 11px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 3px 10px; border-radius: 4px; margin-bottom: 12px;
  }
  .plan-custom .plan-name { color: var(--lp-amber); }
  .plan-price-custom {
    font-family: var(--lp-font-head); font-size: 36px; line-height: 1;
    color: var(--lp-amber); margin-bottom: 4px;
  }
  .plan-btn-custom {
    background: rgba(255,184,0,0.08); color: var(--lp-amber);
    border: 1px solid rgba(255,184,0,0.25);
  }
  .plan-btn-custom:hover { background: rgba(255,184,0,0.14); border-color: var(--lp-amber); }
  .plan-custom-note {
    margin-top: 16px; font-size: 12px; color: var(--lp-text3);
    line-height: 1.6; padding-top: 12px; border-top: 1px solid var(--lp-border);
  }

  /* ── CTA ──────────────────────────────────────────────────────────────── */
  .cta-section {
    background: var(--lp-surface); border-top: 1px solid var(--lp-border);
    padding: 120px 80px; text-align: center; position: relative; overflow: hidden;
  }
  .cta-section::before {
    content: ''; position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(186,255,41,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(186,255,41,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .cta-section::after {
    content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 500px; height: 400px;
    background: radial-gradient(ellipse, rgba(186,255,41,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .cta-inner { position: relative; z-index: 2; }
  .cta-tag {
    display: inline-block; background: var(--lp-lime); color: var(--lp-bg);
    font-family: var(--lp-font-sub); font-weight: 700; font-size: 12px;
    letter-spacing: 0.12em; text-transform: uppercase;
    padding: 4px 12px; border-radius: 4px; margin-bottom: 24px;
  }
  .cta-title { font-family: var(--lp-font-head); font-size: clamp(52px, 6vw, 90px); line-height: 0.92; text-transform: uppercase; margin-bottom: 20px; }
  .cta-title .lime { color: var(--lp-lime); }
  .cta-sub { font-size: 18px; font-weight: 300; color: var(--lp-text2); max-width: 480px; margin: 0 auto 44px; }
  .cta-actions { display: flex; gap: 16px; align-items: center; justify-content: center; flex-wrap: wrap; }
  .btn-large {
    font-size: 17px; padding: 18px 40px; border-radius: 10px;
    font-family: var(--lp-font-sub); font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase;
    display: inline-flex; align-items: center; gap: 10px; transition: all .2s; text-decoration: none;
  }
  .btn-large.primary { background: var(--lp-lime); color: var(--lp-bg); }
  .btn-large.primary:hover { background: var(--lp-lime-dim); transform: translateY(-2px); box-shadow: 0 12px 40px rgba(186,255,41,0.25); }
  .btn-large.ghost { border: 1px solid var(--lp-border); color: var(--lp-text2); }
  .btn-large.ghost:hover { border-color: var(--lp-text2); color: var(--lp-text); }
  .cta-note { margin-top: 20px; font-size: 13px; color: var(--lp-text3); }

  /* ── FOOTER ───────────────────────────────────────────────────────────── */
  .lp-footer {
    background: var(--lp-bg); border-top: 1px solid var(--lp-border);
    padding: 40px 80px; display: flex; align-items: center; justify-content: space-between;
  }
  .footer-logo { font-family: var(--lp-font-sub); font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
  .footer-logo span { color: var(--lp-lime); }
  .footer-copy { font-size: 13px; color: var(--lp-text3); }
  .footer-links { display: flex; gap: 28px; list-style: none; }
  .footer-links a { font-size: 13px; color: var(--lp-text3); font-family: var(--lp-font-sub); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; transition: color .2s; text-decoration: none; }
  .footer-links a:hover { color: var(--lp-lime); }

  /* ── SCROLL REVEAL ────────────────────────────────────────────────────── */
  .reveal { opacity: 0; transform: translateY(32px); transition: opacity .7s ease, transform .7s ease; }
  .reveal.in { opacity: 1; transform: translateY(0); }
  .reveal-delay-1 { transition-delay: .1s; }
  .reveal-delay-2 { transition-delay: .2s; }
  .reveal-delay-3 { transition-delay: .3s; }

  /* ── RESPONSIVE ───────────────────────────────────────────────────────── */
  @media (max-width: 1100px) {
    .pricing-grid { grid-template-columns: repeat(3, 1fr); }
    .plan-custom { grid-column: span 1; }
  }
  @media (max-width: 900px) {
    .lp-nav { padding: 0 20px; }
    .nav-links { display: none; }
    .hero { grid-template-columns: 1fr; }
    .hero-content { padding: 40px 24px 24px; }
    .hero-auth { padding: 0 24px 60px; }
    .features-section { padding: 60px 24px; }
    .features-header { grid-template-columns: 1fr; }
    .features-grid { grid-template-columns: 1fr; }
    .pitch-section { grid-template-columns: 1fr; padding: 60px 24px; }
    .offline-section { padding: 60px 24px; }
    .offline-inner { grid-template-columns: 1fr; }
    .stats-showcase { padding: 60px 24px; }
    .big-stats { grid-template-columns: repeat(2, 1fr); }
    .analytics-section { padding: 60px 24px; }
    .analytics-inner { grid-template-columns: 1fr; }
    .timeline-section { grid-template-columns: 1fr; padding: 60px 24px; }
    .pricing-section { padding: 60px 24px; }
    .pricing-grid { grid-template-columns: 1fr; }
    .cta-section { padding: 80px 24px; }
    .lp-footer { flex-direction: column; gap: 20px; padding: 32px 24px; text-align: center; }
    .footer-links { flex-wrap: wrap; justify-content: center; }
  }
</style>
