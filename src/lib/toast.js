import { writable } from 'svelte/store'

export const toasts = writable([])

export function dismissToast(id) {
  toasts.update((all) => all.filter((t) => t.id !== id))
}

export function showToast(message, type = 'success', options = {}) {
  if (typeof type === 'object' && type) {
    options = type
    type = options.type || 'success'
  }
  const id = Date.now() + Math.random()
  const durationMs = options.durationMs ?? 5000
  toasts.update((all) => [...all, { id, message, type, actions: options.actions || [] }])
  if (durationMs > 0) {
    setTimeout(() => dismissToast(id), durationMs)
  }
  return id
}
