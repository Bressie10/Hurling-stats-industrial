<script>
  import { toasts } from './toast.js'
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast-{toast.type}">{toast.message}</div>
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
    background: #1A1A1A;
    border: 1px solid #2E2E2E;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    padding: 12px 20px;
    border-radius: 10px;
    max-width: 400px;
    width: max-content;
    pointer-events: auto;
    animation: toast-slide-up 0.25s ease;
  }
  .toast-success { border-left: 4px solid #A8E63D; }
  .toast-error { border-left: 4px solid #e53935; }
  @keyframes toast-slide-up {
    from { transform: translateY(16px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
