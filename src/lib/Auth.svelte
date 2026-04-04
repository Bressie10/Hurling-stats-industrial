<script>
  import { signIn, signUp } from './auth-store.js'

  // modes: 'login' | 'choose' | 'personal' | 'club' | 'join'
  let mode = 'login'
  let email = ''
  let password = ''
  let clubName = ''
  let clubCode = ''
  let loading = false
  let error = null
  let successMsg = null

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { error = 'Please enter your email and password'; return }
    loading = true; error = null
    try {
      await signIn(email, password)
    } catch (e) { error = e.message }
    loading = false
  }

  async function handlePersonalSignup() {
    if (!email.trim() || !password.trim()) { error = 'Please enter your email and password'; return }
    loading = true; error = null
    try {
      localStorage.setItem('signup_intent', JSON.stringify({ type: 'personal' }))
      await signUp(email, password)
      successMsg = 'Check your email to confirm your account'
    } catch (e) { error = e.message }
    loading = false
  }

  async function handleClubSignup() {
    if (!email.trim() || !password.trim()) { error = 'Please enter your email and password'; return }
    if (!clubName.trim()) { error = 'Please enter your club name'; return }
    loading = true; error = null
    try {
      localStorage.setItem('signup_intent', JSON.stringify({ type: 'club', clubName: clubName.trim() }))
      await signUp(email, password)
      successMsg = 'Check your email to confirm your account'
    } catch (e) { error = e.message }
    loading = false
  }

  async function handleJoinClub() {
    if (!email.trim() || !password.trim()) { error = 'Please enter your email and password'; return }
    if (!clubCode.trim()) { error = 'Please enter your club code'; return }
    loading = true; error = null
    try {
      localStorage.setItem('signup_intent', JSON.stringify({ type: 'join', clubCode: clubCode.trim() }))
      await signUp(email, password)
      successMsg = 'Check your email to confirm your account'
    } catch (e) { error = e.message }
    loading = false
  }

  function reset() { error = null; successMsg = null }
  function setMode(m) { mode = m; reset() }
</script>

