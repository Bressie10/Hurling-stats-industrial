import { writable } from 'svelte/store'

const SETTINGS_KEY = 'doora-settings'

const defaults = {
  teamName: 'Doora Barefield',
  ageGroup: 'Minor',
  periodLength: 30,
  darkMode: false,
  defaultStats: ['Point', 'Goal', 'Wide', 'Tackle', 'Block', 'Turnover Won', 'Turnover Lost', 'Free Won']
}

function createSettingsStore() {
  const stored = localStorage.getItem(SETTINGS_KEY)
  const initial = stored ? { ...defaults, ...JSON.parse(stored) } : defaults

  const { subscribe, set, update } = writable(initial)

  return {
    subscribe,
    save: (newSettings) => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
      set(newSettings)
    }
  }
}

export const settingsStore = createSettingsStore()