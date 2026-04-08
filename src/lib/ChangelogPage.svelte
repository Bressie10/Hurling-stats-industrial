<script>
  import LpNav from './LpNav.svelte'
  import LpFooter from './LpFooter.svelte'
  import { onMount } from 'svelte'

  export let onNavigate = () => {}

  const entries = [
    {
      version: 'v1.8', date: 'April 2026', label: 'Latest',
      items: [
        { type: 'new',      text: 'Two-tier role model — club owners and multi-team coaches now supported' },
        { type: 'new',      text: 'Team Picker — coaches with multiple teams prompted to choose on login' },
        { type: 'new',      text: 'Join another team from Settings without creating a new account' },
        { type: 'new',      text: '"Remember last team" setting to skip the picker on subsequent logins' },
        { type: 'improved', text: 'Club owners now have implicit access to all teams — no manual assignment needed' },
        { type: 'improved', text: 'Live session visibility updated to use new team_members table' },
      ]
    },
    {
      version: 'v1.7', date: 'March 2026', label: null,
      items: [
        { type: 'new',      text: 'Stripe subscription payments — Personal Pro, Club, Club Pro plans live' },
        { type: 'new',      text: 'Stripe Customer Portal — manage billing, update card, cancel from Settings' },
        { type: 'new',      text: 'Club Pro plan — Live Match Sharing now behind a paywall' },
        { type: 'improved', text: 'Post-payment webhook polling — UI updates within seconds of completing checkout' },
        { type: 'fixed',    text: 'Subscription state correctly reflected after cancellation and re-subscribe' },
      ]
    },
    {
      version: 'v1.6', date: 'February 2026', label: null,
      items: [
        { type: 'new',      text: 'Sub-teams — club owners can create up to 4 teams with shareable join codes' },
        { type: 'new',      text: 'Team Setup wizard shown to new club owners before entering the app' },
        { type: 'new',      text: 'WhatsApp share button for team join codes' },
        { type: 'new',      text: 'Club colour picker — 8 GAA county presets + custom hex input' },
        { type: 'improved', text: 'All brand colours now driven by CSS custom properties — club colour applies everywhere' },
        { type: 'improved', text: 'Dark mode removed — app is light-only for consistency' },
      ]
    },
    {
      version: 'v1.5', date: 'January 2026', label: null,
      items: [
        { type: 'new',      text: 'Landing page — full marketing site for non-authenticated web visitors' },
        { type: 'new',      text: 'Pricing section — 5 plan cards (Free, Personal Pro, Club, Club Pro, Custom)' },
        { type: 'new',      text: 'Squad Pitch View — visual GAA formation with 15 position slots' },
        { type: 'new',      text: 'Tap-to-assign player slots with inline new player creation' },
        { type: 'new',      text: 'Lineup auto-populated from squad jersey numbers when a match starts' },
        { type: 'improved', text: 'All emoji replaced with inline SVG icons throughout the app' },
      ]
    },
    {
      version: 'v1.4', date: 'December 2025', label: null,
      items: [
        { type: 'new',      text: 'Live Match Sharing (Club Pro) — broadcast live data to backroom staff' },
        { type: 'new',      text: 'Live Viewer mode — real-time score, stats, and puckout breakdown for observers' },
        { type: 'new',      text: 'Supabase Auth + cloud sync — multi-account, fully isolated per coach' },
        { type: 'new',      text: 'Sign in / sign up flow with email confirmation' },
        { type: 'improved', text: 'clearAllData() on login prevents data bleeding between coach accounts' },
      ]
    },
    {
      version: 'v1.3', date: 'November 2025', label: null,
      items: [
        { type: 'new',      text: 'Quick View Stats panel — live accordion analytics accessible mid-match' },
        { type: 'new',      text: 'Puckout zone picker — 10-zone pitch map (5 cols × 2 rows)' },
        { type: 'new',      text: 'Opposition player tracking on lost puckouts — matchup lines in breakdown' },
        { type: 'new',      text: 'Marking matchup lines — "Won vs #7" and "Lost to #5" per player' },
        { type: 'new',      text: 'Zone heatmap — green/amber/red by win rate threshold' },
        { type: 'improved', text: 'Puckout breakdown filters to selected zone on heatmap tap' },
      ]
    },
    {
      version: 'v1.2', date: 'October 2025', label: null,
      items: [
        { type: 'new',      text: 'Player Stats page — per-player charts, trend view, season totals, compare mode' },
        { type: 'new',      text: 'Team Stats page — pitch map with stat + period filters' },
        { type: 'new',      text: 'Match Timeline — chronological event feed with SVG icons' },
        { type: 'new',      text: 'Stat Targets — set and track goals per stat' },
        { type: 'new',      text: 'Settings rework — auto-save on change, per-stat tracking toggles, period management' },
        { type: 'new',      text: 'PDF match report export via window.print() with print CSS' },
      ]
    },
    {
      version: 'v1.1', date: 'September 2025', label: null,
      items: [
        { type: 'new',      text: 'Puckout tracking — log every puckout as won/lost with player and zone' },
        { type: 'new',      text: 'Opposition score tracker — goal/point, opp player number, our marker' },
        { type: 'new',      text: 'Substitution tracker with timestamps and log' },
        { type: 'new',      text: 'Cancel match button — discards draft and returns to setup' },
        { type: 'new',      text: 'Match history with search, filter, detail view, and delete' },
        { type: 'improved', text: 'Timer uses wall-clock (Date.now()) — stays accurate after app close' },
      ]
    },
    {
      version: 'v1.0', date: 'August 2025', label: 'Initial Release',
      items: [
        { type: 'new', text: 'Match logging — live stats, player rows mode, quick mode' },
        { type: 'new', text: 'Timer with period support (1st Half, 2nd Half, Extra Time)' },
        { type: 'new', text: 'Custom stats per match' },
        { type: 'new', text: 'Squad management — add players, jersey numbers, positions' },
        { type: 'new', text: 'Draft auto-save — match survives app close, resumes silently on reopen' },
        { type: 'new', text: 'PWA install — manifest.json + service worker, cache-first offline' },
        { type: 'new', text: 'Pitch coordinate picker — log where each stat happened on the pitch' },
      ]
    },
  ]

  const typeLabel = { new: 'New', improved: 'Improved', fixed: 'Fixed' }

  onMount(() => {
    const els = document.querySelectorAll('.changelog-page .entry')
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
    }, { threshold: 0.05 })
    els.forEach(el => io.observe(el))
    setTimeout(() => els.forEach(el => el.classList.add('in')), 1500)
    return () => io.disconnect()
  })