<div class="auth-wrap">
  <div class="auth-card">

    <div class="auth-header">
      <img src="doora-barefield.png" alt="Doora Barefield" class="auth-logo" />
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
      <button class="create-account-btn" on:click={() => setMode('choose')}>
        Create an account
      </button>

    <!-- ── CHOOSE SIGNUP TYPE ── -->
    {:else if mode === 'choose'}
      <div class="choose-title">How would you like to sign up?</div>
      <div class="signup-options">
        <button class="option-card" on:click={() => setMode('personal')}>
          <div class="option-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="option-text">
            <strong>Personal</strong>
            <span>Just you — 1 coach</span>
          </div>
          <div class="option-price">Free to start</div>
        </button>

        <button class="option-card" on:click={() => setMode('club')}>
          <div class="option-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="option-text">
            <strong>Create a Club</strong>
            <span>Up to 6 coaches share access</span>
          </div>
          <div class="option-price">Free to start</div>
        </button>

        <button class="option-card" on:click={() => setMode('join')}>
          <div class="option-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          </div>
          <div class="option-text">
            <strong>Join a Club</strong>
            <span>Enter your club's invite code</span>
          </div>
          <div class="option-price">Free to start</div>
        </button>
      </div>
      <div class="auth-hint">
        Already have an account?
        <button class="link-btn" on:click={() => setMode('login')}>Sign in</button>
      </div>

    <!-- ── PERSONAL SIGNUP ── -->
    {:else if mode === 'personal'}
      {#if successMsg}
        <div class="msg success">{successMsg}</div>
        <button class="submit-btn" on:click={() => setMode('login')}>Back to sign in</button>
      {:else}
        <div class="back-row">
          <button class="back-btn" on:click={() => setMode('choose')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <span class="mode-label">Personal account</span>
        </div>
        <div class="field-group">
          <label>Email</label>
          <input type="email" bind:value={email} placeholder="coach@example.com" />
        </div>
        <div class="field-group">
          <label>Password</label>
          <input type="password" bind:value={password} placeholder="••••••••" />
        </div>
        {#if error}<div class="msg error">{error}</div>{/if}
        <button class="submit-btn" on:click={handlePersonalSignup} disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <div class="tier-info">
          <strong>Free tier includes:</strong> Match logging · Squad · Last 3 matches
          <br>Upgrade to <strong>Personal Pro at €7.99/month</strong> for full analytics
        </div>
      {/if}

    <!-- ── CLUB SIGNUP ── -->
    {:else if mode === 'club'}
      {#if successMsg}
        <div class="msg success">{successMsg}</div>
        <button class="submit-btn" on:click={() => setMode('login')}>Back to sign in</button>
      {:else}
        <div class="back-row">
          <button class="back-btn" on:click={() => setMode('choose')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <span class="mode-label">Create a club</span>
        </div>
        <div class="field-group">
          <label>Club name</label>
          <input type="text" bind:value={clubName} placeholder="e.g. Doora Barefield GAA" />
        </div>
        <div class="field-group">
          <label>Your email</label>
          <input type="email" bind:value={email} placeholder="coach@example.com" />
        </div>
        <div class="field-group">
          <label>Password</label>
          <input type="password" bind:value={password} placeholder="••••••••" />
        </div>
        {#if error}<div class="msg error">{error}</div>{/if}
        <button class="submit-btn" on:click={handleClubSignup} disabled={loading}>
          {loading ? 'Creating club…' : 'Create club'}
        </button>
        <div class="tier-info">
          You'll get a shareable club code after signing up.
          <br>Upgrade to <strong>Club Plan at €19.99/month</strong> for full access for up to 6 coaches.
        </div>
      {/if}

    <!-- ── JOIN CLUB ── -->
    {:else if mode === 'join'}
      {#if successMsg}
        <div class="msg success">{successMsg}</div>
        <button class="submit-btn" on:click={() => setMode('login')}>Back to sign in</button>
      {:else}
        <div class="back-row">
          <button class="back-btn" on:click={() => setMode('choose')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <span class="mode-label">Join a club</span>
        </div>
        <div class="field-group">
          <label>Club invite code</label>
          <input type="text" bind:value={clubCode} placeholder="e.g. AB3X9K2M"
            style="text-transform: uppercase; letter-spacing: 0.1em;" />
        </div>
        <div class="field-group">
          <label>Your email</label>
          <input type="email" bind:value={email} placeholder="coach@example.com" />
        </div>
        <div class="field-group">
          <label>Password</label>
          <input type="password" bind:value={password} placeholder="••••••••" />
        </div>
        {#if error}<div class="msg error">{error}</div>{/if}
        <button class="submit-btn" on:click={handleJoinClub} disabled={loading}>
          {loading ? 'Joining…' : 'Join club'}
        </button>
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
    background-image:
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(var(--primary-rgb), 0.08) 0%, transparent 70%);
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
    width: 72px;
    height: 72px;
    object-fit: contain;
    margin-bottom: 14px;
    border-radius: 16px;
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
    transition: all 0.15s;
    color: var(--text);
  }
  .field-group input:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb),0.08);
  }

  .msg {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
  }
  .msg.error { background: #fce8e8; color: #c62828; border: 1px solid #f5c0c0; }
  .msg.success { background: #e6f4ea; color: #2d7a2d; border: 1px solid #b8e0bf; }

  .submit-btn {
    width: 100%;
    padding: 15px;
    background: var(--primary);
    color: var(--primary-text);
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    min-height: 50px;
  }
  .submit-btn:hover { background: var(--primary-hover); }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .auth-hint { text-align: center; font-size: 13px; color: var(--text-muted); }
  .link-btn {
    background: none; border: none; color: var(--primary);
    font-size: 13px; font-weight: 600; cursor: pointer;
    font-family: inherit; text-decoration: underline;
  }
  .create-account-btn {
    width: 100%;
    padding: 15px;
    background: none;
    color: var(--primary);
    border: 2px solid var(--primary);
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    min-height: 50px;
  }
  .create-account-btn:hover { background: rgba(var(--primary-rgb), 0.06); }

  /* ── Choose type ── */
  .choose-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    text-align: center;
    margin-bottom: -4px;
  }
  .signup-options { display: flex; flex-direction: column; gap: 10px; }
  .option-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1.5px solid var(--border);
    border-radius: 12px;
    background: var(--surface-2);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: all 0.15s;
    color: var(--text);
  }
  .option-card:hover {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.04);
  }
  .option-icon {
    width: 48px; height: 48px;
    border-radius: 12px;
    background: rgba(var(--primary-rgb), 0.1);
    color: var(--primary);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .option-text { flex: 1; }
  .option-text strong { display: block; font-size: 14px; margin-bottom: 2px; }
  .option-text span { font-size: 12px; color: var(--text-muted); }
  .option-price {
    font-size: 11px;
    font-weight: 600;
    color: var(--primary);
    white-space: nowrap;
  }

  /* ── Back row ── */
  .back-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: -4px;
  }
  .back-btn {
    display: inline-flex; align-items: center; gap: 4px;
    border: none; background: none;
    color: var(--text-muted); font-size: 13px;
    cursor: pointer; font-family: inherit; padding: 0;
  }
  .back-btn:hover { color: var(--primary); }
  .mode-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  /* ── Tier info note ── */
  .tier-info {
    font-size: 12px;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    line-height: 1.6;
  }
</style>
