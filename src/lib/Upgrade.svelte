<script>
  export let feature = 'this feature'  // e.g. "Player Stats"
</script>

<div class="paywall">
  <div class="paywall-icon">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  </div>
  <h3>Upgrade to unlock {feature}</h3>
  <p>Free accounts get match logging, squad management, and your last 3 matches. Upgrade to unlock full analytics.</p>

  <div class="plans">
    <div class="plan">
      <div class="plan-name">Personal Pro</div>
      <div class="plan-price">€7.99<span>/month</span></div>
      <ul class="plan-features">
        <li>Full match history</li>
        <li>Player stats &amp; trends</li>
        <li>Team stats &amp; pitch map</li>
        <li>Match timeline</li>
        <li>Stat targets</li>
        <li>1 coach</li>
      </ul>
      <button class="plan-btn personal" disabled>Coming soon</button>
    </div>

    <div class="plan featured">
      <div class="plan-badge">Most popular</div>
      <div class="plan-name">Club</div>
      <div class="plan-price">€15<span>/month</span></div>
      <ul class="plan-features">
        <li>Up to 4 teams</li>
        <li>Unlimited coaches</li>
        <li>6-digit team join codes</li>
        <li>Full analytics for all teams</li>
      </ul>
      <button class="plan-btn club" disabled>Coming soon</button>
    </div>

    <div class="plan">
      <div class="plan-name">Club Pro</div>
      <div class="plan-price">€25<span>/month</span></div>
      <ul class="plan-features">
        <li>Everything in Club</li>
        <li>Live match sharing</li>
        <li>Coaches watch in real time</li>
      </ul>
      <button class="plan-btn club" disabled>Coming soon</button>
    </div>
  </div>

  <p class="coming-soon-note">Online payments are being set up — check back soon.</p>
</div>

<style>
  .paywall {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 40px 20px;
    gap: 16px;
  }

  .paywall-icon {
    width: 72px; height: 72px;
    border-radius: 20px;
    background: rgba(var(--primary-rgb), 0.1);
    color: var(--primary);
    display: flex; align-items: center; justify-content: center;
  }

  .paywall h3 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .paywall > p {
    font-size: 14px;
    color: var(--text-muted);
    max-width: 380px;
    line-height: 1.6;
    margin: 0;
  }

  .plans {
    display: flex;
    gap: 12px;
    width: 100%;
    max-width: 500px;
    margin-top: 8px;
  }

  @media (max-width: 560px) {
    .plans { flex-direction: column; }
  }

  .plan {
    flex: 1;
    border: 1.5px solid var(--border);
    border-radius: 16px;
    padding: 20px 16px;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
  }

  .plan.featured {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.04);
  }

  .plan-badge {
    position: absolute;
    top: -11px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary);
    color: var(--primary-text);
    font-size: 10px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 20px;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .plan-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .plan-price {
    font-size: 28px;
    font-weight: 800;
    color: var(--text);
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .plan-price span {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .plan-features {
    list-style: none;
    padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 6px;
    text-align: left;
    flex: 1;
  }
  .plan-features li {
    font-size: 12px;
    color: var(--text-muted);
    display: flex; align-items: center; gap: 6px;
  }
  .plan-features li::before {
    content: '';
    width: 14px; height: 14px;
    border-radius: 50%;
    background: rgba(var(--primary-rgb), 0.15);
    background-image: url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%235A8A00' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 8px;
    flex-shrink: 0;
  }

  .plan-btn {
    width: 100%;
    padding: 11px;
    border-radius: 9px;
    border: none;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    margin-top: 4px;
  }
  .plan-btn.personal {
    background: var(--surface-2);
    color: var(--text-muted);
    border: 1.5px solid var(--border);
  }
  .plan-btn.club {
    background: var(--primary);
    color: var(--primary-text);
  }
  .plan-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .coming-soon-note {
    font-size: 12px;
    color: var(--text-faint);
    margin: 0;
  }
</style>