</script>

<div class="lp changelog-page">
  <div class="lp-noise"></div>
  <LpNav {onNavigate} currentPage="changelog" />

  <div class="cl-wrap">
    <div class="cl-header">
      <div class="cl-eyebrow">Changelog</div>
      <h1 class="cl-title">What's new</h1>
      <p class="cl-sub">Every update, improvement, and fix — newest first.</p>
    </div>

    <div class="cl-timeline">
      {#each entries as entry}
        <div class="entry">
          <div class="entry-meta">
            <div class="entry-version">{entry.version}</div>
            <div class="entry-date">{entry.date}</div>
            {#if entry.label}
              <div class="entry-label">{entry.label}</div>
            {/if}
          </div>
          <div class="entry-dot"></div>
          <div class="entry-content">
            <ul class="entry-items">
              {#each entry.items as item}
                <li class="entry-item">
                  <span class="entry-tag entry-tag-{item.type}">{typeLabel[item.type]}</span>
                  <span class="entry-text">{item.text}</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <LpFooter {onNavigate} />
</div>

<style>
  .changelog-page { font-family: var(--lp-font-body); }
  .lp-noise {
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px; pointer-events: none; z-index: 9999; opacity: 0.6;
  }

  .cl-wrap { padding-top: 68px; max-width: 800px; margin: 0 auto; padding-left: 40px; padding-right: 40px; }

  .cl-header { padding: 80px 0 60px; }
  .cl-eyebrow {
    display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--lp-lime); background: rgba(186,255,41,0.1);
    border: 1px solid rgba(186,255,41,0.2); padding: 5px 14px; border-radius: 20px; margin-bottom: 20px;
  }
  .cl-title { font-family: var(--lp-font-head); font-size: clamp(48px, 7vw, 72px); line-height: 1; color: var(--lp-text); margin-bottom: 16px; letter-spacing: 0.01em; }
  .cl-sub { font-size: 18px; color: var(--lp-text2); }

  /* Timeline */
  .cl-timeline { position: relative; padding-bottom: 80px; }
  .cl-timeline::before {
    content: ''; position: absolute; left: 120px; top: 0; bottom: 0; width: 1px;
    background: linear-gradient(to bottom, var(--lp-border), transparent);
  }

  .entry {
    display: grid; grid-template-columns: 120px 1px 1fr;
    gap: 0 32px; margin-bottom: 56px; align-items: start;
    transform: translateY(16px); transition: transform 0.5s ease;
  }
  .entry.in { transform: none; }

  .entry-meta { padding-top: 4px; }
  .entry-version { font-family: var(--lp-font-head); font-size: 22px; color: var(--lp-text); letter-spacing: 0.04em; }
  .entry-date { font-size: 12px; color: var(--lp-text3); margin-top: 2px; }
  .entry-label {
    display: inline-block; margin-top: 6px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    padding: 3px 8px; border-radius: 10px;
    background: rgba(186,255,41,0.12); color: var(--lp-lime); border: 1px solid rgba(186,255,41,0.2);
  }

  .entry-dot {
    width: 9px; height: 9px; border-radius: 50%;
    background: var(--lp-lime); margin-top: 7px;
    box-shadow: 0 0 0 3px rgba(186,255,41,0.15);
    position: relative; left: -4px;
  }

  .entry-content { padding-bottom: 8px; }
  .entry-items { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .entry-item { display: flex; align-items: flex-start; gap: 10px; }
  .entry-tag {
    flex-shrink: 0; font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; padding: 3px 8px; border-radius: 6px; margin-top: 1px;
  }
  .entry-tag-new      { background: rgba(186,255,41,0.12); color: var(--lp-lime); }
  .entry-tag-improved { background: rgba(255,184,0,0.12);  color: var(--lp-amber); }
  .entry-tag-fixed    { background: rgba(96,165,250,0.12); color: #60A5FA; }
  .entry-text { font-size: 14px; color: var(--lp-text2); line-height: 1.6; }

  @media (max-width: 700px) {
    .cl-wrap { padding-left: 20px; padding-right: 20px; }
    .cl-timeline::before { left: 0; }
    .entry { grid-template-columns: 0 1px 1fr; gap: 0 20px; }
    .entry-meta { display: none; }
    .entry-version-mob {
      font-family: var(--lp-font-head); font-size: 16px; color: var(--lp-lime);
      margin-bottom: 10px; display: block;
    }
  }
</style>
