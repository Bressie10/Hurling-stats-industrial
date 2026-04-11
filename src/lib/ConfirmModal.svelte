<script>
  export let title = ''
  export let message = ''
  export let confirmLabel = 'Confirm'
  export let confirmStyle = 'primary' // 'primary' | 'danger'
  export let onConfirm = () => {}
  export let onCancel = () => {}
</script>

<div class="cm-overlay" onclick={onCancel}>
  <div class="cm-card" onclick={(e) => e.stopPropagation()}>
    <div class="cm-title">{title}</div>
    {#if message}
      <p class="cm-message">{message}</p>
    {/if}
    <div class="cm-actions">
      <button class="cm-cancel" onclick={onCancel}>Cancel</button>
      <button class="cm-confirm cm-{confirmStyle}" onclick={onConfirm}>{confirmLabel}</button>
    </div>
  </div>
</div>

<style>
  .cm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .cm-card {
    background: #1A1A1A;
    border: 1px solid #2E2E2E;
    border-radius: 16px;
    padding: 24px;
    max-width: 340px;
    width: 100%;
  }
  .cm-title {
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .cm-message {
    color: #888888;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 20px;
  }
  .cm-actions {
    display: flex;
    gap: 10px;
  }
  .cm-cancel, .cm-confirm {
    flex: 1;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    border: none;
  }
  .cm-cancel {
    background: transparent;
    border: 1px solid #2E2E2E;
    color: #fff;
  }
  .cm-cancel:hover { background: rgba(255,255,255,0.05); }
  .cm-danger {
    background: #e53935;
    color: #fff;
  }
  .cm-danger:hover { background: #c62828; }
  .cm-primary {
    background: #A8E63D;
    color: #111;
  }
  .cm-primary:hover { background: #96cf2a; }
</style>
