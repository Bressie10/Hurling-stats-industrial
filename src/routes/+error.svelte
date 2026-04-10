<script>
  import { page } from '$app/stores'

  const messages = {
    404: 'Page not found — it may have moved or never existed',
    500: 'Something went wrong on our end — we\'re on it',
    403: 'You don\'t have permission to view this page',
  }

  $: message = messages[$page.status] ?? 'An unexpected error occurred'
  $: is500 = $page.status === 500

  function retry() {
    window.location.reload()
  }
</script>

<div class="error-page">
  <img src="/gaastat-logo.svg" alt="GAAstat" style="height: 36px;">

  <div class="status">{$page.status}</div>

  <p class="message">{message}</p>

  <div class="actions">
    <a href="/" class="btn-primary">Go home</a>
    {#if is500}
      <button class="btn-secondary" on:click={retry}>Retry</button>
    {/if}
  </div>

  <p class="help">
    Need help? Email us at <a href="mailto:info@gaastat.com">info@gaastat.com</a>
  </p>
</div>

<style>
  .error-page {
    min-height: 100vh;
    background: #0D0D0D;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, sans-serif;
    text-align: center;
  }

  .status {
    font-size: clamp(80px, 20vw, 120px);
    font-weight: 800;
    color: #FFFFFF;
    line-height: 1;
    letter-spacing: -0.04em;
    margin-top: 8px;
  }

  .message {
    font-size: clamp(14px, 3vw, 16px);
    color: #666666;
    max-width: 380px;
    line-height: 1.5;
    margin: 0;
  }

  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 8px;
  }

  .btn-primary {
    padding: 12px 28px;
    background: #A8E63D;
    color: #0D0D0D;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    font-family: inherit;
  }

  .btn-secondary {
    padding: 12px 28px;
    background: transparent;
    color: #A8E63D;
    border: 2px solid #A8E63D;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }

  .help {
    font-size: 13px;
    color: #666666;
    margin: 8px 0 0;
  }

  .help a {
    color: #A8E63D;
    text-decoration: none;
  }
</style>
