<script>
  import LpNav from './LpNav.svelte'
  import LpFooter from './LpFooter.svelte'
  import { onMount } from 'svelte'

  export let onNavigate = () => {}

  const sections = [
    { id: 'getting-started',      label: 'Getting Started' },
    { id: 'match-logging',        label: 'Match Logging' },
    { id: 'puckout-tracking',     label: 'Puckout Tracking' },
    { id: 'opposition-tracking',  label: 'Opposition Tracking' },
    { id: 'quick-view-stats',     label: 'Quick View Stats' },
    { id: 'squad-management',     label: 'Squad Management' },
    { id: 'player-stats',         label: 'Player Stats' },
    { id: 'team-stats',           label: 'Team Stats' },
    { id: 'match-history',        label: 'Match History' },
    { id: 'stat-targets',         label: 'Stat Targets' },
    { id: 'club-and-teams',       label: 'Club & Teams' },
    { id: 'sync-and-offline',     label: 'Sync & Offline' },
  ]

  let activeSection = 'getting-started'
  let sidebarOpen = false

  function scrollTo(id) {
    activeSection = id
    sidebarOpen = false
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  onMount(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) activeSection = e.target.id
      })
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 })

    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  })
</script>

<div class="lp docs-page">
  <div class="lp-noise"></div>
  <LpNav {onNavigate} currentPage="docs" />

  <div class="docs-layout">

    <!-- Sidebar -->
    <aside class="docs-sidebar" class:open={sidebarOpen}>
      <div class="sidebar-head">
        <div class="sidebar-label">User Guide</div>
      </div>
      <nav class="sidebar-nav">
        {#each sections as s}
          <button
            class="sidebar-link"
            class:active={activeSection === s.id}
            on:click={() => scrollTo(s.id)}
          >{s.label}</button>
        {/each}
      </nav>
      <div class="sidebar-footer">
        <a href="mailto:contact@gaastatsapp.com" class="sidebar-help">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Can't find something?
        </a>
      </div>
    </aside>

    <!-- Mobile sidebar toggle -->
    <button class="docs-mob-toggle" on:click={() => sidebarOpen = !sidebarOpen}>
      <div class="mob-toggle-left">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        Contents
      </div>
      <span class="mob-toggle-section">{sections.find(s => s.id === activeSection)?.label ?? ''}</span>
    </button>
    {#if sidebarOpen}
      <div class="docs-mob-overlay" on:click={() => sidebarOpen = false}></div>
      <div class="docs-mob-drawer">
        <div class="drawer-head">
          <span class="drawer-title">User Guide</span>
          <button class="drawer-close" on:click={() => sidebarOpen = false}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <nav class="drawer-nav">
          {#each sections as s}
            <button class="sidebar-link" class:active={activeSection === s.id} on:click={() => scrollTo(s.id)}>{s.label}</button>
          {/each}
        </nav>
      </div>
    {/if}

    <!-- Content -->
    <main class="docs-content">

      <!-- ── Getting Started ─────────────────────────────────────────────── -->
      <section id="getting-started" class="docs-section">
        <div class="docs-tag">Getting Started</div>
        <h1>Getting Started</h1>
        <p class="docs-lead">Everything you need to go from zero to logging your first match in under 5 minutes.</p>

        <h2>Creating an account</h2>
        <p>Visit <strong>gaastatsapp.com</strong> in any browser and tap <strong>Get Started Free</strong>. Choose your account type:</p>
        <div class="docs-steps">
          <div class="docs-step"><div class="step-num">1</div><div><strong>Personal</strong> — one coach, one team. Best if you're using this on your own.</div></div>
          <div class="docs-step"><div class="step-num">2</div><div><strong>Club</strong> — you're setting up a club and will invite other coaches via team join codes.</div></div>
          <div class="docs-step"><div class="step-num">3</div><div><strong>Join a team</strong> — you have a 6-digit code from your club owner. Enter it here.</div></div>
        </div>
        <p>After signup you'll receive a confirmation email. Click the link, then sign back in.</p>

        <h2>Installing as a PWA</h2>
        <p>GAA Stats App is a Progressive Web App — you install it directly from the browser, no App Store required.</p>
        <div class="docs-steps">
          <div class="docs-step"><div class="step-num">1</div><div><strong>iOS (Safari):</strong> tap the Share button → "Add to Home Screen"</div></div>
          <div class="docs-step"><div class="step-num">2</div><div><strong>Android (Chrome):</strong> tap the three-dot menu → "Add to Home screen" or "Install app"</div></div>
          <div class="docs-step"><div class="step-num">3</div><div>The app installs instantly and opens in full-screen mode with no browser bar</div></div>
        </div>
        <div class="docs-tip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Tip:</strong> Install the app before heading to a ground. Once installed, it works completely offline — no signal needed.</span>
        </div>
      </section>

      <!-- ── Match Logging ───────────────────────────────────────────────── -->
      <section id="match-logging" class="docs-section">
        <div class="docs-tag">Core Feature</div>
        <h1>Match Logging</h1>
        <p class="docs-lead">The heart of the app. Log every stat in real time, one-handed, on the sideline.</p>

        <h2>Starting a match</h2>
        <p>Tap <strong>Match</strong> in the nav bar. Fill in the match setup screen:</p>
        <ul class="docs-list">
          <li><strong>Opposition</strong> — the team you're playing</li>
          <li><strong>Venue</strong> — optional, can be hidden in Settings</li>
          <li><strong>Competition</strong> — optional (e.g. County Championship)</li>
          <li><strong>Starting period</strong> — defaults to 1st Half</li>
        </ul>
        <p>Tap <strong>Start Match</strong>. Your squad lineup is auto-populated from jersey numbers — no extra setup needed.</p>

        <h2>Logging stats</h2>
        <p>Two modes are available — toggle between them during the match:</p>
        <div class="docs-two-col">
          <div class="docs-card">
            <div class="docs-card-title">Player Rows Mode</div>
            <p>Every player in your squad appears as a row. Tap their name, then tap a stat button. Best when you need to track exactly who did what.</p>
          </div>
          <div class="docs-card">
            <div class="docs-card-title">Quick Mode</div>
            <p>Stat buttons only — no player selection. Tap to increment the total count. Best for high-tempo moments when you don't have time to select a player.</p>
          </div>
        </div>

        <h2>The action bar</h2>
        <p>At the bottom of the match screen, three buttons give you quick access to the most important tracking actions:</p>
        <ul class="docs-list">
          <li><strong>Puckout</strong> — log a puckout won or lost, with zone and player</li>
          <li><strong>Opp Score</strong> — log an opposition goal or point, with marker assignment</li>
          <li><strong>Sub</strong> — record a substitution</li>
        </ul>

        <h2>Timer</h2>
        <p>The timer uses the device's real clock, not a counter. If you close the app mid-match, the timer picks up where it left off — accurate to the second — even if the device was off for 20 minutes.</p>

        <h2>Saving a match</h2>
        <p>Tap <strong>End Match</strong> to save. Every match is also auto-saved as a draft every few seconds — if the app closes unexpectedly, your data is safe. On next open the draft resumes silently.</p>

        <div class="docs-tip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Tip:</strong> Custom stats can be added during a live match from the stats setup — you're not locked into the default list.</span>
        </div>
      </section>

      <!-- ── Puckout Tracking ────────────────────────────────────────────── -->
      <section id="puckout-tracking" class="docs-section">
        <div class="docs-tag">Core Feature</div>
        <h1>Puckout Tracking</h1>
        <p class="docs-lead">The most detailed puckout analysis available for GAA coaches. Zone-based, player-linked, and visible live.</p>

        <h2>Logging a puckout</h2>
        <p>Tap <strong>Puckout</strong> in the action bar. For each puckout you record:</p>
        <ul class="docs-list">
          <li><strong>Outcome</strong> — Won or Lost</li>
          <li><strong>Our player</strong> — which DB player received (won) or was being marked (lost)</li>
          <li><strong>Opposition player</strong> — jersey number of the player who won it (if lost)</li>
          <li><strong>Zone</strong> — where on the pitch the puckout landed (10-zone map)</li>
        </ul>

        <h2>The zone picker</h2>
        <p>The pitch is divided into a 10-zone grid: 5 columns (Short → Own Half → Midfield → Opp Half → Long) × 2 rows (Top/Bottom). Tap the zone where the puckout landed. Each zone shows its win rate live.</p>

        <h2>Viewing puckout analysis</h2>
        <p>During the match, tap <strong>Stats</strong> to open Quick View Stats. The Puckouts accordion shows:</p>
        <ul class="docs-list">
          <li>Total win/loss count and percentage</li>
          <li>Zone heatmap — green ≥67%, amber 40–66%, red &lt;40%</li>
          <li>Per-player breakdown with "Won vs #7" / "Lost to #5" matchup lines</li>
          <li>Opposition player breakdown — who's winning the most and who was marking them</li>
        </ul>
        <p>Tap any zone on the heatmap to filter the breakdown table to that zone only.</p>
      </section>

      <!-- ── Opposition Tracking ────────────────────────────────────────── -->
      <section id="opposition-tracking" class="docs-section">
        <div class="docs-tag">Core Feature</div>
        <h1>Opposition Tracking</h1>
        <p class="docs-lead">Know who's scoring against you and who was supposed to be marking them.</p>

        <h2>Logging an opposition score</h2>
        <p>Tap <strong>Opp Score</strong> in the action bar. Record:</p>
        <ul class="docs-list">
          <li><strong>Type</strong> — Goal or Point</li>
          <li><strong>Opposition player</strong> — their jersey number</li>
          <li><strong>Our marker</strong> — which of your players was marking them</li>
        </ul>

        <h2>Viewing conceded stats</h2>
        <p>In Quick View Stats, the <strong>Scores Conceded</strong> accordion shows:</p>
        <ul class="docs-list">
          <li>Total goals and points conceded</li>
          <li>Breakdown by your marker — who conceded the most</li>
          <li>Breakdown by opposition player — which of their players is most dangerous</li>
          <li>Standout callout highlighting the biggest threat</li>
        </ul>
        <p>The same breakdown is available in Match History for post-match analysis.</p>
      </section>

      <!-- ── Quick View Stats ────────────────────────────────────────────── -->
      <section id="quick-view-stats" class="docs-section">
        <div class="docs-tag">In-Match Feature</div>
        <h1>Quick View Stats</h1>
        <p class="docs-lead">A live analytics panel available at any moment during the match — without leaving the logging screen.</p>

        <h2>Opening Quick View</h2>
        <p>Tap the <strong>Stats</strong> button in the action bar. The match timer keeps running. Tap Stats again (or the back arrow) to return to logging.</p>

        <h2>The four accordions</h2>
        <div class="docs-table-wrap">
          <table class="docs-table">
            <thead><tr><th>Panel</th><th>What it shows</th></tr></thead>
            <tbody>
              <tr><td><strong>Puckouts</strong></td><td>Win/loss %, zone heatmap, per-player breakdowns, matchup lines</td></tr>
              <tr><td><strong>Scores Conceded</strong></td><td>Goals/points totals, by marker, by opposition player</td></tr>
              <tr><td><strong>Player Stats</strong></td><td>Full stats table for every player with at least one stat</td></tr>
              <tr><td><strong>Substitutions</strong></td><td>Full sub log with match times</td></tr>
            </tbody>
          </table>
        </div>
        <p>Each accordion header shows a summary badge so you can scan at a glance without opening. Each section highlights a <strong>standout callout</strong> — the most notable number to know right now.</p>
      </section>

      <!-- ── Squad Management ────────────────────────────────────────────── -->
      <section id="squad-management" class="docs-section">
        <div class="docs-tag">Core Feature</div>
        <h1>Squad Management</h1>
        <p class="docs-lead">Your squad persists between every match. Set it up once and you're ready to go.</p>

        <h2>List view</h2>
        <p>Each player has a <strong>name</strong>, <strong>jersey number</strong>, and <strong>position</strong>. The list is divided into Starters (numbers 1–15) and Subs (everyone else). Edit any player inline — changes save automatically.</p>

        <h2>Pitch view</h2>
        <p>A visual GAA formation with 15 position slots. Tap any slot to assign a player:</p>
        <div class="docs-steps">
          <div class="docs-step"><div class="step-num">1</div><div>Tap a slot — a modal shows all your players</div></div>
          <div class="docs-step"><div class="step-num">2</div><div>Tap a player to assign them. If they were already in another slot, they swap positions with the displaced player</div></div>
          <div class="docs-step"><div class="step-num">3</div><div>Tap "New player" at the bottom to add and assign in one step</div></div>
        </div>

        <div class="docs-tip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Tip:</strong> Players are identified by <strong>name</strong>, not jersey number. Numbers can change week to week — the player identity never changes.</span>
        </div>

        <h2>Lineup and PDF export</h2>
        <p>When you start a match, the app silently builds a lineup from squad jersey numbers. This lineup is saved with the match and used in the PDF match report — no extra steps needed.</p>
      </section>

      <!-- ── Player Stats ────────────────────────────────────────────────── -->
      <section id="player-stats" class="docs-section">
        <div class="docs-tag">Pro Feature</div>
        <h1>Player Stats</h1>
        <p class="docs-lead">Deep per-player analytics across your entire match history. Requires Personal Pro or higher.</p>

        <h2>What you'll see</h2>
        <ul class="docs-list">
          <li><strong>Season totals</strong> — every stat accumulated across all logged matches</li>
          <li><strong>Trend chart</strong> — how each stat has changed match by match (Chart.js line chart)</li>
          <li><strong>Per-match table</strong> — every match listed with the player's stat line</li>
          <li><strong>Compare mode</strong> — put two players side by side across any stat</li>
        </ul>
        <p>Players are listed from your saved squad. Any player with at least one stat in any match will appear in the breakdown.</p>
      </section>

      <!-- ── Team Stats ──────────────────────────────────────────────────── -->
      <section id="team-stats" class="docs-section">
        <div class="docs-tag">Pro Feature</div>
        <h1>Team Stats</h1>
        <p class="docs-lead">Visualise where your team is winning and losing on the pitch. Requires Personal Pro or higher.</p>

        <h2>Pitch map</h2>
        <p>An overhead view of the GAA pitch with every logged stat event plotted as a dot. Filter by:</p>
        <ul class="docs-list">
          <li><strong>Stat type</strong> — Points, Goals, Wides, Tackles, or any stat</li>
          <li><strong>Period</strong> — 1st Half, 2nd Half, or specific periods</li>
          <li><strong>Player</strong> — show one player's events only</li>
        </ul>

        <h2>Top performers</h2>
        <p>Below the pitch map, a leaderboard shows your top players for each stat category, ranked by total count across all filtered matches.</p>
      </section>

      <!-- ── Match History ────────────────────────────────────────────────── -->
      <section id="match-history" class="docs-section">
        <div class="docs-tag">Core Feature</div>
        <h1>Match History</h1>
        <p class="docs-lead">Every saved match in one place. Free plan stores the last 3 — Pro keeps everything.</p>

        <h2>Browsing matches</h2>
        <p>Matches are listed newest first. Use the search bar to find by opposition name, or filter by competition, venue, or result. Each card shows the final score and key stats.</p>

        <h2>Match detail view</h2>
        <p>Tap any match to open the full detail view. Tabs include:</p>
        <ul class="docs-list">
          <li>Score and match summary</li>
          <li>Player stats table</li>
          <li>Puckout analysis (zone heatmap + matchup lines)</li>
          <li>Scores conceded (by marker + by opposition player)</li>
          <li>Substitutions log</li>
        </ul>

        <h2>PDF export</h2>
        <p>Tap <strong>Export PDF</strong> in the detail view. The app generates a print-ready sheet using your browser's built-in print dialog — includes score, lineup, player stats, puckout and conceded sections. Works offline.</p>
      </section>

      <!-- ── Stat Targets ────────────────────────────────────────────────── -->
      <section id="stat-targets" class="docs-section">
        <div class="docs-tag">Pro Feature</div>
        <h1>Stat Targets</h1>
        <p class="docs-lead">Set performance goals for each stat and track your team's progress over time. Requires Personal Pro or higher.</p>

        <h2>Setting a target</h2>
        <p>Tap <strong>Targets</strong> in the nav. For each stat, set a target number — e.g. "Points: 12" or "Puckouts Won: 70%". Targets apply to the whole team across all future matches.</p>

        <h2>Tracking progress</h2>
        <p>Each target card shows:</p>
        <ul class="docs-list">
          <li>The target value and the average over recent matches</li>
          <li>A progress indicator — green when you're meeting the target, amber when close, red when below</li>
          <li>A trend line showing the last 5 matches</li>
        </ul>
      </section>

      <!-- ── Club & Teams ────────────────────────────────────────────────── -->
      <section id="club-and-teams" class="docs-section">
        <div class="docs-tag">Club Feature</div>
        <h1>Club &amp; Teams</h1>
        <p class="docs-lead">Manage your whole club from one account. Requires Club or Club Pro plan.</p>

        <h2>Creating a club</h2>
        <p>When you sign up and choose the "Club" account type, you become the club owner. Your first step is the Team Setup screen — create at least one team to enter the app.</p>

        <h2>Creating teams</h2>
        <p>In Settings → Club Teams, tap <strong>Add team</strong>. Each team gets a unique 6-digit join code. Share this code with coaches via WhatsApp directly from the app.</p>

        <h2>Coaches joining</h2>
        <p>Coaches sign up with a free account and enter the team code when prompted. Their account becomes linked to your club's subscription — they get Pro features at no extra cost.</p>

        <h2>Multi-team coaches</h2>
        <p>A coach can be on multiple teams. They join additional teams via Settings → My Teams → enter a new code. On login, coaches with multiple teams are prompted to pick which team context to use — or they can set "Remember last team" to skip the picker.</p>

        <div class="docs-tip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Important:</strong> Each coach's match data is private to their account — only they can see their own matches and squad. The club owner manages teams and codes, but cannot read coaches' data.</span>
        </div>
      </section>

      <!-- ── Sync & Offline ──────────────────────────────────────────────── -->
      <section id="sync-and-offline" class="docs-section">
        <div class="docs-tag">Infrastructure</div>
        <h1>Sync &amp; Offline</h1>
        <p class="docs-lead">Built for zero signal. Your data is always safe, always local, and always in sync when you're online.</p>

        <h2>How offline works</h2>
        <p>All match data and squad information is stored in <strong>IndexedDB</strong> — the browser's built-in local database. Nothing requires a network connection to read or write data. The app installs all its assets during setup so even the app itself loads without internet.</p>

        <h2>Auto-sync</h2>
        <p>After every match is saved, the app waits 10 seconds and then automatically syncs to Supabase (cloud). If you're offline, it will sync the next time you have a connection. You'll see a "Synced!" confirmation in the nav bar.</p>

        <h2>Manual sync</h2>
        <p>Tap <strong>↑ Sync</strong> in the nav bar at any time to force a sync. Always sync before signing out — if you switch devices or reinstall, the cloud copy is what gets restored.</p>

        <h2>Signing in on a new device</h2>
        <p>Sign in with the same credentials. The app automatically pulls your data from Supabase on first login — your full match history and squad will be available within seconds.</p>

        <div class="docs-tip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
          <span><strong>Always sync before signing out.</strong> Unsynced data lives only on the device. Sign out without syncing = that data is gone.</span>
        </div>
      </section>

    </main>
  </div>

  <LpFooter {onNavigate} />
</div>

<style>
  .docs-page { font-family: var(--lp-font-body); overflow-x: hidden; width: 100%; }
  .lp-noise {
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px; pointer-events: none; z-index: 9999; opacity: 0.6;
  }

  .docs-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: 100vh;
    padding-top: 68px;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ── Sidebar ─────────────────────────────────────────────────────────── */
  .docs-sidebar {
    position: sticky; top: 68px; height: calc(100vh - 68px);
    overflow-y: auto; padding: 32px 0;
    border-right: 1px solid var(--lp-border);
    display: flex; flex-direction: column;
  }
  .sidebar-head { padding: 0 20px 16px; border-bottom: 1px solid var(--lp-border); margin-bottom: 12px; }
  .sidebar-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lp-text3); }
  .sidebar-nav { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 0 8px; }
  .sidebar-link {
    background: none; border: none; cursor: pointer;
    font-family: var(--lp-font-body); font-size: 14px; color: var(--lp-text3);
    text-align: left; padding: 10px 12px; border-radius: 8px; width: 100%;
    min-height: 44px; display: flex; align-items: center;
    transition: background 0.12s, color 0.12s;
  }
  .sidebar-link:hover { background: rgba(255,255,255,0.05); color: var(--lp-text2); }
  .sidebar-link.active { background: rgba(186,255,41,0.1); color: var(--lp-lime); font-weight: 600; }
  .sidebar-footer { padding: 16px 20px 0; border-top: 1px solid var(--lp-border); margin-top: 12px; }
  .sidebar-help {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--lp-text3); text-decoration: none;
    transition: color 0.15s; min-height: 44px;
  }
  .sidebar-help:hover { color: var(--lp-lime); }

  /* ── Mobile toggle bar ───────────────────────────────────────────────── */
  .docs-mob-toggle {
    display: none; position: sticky; top: 68px; z-index: 50;
    width: 100%; padding: 0 20px; height: 52px;
    background: rgba(10,17,32,0.95);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border: none; border-bottom: 1px solid var(--lp-border);
    font-family: var(--lp-font-body); cursor: pointer;
    align-items: center; justify-content: space-between; gap: 8px;
  }
  .mob-toggle-left {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 600; color: var(--lp-text2);
  }
  .mob-toggle-section {
    font-size: 13px; font-weight: 600; color: var(--lp-lime);
    max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* ── Mobile drawer (slide-in from left) ─────────────────────────────── */
  .docs-mob-overlay {
    position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.6);
    backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
  }
  .docs-mob-drawer {
    position: fixed; top: 68px; left: 0; bottom: 0; z-index: 70;
    width: 280px; max-width: 85vw;
    background: #0A1120; border-right: 1px solid var(--lp-border);
    display: flex; flex-direction: column;
    animation: drawerIn 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    overflow-y: auto;
  }
  @keyframes drawerIn {
    from { transform: translateX(-100%); opacity: 0.5; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  .drawer-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 16px; border-bottom: 1px solid var(--lp-border);
    flex-shrink: 0; min-height: 56px;
  }
  .drawer-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--lp-text3); }
  .drawer-close {
    background: none; border: none; color: var(--lp-text3); cursor: pointer;
    padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
    transition: background 0.12s, color 0.12s;
  }
  .drawer-close:hover { background: rgba(255,255,255,0.06); color: var(--lp-text); }
  .drawer-nav { padding: 8px; display: flex; flex-direction: column; gap: 2px; }

  /* ── Content ─────────────────────────────────────────────────────────── */
  .docs-content { padding: 48px 60px 80px; max-width: 760px; }

  .docs-section {
    margin-bottom: 80px; padding-bottom: 80px;
    border-bottom: 1px solid var(--lp-border);
    scroll-margin-top: 120px;
  }
  .docs-section:last-child { border-bottom: none; margin-bottom: 0; }

  .docs-tag {
    display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--lp-lime); background: rgba(186,255,41,0.1);
    border: 1px solid rgba(186,255,41,0.2); padding: 3px 10px; border-radius: 20px;
    margin-bottom: 14px;
  }
  .docs-section h1 { font-size: 32px; font-weight: 800; color: var(--lp-text); margin-bottom: 12px; letter-spacing: -0.02em; }
  .docs-section h2 { font-size: 18px; font-weight: 700; color: var(--lp-text); margin: 28px 0 10px; }
  .docs-lead { font-size: 17px; color: var(--lp-text2); line-height: 1.7; margin-bottom: 24px; }
  .docs-section p { font-size: 15px; color: var(--lp-text2); line-height: 1.7; margin-bottom: 14px; }

  .docs-steps { display: flex; flex-direction: column; gap: 12px; margin: 16px 0; }
  .docs-step { display: flex; align-items: flex-start; gap: 14px; }
  .step-num {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    background: rgba(186,255,41,0.12); border: 1px solid rgba(186,255,41,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 800; color: var(--lp-lime);
  }
  .docs-step div { font-size: 15px; color: var(--lp-text2); line-height: 1.6; padding-top: 4px; }

  .docs-list { padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
  .docs-list li { font-size: 15px; color: var(--lp-text2); line-height: 1.6; padding-left: 20px; position: relative; }
  .docs-list li::before { content: '·'; position: absolute; left: 6px; color: var(--lp-lime); font-size: 18px; line-height: 1.4; }

  .docs-tip {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 14px 16px; border-radius: 10px; margin: 20px 0;
    background: rgba(186,255,41,0.06); border: 1px solid rgba(186,255,41,0.15);
    font-size: 14px; color: var(--lp-text2); line-height: 1.6;
  }
  .docs-tip svg { flex-shrink: 0; color: var(--lp-lime); margin-top: 1px; }
  .docs-tip span { flex: 1; min-width: 0; }

  .docs-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .docs-card {
    padding: 18px; border-radius: 12px;
    background: var(--lp-surface); border: 1px solid var(--lp-border);
  }
  .docs-card-title { font-size: 14px; font-weight: 700; color: var(--lp-text); margin-bottom: 8px; }
  .docs-card p { font-size: 13px; color: var(--lp-text3); line-height: 1.6; margin: 0; }

  .docs-table-wrap { margin: 16px 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--lp-border); }
  .docs-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .docs-table th { background: var(--lp-surface2); padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: var(--lp-text3); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--lp-border); }
  .docs-table td { padding: 11px 14px; border-bottom: 1px solid rgba(26,40,64,0.4); color: var(--lp-text2); }
  .docs-table tr:last-child td { border-bottom: none; }

  /* ── Tablet (≤1100px) ────────────────────────────────────────────────── */
  @media (max-width: 1100px) {
    .docs-layout { grid-template-columns: 210px minmax(0, 1fr); }
    .docs-content { padding: 40px 36px 60px; min-width: 0; }
  }

  /* ── Mobile (≤900px) ─────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .docs-layout { grid-template-columns: minmax(0, 1fr); padding-top: 68px; width: 100%; max-width: 100vw; }
    .docs-sidebar { display: none; }
    .docs-mob-toggle { display: flex; max-width: 100vw; }
    .docs-content {
      padding: 24px 16px 60px;
      max-width: 100%;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .docs-two-col { grid-template-columns: 1fr; }
    .docs-section { margin-bottom: 56px; padding-bottom: 56px; scroll-margin-top: 136px; }
    .docs-section h1 { font-size: 26px; }
    .docs-section h2 { font-size: 17px; margin: 22px 0 8px; }
    .docs-lead { font-size: 15px; margin-bottom: 18px; }
    .docs-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 8px; }
    .docs-table { min-width: 480px; }
    .docs-tip { font-size: 13px; }
    .docs-step div { font-size: 14px; }
    .docs-list li { font-size: 14px; }
  }
</style>
