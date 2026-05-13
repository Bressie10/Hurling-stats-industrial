<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '$lib/supabase.js'
  import { updatePassword, signOut } from '$lib/auth-store.js'

  let password = ''
  let confirm = ''
  let loading = false
  let error = null
  let successMsg = null
  let ready = false
  let recoveryMode = false

  onMount(() => {
    // Supabase fires PASSWORD_RECOVERY when the user lands here from the email link.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { recoveryMode = true; ready = true }
    })
    // If the recovery session is already established (or token has already been consumed),
    // we still let the user try to set a password — Supabase will reject if no session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) ready = true
      // If no session and no recovery event arrives, the link was invalid/expired.
      setTimeout(() => { if (!ready) ready = true }, 800)
    })
    return () => sub.subscription.unsubscribe()
  })

  async function handleSubmit() {
    if (password.length < 8) { error = 'Password must be at least 8 characters'; return }
    if (password !== confirm) { error = 'Passwords do not match'; return }
    loading = true; error = null
    try {
      await updatePassword(password)
      successMsg = 'Password updated. You can now sign in with your new password.'
      // Sign out so the recovery session doesn't auto-log them into the app.
      await signOut()
    } catch (e) {
      error = e.message
    }
    loading = false
  }

  function backToSignIn() { goto('/') }
</script>

<svelte:head>
  <title>Reset password · GAAstat</title>
</svelte:head>

<div class="wrap">
  <div class="card">
    <div class="header">
      <img src="/gaastat-icon.svg" alt="GAAstat" class="logo">
      <div>
        <div class="title">Reset password</div>
        <div class="sub">Choose a new password for your GAAstat account</div>
      </div>
    </div>

    {#if !ready}
      <div class="muted">Checking reset link…</div>
    {:else if successMsg}
      <div class="success">{successMsg}</div>
      <button class="btn-primary" on:click={backToSignIn}>Go to sign in</button>
    {:else}
      <div class="field">
        <label>New password</label>
        <input type="password" bind:value={password} placeholder="At least 8 characters"
          on:keydown={(e) => e.key === 'Enter' && handleSubmit()} />
      </div>
      <div class="field">
        <label>Confirm new password</label>
        <input type="password" bind:value={confirm} placeholder="Repeat password"
          on:keydown={(e) => e.key === 'Enter' && handleSubmit()} />
      </div>
      {#if error}<div class="error">{error}</div>{/if}
      <button class="btn-primary" on:click={handleSubmit} disabled={loading}>
        {loading ? 'Updating…' : 'Update password'}
      </button>
      <button type="button" class="link" on:click={backToSignIn}>← Back to sign in</button>
    {/if}
  </div>
</div>

<style>
  .wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #05080F;
    padding: 24px;
    font-family: 'Outfit', system-ui, sans-serif;
  }
  .card {
    width: 100%;
    max-width: 420px;
    background: #0C1422;
    border: 1px solid #1e3a5f;
    border-radius: 16px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: #E4EDF8;
  }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
  .logo { width: 40px; height: 40px; object-fit: contain; border-radius: 8px; }
  .title { font-size: 18px; font-weight: 700; }
  .sub { font-size: 13px; color: #8CA3BF; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-size: 12px; color: #8CA3BF; font-weight: 600; }
  .field input {
    background: rgba(255,255,255,0.04);
    border: 1px solid #1e3a5f;
    border-radius: 8px;
    color: #E4EDF8;
    padding: 11px 12px;
    font-size: 14px;
    font-family: inherit;
  }
  .field input:focus { outline: none; border-color: #BAFF29; }
  .btn-primary {
    background: #BAFF29; color: #05080F; border: none;
    border-radius: 10px; padding: 12px; font-weight: 700;
    font-size: 14px; cursor: pointer; font-family: inherit;
  }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .link {
    background: none; border: none; color: #8CA3BF; font-size: 13px;
    cursor: pointer; padding: 4px 0; font-family: inherit; text-align: center;
  }
  .link:hover { color: #BAFF29; }
  .error { color: #FF3A3A; font-size: 13px; }
  .success { color: #BAFF29; font-size: 14px; line-height: 1.5; }
  .muted { color: #8CA3BF; font-size: 13px; text-align: center; padding: 12px 0; }
</style>
