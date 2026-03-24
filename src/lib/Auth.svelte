<script>
  import { signIn, signUp } from './auth-store.js'

  let mode = 'login'
  let email = ''
  let password = ''
  let loading = false
  let error = null

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      error = 'Please enter your email and password'
      return
    }
    loading = true
    error = null
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        error = 'Check your email to confirm your account'
        loading = false
        return
      }
    } catch (e) {
      error = e.message
    }
    loading = false
  }
</script>

<div class="auth-wrap">
  <div class="auth-card">

    <div class="auth-header">
      <img src="doora-barefield.png" alt="Doora Barefield" class="auth-logo" />
      <h1>Doora Barefield</h1>
      <p>Hurling Stats</p>
    </div>

    <div class="mode-toggle">
      <button class:active={mode === 'login'} on:click={() => { mode = 'login'; error = null }}>
        Sign in
      </button>
      <button class:active={mode === 'signup'} on:click={() => { mode = 'signup'; error = null }}>
        Create account
      </button>
    </div>

    <div class="field-group">
      <label>Email</label>
      <input
        type="email"
        bind:value={email}
        placeholder="coach@example.com"
        on:keydown={e => e.key === 'Enter' && handleSubmit()}
      />
    </div>

    <div class="field-group">
      <label>Password</label>
      <input
        type="password"
        bind:value={password}
        placeholder="••••••••"
        on:keydown={e => e.key === 'Enter' && handleSubmit()}
      />
    </div>

    {#if error}
      <div class="error-msg" class:info={error.includes('Check your email')}>
        {error}
      </div>
    {/if}

    <button class="submit-btn" on:click={handleSubmit} disabled={loading}>
      {#if loading}
        Loading...
      {:else if mode === 'login'}
        Sign in
      {:else}
        Create account
      {/if}
    </button>

    <div class="auth-hint">
      {#if mode === 'login'}
        No account yet?
        <button class="link-btn" on:click={() => { mode = 'signup'; error = null }}>Create one</button>
      {:else}
        Already have an account?
        <button class="link-btn" on:click={() => { mode = 'login'; error = null }}>Sign in</button>
      {/if}
    </div>

  </div>
</div>

<style>
  .auth-wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    padding: 1rem;
  }
  .auth-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 2rem;
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .auth-header { text-align: center; }
  .auth-logo { width: 64px; height: 64px; object-fit: contain; margin-bottom: 12px; }
  .auth-header h1 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .auth-header p { font-size: 13px; color: var(--text-muted); }

  .mode-toggle {
    display: flex;
    border: 1px solid var(--input-border);
    border-radius: 10px;
    overflow: hidden;
  }
  .mode-toggle button {
    flex: 1;
    padding: 12px 9px;
    border: none;
    background: none;
    font-size: 14px;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    min-height: 44px;
  }
  .mode-toggle button.active {
    background: #6B1B2B;
    color: white;
    font-weight: 600;
  }

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
  }
  .field-group input:focus {
    outline: none;
    border-color: #6B1B2B;
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(107,27,43,0.08);
  }

  .error-msg {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    background: #fce8e8;
    color: #c62828;
    border: 1px solid #f5c0c0;
  }
  .error-msg.info {
    background: #e6f4ea;
    color: #2d7a2d;
    border-color: #b8e0bf;
  }

  .submit-btn {
    width: 100%;
    padding: 15px;
    background: #6B1B2B;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    min-height: 50px;
  }
  .submit-btn:hover { background: #551522; }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .auth-hint {
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
  }
  .link-btn {
    background: none;
    border: none;
    color: #6B1B2B;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    text-decoration: underline;
  }
</style>