<script>
  import LpNav from './LpNav.svelte'
  import LpFooter from './LpFooter.svelte'
  import { onMount } from 'svelte'

  export let onNavigate = () => {}

  function goSignup(mode) {
    onNavigate('home')
    setTimeout(() => {
      document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  const plans = [
    {
      name: 'Free', price: '€0', period: '/month', tagline: 'Get started today',
      highlight: false, badge: null,
      features: ['1 coach · 1 team', 'Full match logging', 'Puckout & opp. tracking', 'Squad management', '3 matches in history', '100% offline', 'Cloud sync & backup'],
      cta: 'Get Started Free', action: () => goSignup('personal')
    },
    {
      name: 'Personal Pro', price: '€7.99', period: '/month', tagline: 'Full analytics for one coach',
      highlight: true, badge: 'Most Popular',
      features: ['1 coach · 1 team', 'Full match logging', 'Puckout & opp. tracking', 'Squad management', 'Unlimited match history', 'Player Stats & charts', 'Team Stats & pitch map', 'Match Timeline', 'Stat Targets', 'PDF match reports', '100% offline', 'Cloud sync & backup'],
      cta: 'Start Personal Pro', action: () => goSignup('personal')
    },
    {
      name: 'Club', price: '€15', period: '/month', tagline: 'Multiple teams, one club',
      highlight: false, badge: null,
      features: ['Unlimited coaches', 'Up to 4 teams', 'Team join codes', 'Club management dashboard', 'Everything in Personal Pro'],
      cta: 'Set Up My Club', action: () => goSignup('club')
    },
    {
      name: 'Club Pro', price: '€25', period: '/month', tagline: 'Everything, for serious clubs',
      highlight: false, badge: null,
      features: ['Live match sharing', 'Live viewer mode', 'Priority support', 'Early access to features', 'Everything in Club'],
      cta: 'Set Up Club Pro', action: () => goSignup('club')
    },
  ]

  // Feature comparison table
  const tableGroups = [
    {
      label: 'Core Features',
      rows: [
        { label: 'Match logging', vals: [true, true, true, true] },
        { label: 'Puckout tracking', vals: [true, true, true, true] },
        { label: 'Opposition score tracking', vals: [true, true, true, true] },
        { label: 'Squad management', vals: [true, true, true, true] },
        { label: '100% offline mode', vals: [true, true, true, true] },
        { label: 'Cloud sync & backup', vals: [true, true, true, true] },
        { label: 'Custom stats', vals: [true, true, true, true] },
        { label: 'PWA (install to home screen)', vals: [true, true, true, true] },
      ]
    },
    {
      label: 'Analytics & History',
      rows: [
        { label: 'Match history', vals: ['3 matches', 'Unlimited', 'Unlimited', 'Unlimited'] },
        { label: 'Player Stats & trend charts', vals: [false, true, true, true] },
        { label: 'Team Stats & pitch map', vals: [false, true, true, true] },
        { label: 'Match Timeline', vals: [false, true, true, true] },
        { label: 'Stat Targets', vals: [false, true, true, true] },
        { label: 'PDF match reports', vals: [false, true, true, true] },
        { label: 'Quick View Stats (in-match)', vals: [true, true, true, true] },
      ]
    },
    {
      label: 'Club & Teams',
      rows: [
        { label: 'Number of coaches', vals: ['1', '1', 'Unlimited', 'Unlimited'] },
        { label: 'Number of teams', vals: ['1', '1', 'Up to 4', 'Up to 4'] },
        { label: 'Team join codes', vals: [false, false, true, true] },
        { label: 'Club management', vals: [false, false, true, true] },
        { label: 'Multi-team coach support', vals: [false, false, true, true] },
      ]
    },
    {
      label: 'Live & Pro Features',
      rows: [
        { label: 'Live match sharing', vals: [false, false, false, true] },
        { label: 'Live viewer mode', vals: [false, false, false, true] },
        { label: 'Priority support', vals: [false, false, false, true] },
        { label: 'Early access to features', vals: [false, false, false, true] },
      ]
    }
  ]

  const faqs = [
    { q: 'Do coaches pay separately on a Club plan?', a: 'No. On Club and Club Pro plans, the club owner pays one subscription. Coaches join for free using a team code — they create a free account and get access through the club\'s plan.' },
    { q: 'Can I switch plans mid-month?', a: 'Yes. You can upgrade at any time and the new plan takes effect immediately. Downgrading takes effect at the end of your current billing period.' },
    { q: 'What happens to my data if I cancel?', a: 'Your data is always yours. If you cancel, your matches and squad are preserved. You lose access to Pro analytics features until you resubscribe, but you can export everything as JSON from Settings at any time.' },
    { q: 'Is there an annual pricing option?', a: 'Not yet, but it\'s on the roadmap. Monthly billing gives you maximum flexibility for now.' },
    { q: 'Can I try Pro features before paying?', a: 'Yes — sign up free and you\'ll have full access to match logging, squad management, and puckout tracking immediately. Upgrade to Pro when you want analytics and unlimited history.' },
    { q: 'What is live match sharing?', a: 'A Club Pro feature. The coach logging the match starts a live session, and anyone with the link can watch the live score, stats, and puckout breakdown update in real time — perfect for selectors not at the ground.' },
    { q: 'Is there a custom/enterprise plan?', a: 'Yes. For county boards, schools, or large organisations needing custom stat types, white-labelling, or API access — contact us at contact@gaastatsapp.com and we\'ll build something around your needs.' },
  ]

  let openFaq = null

  onMount(() => {
    const els = document.querySelectorAll('.pricing-page .reveal')
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
    }, { threshold: 0 })
    els.forEach(el => io.observe(el))
    setTimeout(() => els.forEach(el => el.classList.add('in')), 1500)
    return () => io.disconnect()
  })
</script>

<div class="lp pricing-page">
  <div class="lp-noise"></div>
  <LpNav {onNavigate} currentPage="pricing" />

  <div class="pp-wrap">

    <!-- Header -->
    <div class="pp-header">
      <div class="pp-eyebrow reveal">Simple, transparent pricing</div>
      <h1 class="pp-title reveal reveal-delay-1">
        Pick your plan.<br><span class="lime">Start free.</span>
      </h1>
      <p class="pp-sub reveal reveal-delay-2">
        Every plan includes offline-first match logging, squad management, and cloud sync. Upgrade when you need more.
      </p>
    </div>

    <!-- Plan cards -->
    <div class="pp-cards reveal reveal-delay-2">
      {#each plans as plan}
        <div class="pp-card" class:pp-card-featured={plan.highlight}>
          {#if plan.badge}<div class="pp-badge">{plan.badge}</div>{/if}
          <div class="pp-plan-name">{plan.name}</div>
          <div class="pp-price">
            {plan.price}<span class="pp-period">{plan.period}</span>
          </div>
          <div class="pp-tagline">{plan.tagline}</div>
          <ul class="pp-features">
            {#each plan.features as f}
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {f}
              </li>
            {/each}
          </ul>
          <button class="pp-cta" class:pp-cta-featured={plan.highlight} on:click={plan.action}>
            {plan.cta}
          </button>
        </div>
      {/each}
      <!-- Enterprise card -->
      <div class="pp-card pp-card-enterprise">
        <div class="pp-enterprise-badge">Enterprise</div>
        <div class="pp-plan-name">Custom</div>
        <div class="pp-price-custom">Let's talk</div>
        <div class="pp-tagline">For county boards &amp; large organisations</div>
        <ul class="pp-features">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Everything in Club Pro</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Custom stat types</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>White-label option</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Multi-county / board</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>API access</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Dedicated onboarding &amp; SLA</li>
        </ul>
        <a href="mailto:contact@gaastatsapp.com" class="pp-cta pp-cta-enterprise">Contact Us</a>
      </div>
    </div>

    <!-- Feature comparison table -->
    <div class="pp-table-wrap reveal">
      <h2 class="pp-table-title">Full feature comparison</h2>
      <div class="pp-table-scroll">
        <table class="pp-table">
          <thead>
            <tr>
              <th class="pp-th-feature">Feature</th>
              <th>Free</th>
              <th class="pp-th-featured">Personal Pro</th>
              <th>Club</th>
              <th>Club Pro</th>
            </tr>
          </thead>
          <tbody>
            {#each tableGroups as group}
              <tr class="pp-group-row"><td colspan="5">{group.label}</td></tr>
              {#each group.rows as row}
                <tr>
                  <td class="pp-td-label">{row.label}</td>
                  {#each row.vals as val}
                    <td class="pp-td-val">
                      {#if val === true}
                        <svg class="pp-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {:else if val === false}
                        <span class="pp-dash">—</span>
                      {:else}
                        <span class="pp-str">{val}</span>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- FAQ -->
    <div class="pp-faq reveal">
      <h2 class="pp-faq-title">Frequently asked questions</h2>
      <div class="pp-faq-list">
        {#each faqs as item, i}
          <div class="pp-faq-item" class:open={openFaq === i}>
            <button class="pp-faq-q" on:click={() => openFaq = openFaq === i ? null : i}>
              {item.q}
              <svg class="pp-faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {#if openFaq === i}
              <div class="pp-faq-a">{item.a}</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- CTA -->
    <div class="pp-cta-section reveal">
      <h2 class="pp-cta-title">Ready to get started?</h2>
      <p class="pp-cta-sub">Free forever. Upgrade when you need it. No credit card required to start.</p>
      <button class="pp-cta-btn" on:click={() => goSignup('personal')}>Get Started Free →</button>
    </div>

  </div>

  <LpFooter {onNavigate} />
</div>

<style>
  .pricing-page { font-family: var(--lp-font-body); }
  .lp-noise {
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 200px; pointer-events: none; z-index: 9999; opacity: 0.6;
  }
  .reveal { transform: translateY(20px); transition: transform .6s ease; }
  .reveal.in { transform: none; }
  .reveal-delay-1 { transition-delay: .1s; }
  .reveal-delay-2 { transition-delay: .2s; }

  .pp-wrap { padding-top: 68px; max-width: 1200px; margin: 0 auto; padding-left: 40px; padding-right: 40px; }

  /* Header */
  .pp-header { text-align: center; padding: 80px 0 60px; }
  .pp-eyebrow {
    display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--lp-lime); background: rgba(186,255,41,0.1);
    border: 1px solid rgba(186,255,41,0.2); padding: 5px 14px; border-radius: 20px; margin-bottom: 20px;
  }
  .pp-title { font-family: var(--lp-font-head); font-size: clamp(48px, 7vw, 80px); line-height: 1; letter-spacing: 0.01em; color: var(--lp-text); margin-bottom: 20px; }
  .lime { color: var(--lp-lime); }
  .pp-sub { font-size: 18px; color: var(--lp-text2); max-width: 560px; margin: 0 auto; line-height: 1.6; }

  /* Cards */
  .pp-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 80px; align-items: start; }
  .pp-card {
    background: var(--lp-surface); border: 1px solid var(--lp-border);
    border-radius: 16px; padding: 28px 22px;
    display: flex; flex-direction: column; gap: 16px; position: relative;
    transition: border-color 0.2s, transform 0.2s;
  }
  .pp-card:hover { border-color: rgba(255,255,255,0.12); transform: translateY(-2px); }
  .pp-card-featured {
    border-color: rgba(186,255,41,0.4);
    background: linear-gradient(160deg, rgba(186,255,41,0.06) 0%, var(--lp-surface) 60%);
  }
  .pp-card-enterprise { border-color: rgba(255,184,0,0.3); }
  .pp-badge {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    background: var(--lp-lime); color: #05080F; font-size: 11px; font-weight: 800;
    padding: 4px 12px; border-radius: 20px; white-space: nowrap; letter-spacing: 0.04em;
  }
  .pp-enterprise-badge {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    background: var(--lp-amber); color: #05080F; font-size: 11px; font-weight: 800;
    padding: 4px 12px; border-radius: 20px; white-space: nowrap;
  }
  .pp-plan-name { font-size: 14px; font-weight: 700; color: var(--lp-text2); text-transform: uppercase; letter-spacing: 0.06em; }
  .pp-price { font-family: var(--lp-font-head); font-size: 42px; color: var(--lp-text); line-height: 1; }
  .pp-period { font-family: var(--lp-font-body); font-size: 14px; color: var(--lp-text3); font-weight: 400; }
  .pp-price-custom { font-family: var(--lp-font-head); font-size: 32px; color: var(--lp-amber); line-height: 1; }
  .pp-tagline { font-size: 13px; color: var(--lp-text3); line-height: 1.4; }
  .pp-features { list-style: none; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .pp-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--lp-text2); line-height: 1.4; }
  .pp-features svg { color: var(--lp-lime); flex-shrink: 0; margin-top: 1px; }
  .pp-cta {
    display: block; width: 100%; padding: 11px 16px; border-radius: 10px;
    font-family: var(--lp-font-body); font-size: 14px; font-weight: 700;
    border: 1px solid rgba(255,255,255,0.14); background: none; color: var(--lp-text);
    cursor: pointer; transition: all 0.15s; text-align: center; text-decoration: none;
  }
  .pp-cta:hover { background: rgba(255,255,255,0.06); }
  .pp-cta-featured { background: var(--lp-lime); color: #05080F; border-color: transparent; }
  .pp-cta-featured:hover { background: #CBFF4A; }
  .pp-cta-enterprise { border-color: rgba(255,184,0,0.3); color: var(--lp-amber); }
  .pp-cta-enterprise:hover { background: rgba(255,184,0,0.08); }

  /* Comparison table */
  .pp-table-wrap { margin-bottom: 80px; }
  .pp-table-title { font-size: 24px; font-weight: 700; color: var(--lp-text); margin-bottom: 24px; }
  .pp-table-scroll { overflow-x: auto; border-radius: 14px; border: 1px solid var(--lp-border); }
  .pp-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .pp-table thead tr { background: var(--lp-surface2); }
  .pp-table th {
    padding: 14px 20px; text-align: center; font-size: 13px; font-weight: 700;
    color: var(--lp-text2); border-bottom: 1px solid var(--lp-border); white-space: nowrap;
  }
  .pp-th-feature { text-align: left; color: var(--lp-text3); }
  .pp-th-featured { color: var(--lp-lime); }
  .pp-table td { padding: 12px 20px; border-bottom: 1px solid rgba(26,40,64,0.5); }
  .pp-table tr:last-child td { border-bottom: none; }
  .pp-table tbody tr:hover { background: rgba(255,255,255,0.02); }
  .pp-td-label { font-size: 14px; color: var(--lp-text2); }
  .pp-td-val { text-align: center; }
  .pp-check { color: var(--lp-lime); display: inline-block; }
  .pp-dash { color: var(--lp-text3); font-size: 16px; }
  .pp-str { font-size: 13px; color: var(--lp-text2); font-weight: 600; }
  .pp-group-row td {
    background: var(--lp-surface2); padding: 10px 20px;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--lp-text3); border-bottom: 1px solid var(--lp-border); border-top: 1px solid var(--lp-border);
  }

  /* FAQ */
  .pp-faq { max-width: 720px; margin: 0 auto 80px; }
  .pp-faq-title { font-size: 24px; font-weight: 700; color: var(--lp-text); margin-bottom: 24px; }
  .pp-faq-list { display: flex; flex-direction: column; gap: 0; border-radius: 14px; overflow: hidden; border: 1px solid var(--lp-border); }
  .pp-faq-item { border-bottom: 1px solid var(--lp-border); }
  .pp-faq-item:last-child { border-bottom: none; }
  .pp-faq-q {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 18px 22px; background: var(--lp-surface);
    border: none; cursor: pointer; font-family: var(--lp-font-body);
    font-size: 15px; font-weight: 600; color: var(--lp-text); text-align: left;
    transition: background 0.15s;
  }
  .pp-faq-q:hover { background: var(--lp-surface2); }
  .pp-faq-chevron { flex-shrink: 0; color: var(--lp-text3); transition: transform 0.2s; }
  .pp-faq-item.open .pp-faq-chevron { transform: rotate(180deg); }
  .pp-faq-a { padding: 0 22px 18px; font-size: 14px; color: var(--lp-text3); line-height: 1.7; background: var(--lp-surface); }

  /* CTA */
  .pp-cta-section { text-align: center; padding: 80px 0 100px; }
  .pp-cta-title { font-family: var(--lp-font-head); font-size: 48px; color: var(--lp-text); margin-bottom: 12px; letter-spacing: 0.02em; }
  .pp-cta-sub { font-size: 16px; color: var(--lp-text3); margin-bottom: 32px; }
  .pp-cta-btn {
    background: var(--lp-lime); color: #05080F; border: none; border-radius: 10px;
    font-family: var(--lp-font-body); font-size: 17px; font-weight: 700;
    padding: 16px 36px; cursor: pointer; transition: all 0.15s;
  }
  .pp-cta-btn:hover { background: #CBFF4A; transform: translateY(-2px); }

  @media (max-width: 1100px) { .pp-cards { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 900px) {
    .pp-wrap { padding-left: 20px; padding-right: 20px; }
    .pp-cards { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 600px) { .pp-cards { grid-template-columns: 1fr; } }
</style>
