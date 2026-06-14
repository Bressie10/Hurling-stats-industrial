<script>
  import { toasts } from './toast.js'
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast-{toast.type}">
      <span>{toast.message}</span>
      {#if toast.actions?.length}
        <div class="toast-actions">
          {#each toast.actions as action}
            <button
              type="button"
              class="toast-action"
              onclick={() => {
                action.onClick?.()
              }}>{action.label}</button
            >
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    pointer-events: none;
    width: max-content;
    max-width: calc(100vw - 32px);
  }
  .toast {
    background: #1a1a1a;
    border: 1px solid #2e2e2e;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    padding: 12px 20px;
    border-radius: 10px;
    max-width: 400px;
    width: fit-content;
    pointer-events: auto;
    animation: toast-slide-up 0.25s ease;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .toast-success {
    border-left: 4px solid #a8e63d;
  }
  .toast-error {
    border-left: 4px solid #e53935;
  }
  .toast-warning {
    border-left: 4px solid #e0a020;
  }
  .toast-info {
    border-left: 4px solid #4a90e2;
  }
  .toast-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .toast-action {
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border-radius: 6px;
    padding: 5px 8px;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .toast-action:hover {
    background: rgba(255, 255, 255, 0.16);
  }
  @keyframes toast-slide-up {
    from {
      transform: translateY(16px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
