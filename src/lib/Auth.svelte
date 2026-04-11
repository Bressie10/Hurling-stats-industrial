<script>
  import { signIn, signUp } from './auth-store.js'

  // modes: 'login' | 'choose' | 'personal' | 'club' | 'join'
  let mode = 'login'
  let email = ''
  let password = ''
  let clubName = ''
  let teamCode = ''
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
</script>

<div class="auth-wrap">
  <div class="auth-card">

    <div class="auth-header">
      <img src="/gaastat-icon.svg" alt="GAAstat" class="auth-logo" />
      <h1>GAA Stats</h1>
      <p>Hurling match analytics</p>
    </div>

    <!-- ── LOGIN ── -->
    {#if mode === 'login'}
      <div class="field-group">
        <label>Email</label>
        <input type="email" bind:value={email} placeholder="coach@example.com"
          on:keydown={e => e.key === 'Enter' && handleLogin()} />
      </div>
      <div class="field-group">
        <label>Password</label>
        <input type="password" bind:value={password} placeholder="••••••••"
          on:keydown={e => e.key === 'Enter' && handleLogin()} />
      </div>
      {#if error}<div class="msg error">{error}</div>{/if}
      <button class="submit-btn" on:click={handleLogin} disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <button class="outline-btn" on:click={() => setMode('choose')}>
        Create an account
      </button>

    <!-- ── CHOOSE ── -->
    {:else if mode === 'choose'}
      <p class="choose-sub">How are you using GAA Stats?</p>
      <div class="option-list">

        <button class="option-card" on:click={() => setMode('join')}>
          <div class="option-icon join">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          </div>
          <div class="option-body">
            <strong>Join my team</strong>
            <span>I have a 6-digit code from my manager</span>
          </div>
          <svg class="option-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button class="option-card" on:click={() => setMode('personal')}>
          <div class="option-icon personal">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="option-body">
            <strong>Personal account</strong>
            <span>Just me — 1 coach, 1 team</span>
          </div>
          <svg class="option-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button class="option-card" on:click={() => setMode('club')}>
          <div class="option-icon club">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="option-body">
            <strong>Set up my club</strong>
            <span>Manage multiple teams with shared codes</span>
          </div>
          <svg class="option-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

      </div>
      <button class="back-text-btn" on:click={() => setMode('login')}>← Back to sign in</button>

    <!-- ── JOIN TEAM ── -->
    {:else if mode === 'join'}
      {#if successMsg}
        <div class="msg success">{successMsg}</div>
        <button class="submit-btn" on:click={() => setMode('login')}>Go to sign in</button>
      {:else}
        <div class="flow-header">
          <button class="back-btn" on:click={() => setMode('choose')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span>Join my team</span>
        </div>
        <div class="field-group">
          <label>6-digit team code</label>
          <input
            type="text" inputmode="numeric" pattern="\d*" maxlength="6"
            bind:value={teamCode}
            placeholder="e.g. 482651"
            style="font-size: 28px; font-weight: 800; letter-spacing: 0.2em; text-align: center;"
          />
          <div class="field-hint">Your manager will have shared this with you</div>
        </div>
        <div class="field-group">
          <label>Your email</label>
          <input type="email" bind:value={email} placeholder="coach@example.com" />
        </div>
        <div class="field-group">
          <label>Create a password</label>
          <input type="password" bind:value={password} placeholder="••••••••" />
        </div>
        {#if error}<div class="msg error">{error}</div>{/if}
        <button class="submit-btn" on:click={handleJoinTeam} disabled={loading}>
          {loading ? 'Joining…' : 'Join team'}
        </button>
      {/if}

    <!-- ── PERSONAL ── -->
    {:else if mode === 'personal'}
      {#if successMsg}
        <div class="msg success">{successMsg}</div>
        <button class="submit-btn" on:click={() => setMode('login')}>Go to sign in</button>
      {:else}
        <div class="flow-header">
          <button class="back-btn" on:click={() => setMode('choose')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span>Personal account</span>
        </div>
        <div class="field-group">
          <label>Email</label>
          <input type="email" bind:value={email} placeholder="coach@example.com" />
        </div>
        <div class="field-group">
          <label>Create a password</label>
          <input type="password" bind:value={password} placeholder="••••••••" />
        </div>
        {#if error}<div class="msg error">{error}</div>{/if}
        <button class="submit-btn" on:click={handlePersonalSignup} disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <div class="tier-note">
          Free to start · Upgrade to <strong>Personal Pro at €7.99/month</strong> for full analytics
        </div>
      {/if}

    <!-- ── CLUB SETUP ── -->
    {:else if mode === 'club'}
      {#if successMsg}
        <div class="msg success">{successMsg}</div>
        <button class="submit-btn" on:click={() => setMode('login')}>Go to sign in</button>
      {:else}
        <div class="flow-header">
          <button class="back-btn" on:click={() => setMode('choose')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span>Set up my club</span>
        </div>
        <div class="field-group">
          <label>Club name</label>
          <input type="text" bind:value={clubName} placeholder="e.g. Your Club GAA" />
        </div>
        <div class="field-group">
          <label>Your email</label>
          <input type="email" bind:value={email} placeholder="manager@example.com" />
        </div>
        <div class="field-group">
          <label>Create a password</label>
          <input type="password" bind:value={password} placeholder="••••••••" />
        </div>
        {#if error}<div class="msg error">{error}</div>{/if}
        <button class="submit-btn" on:click={handleClubSignup} disabled={loading}>
          {loading ? 'Creating club…' : 'Create club'}
        </button>
        <div class="tier-note">
          After signing in you'll create your teams and get codes to share with your coaches.
          <br>Upgrade to <strong>Club at €15/month</strong> to unlock all features.
        </div>
      {/if}
    {/if}

  </div>
</div>

<style>
  .auth-wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    background-image: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(var(--primary-rgb), 0.08) 0%, transparent 70%);
    padding: 1rem;
  }
  .auth-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2rem;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 8px 40px rgba(26,32,21,0.10), 0 2px 8px rgba(26,32,21,0.06);
  }

  .auth-header { text-align: center; padding-bottom: 4px; }
  .auth-logo {
    width: 72px; height: 72px; object-fit: contain;
    margin-bottom: 14px; border-radius: 16px;
    box-shadow: 0 4px 16px rgba(var(--primary-rgb), 0.2);
  }
  .auth-header h1 { font-size: 21px; font-weight: 700; color: var(--text); margin-bottom: 4px; letter-spacing: -0.02em; }
  .auth-header p { font-size: 13px; color: var(--text-muted); }

  .field-group { display: flex; flex-direction: column; gap: 6px; }
  .field-group label { font-size: 12px; font-weight: 600; color: var(--text-2); }
  .field-group input {
    padding: 13px 14px;
    border: 1.5px solid var(--input-border);
    border-radius: 10px;
    font-size: 16px;
    font-family: inherit;
    background: var(--surface-3);
    color: var(--text);
    transition: all 0.15s;
  }
  .field-group input:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb),0.08);
  }
  .field-hint { font-size: 12px; color: var(--text-faint); }

  .msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; }
  .msg.error { background: #fce8e8; color: #c62828; border: 1px solid #f5c0c0; }
  .msg.success { background: #e6f4ea; color: #2d7a2d; border: 1px solid #b8e0bf; }

  .submit-btn {
    width: 100%; padding: 15px;
    background: var(--primary); color: var(--primary-text);
    border: none; border-radius: 10px;
    font-size: 16px; font-weight: 700;
    cursor: pointer; font-family: inherit;
    transition: background 0.15s; min-height: 50px;
  }
  .submit-btn:hover { background: var(--primary-hover); }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .outline-btn {
    width: 100%; padding: 15px;
    background: none; color: var(--primary);
    border: 2px solid var(--primary); border-radius: 10px;
    font-size: 16px; font-weight: 700;
    cursor: pointer; font-family: inherit;
    transition: all 0.15s; min-height: 50px;
  }
  .outline-btn:hover { background: rgba(var(--primary-rgb), 0.06); }

  /* Choose screen */
  .choose-sub { font-size: 14px; color: var(--text-muted); text-align: center; margin: -4px 0; }
  .option-list { display: flex; flex-direction: column; gap: 10px; }
  .option-card {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px;
    border: 1.5px solid var(--border); border-radius: 14px;
    background: var(--surface-2);
    cursor: pointer; text-align: left;
    font-family: inherit; color: var(--text);
    transition: all 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .option-card:hover { border-color: var(--primary); background: rgba(var(--primary-rgb), 0.04); }
  .option-card:active { transform: scale(0.98); }
  .option-icon {
    width: 48px; height: 48px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .option-icon.join     { background: rgba(59,130,246,0.12); color: #3b82f6; }
  .option-icon.personal { background: rgba(var(--primary-rgb),0.12); color: var(--primary); }
  .option-icon.club     { background: rgba(245,158,11,0.12); color: #f59e0b; }
  .option-body { flex: 1; }
  .option-body strong { display: block; font-size: 14px; font-weight: 600; margin-bottom: 2px; }
  .option-body span { font-size: 12px; color: var(--text-muted); }
  .option-arrow { color: var(--text-faint); flex-shrink: 0; }

  .back-text-btn {
    background: none; border: none;
    color: var(--text-muted); font-size: 13px;
    cursor: pointer; font-family: inherit;
    text-align: center; padding: 4px 0;
  }
  .back-text-btn:hover { color: var(--primary); }

  /* Flow header */
  .flow-header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: -4px;
  }
  .flow-header span { font-size: 15px; font-weight: 600; color: var(--text); }
  .back-btn {
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--surface-2);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-muted); flex-shrink: 0;
  }
  .back-btn:hover { border-color: var(--primary); color: var(--primary); }

  .tier-note {
    font-size: 12px; color: var(--text-muted);
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 12px; line-height: 1.6;
  }
</style>
