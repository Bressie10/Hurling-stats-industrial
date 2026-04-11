import { writable } from 'svelte/store'

export const toasts = writable([])

export function showToast(message, type = 'success') {
  const id = Date.now() + Math.random()
  toasts.update(all => [...all, { id, message, type }])
  setTimeout(() => {
    toasts.update(all => all.filter(t => t.id !== id))
  }, 5000)
}
