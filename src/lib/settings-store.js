import { writable } from 'svelte/store'

const SETTINGS_KEY = 'doora-settings'

const defaults = {
  // Team
  teamName: 'Doora Barefield',

  // Match setup fields
  showVenueField: true,
  showCompetitionField: false,

  // Match periods
  periods: ['Warm-up', '1st Half', '2nd Half', 'Extra Time'],
  defaultPeriod: '1st Half',
  periodLength: 30,

  // Default stats shown in every new match
  defaultStats: ['Point', 'Goal', 'Wide', 'Tackle', 'Block', 'Turnover Won', 'Turnover Lost', 'Free Won'],

  // Tracking features — toggle entire features on/off
  trackPuckouts: true,
  trackOppScores: true,
  trackPitchCoords: true,

  // Quick View Stats — which accordions start open
  quickViewSections: {
    puckouts: true,
    conceded: true,
    players: false,
    subs: false
  },

  // Appearance
  clubPrimaryColor: null,

  // Team context behaviour
  rememberLastTeam: false,  // false = always show team picker on login

  // Legacy: halftime sheet section visibility (kept for compatibility)
  halftimeStats: {
    showScore: true,
    showPuckouts: true,
    showConcededScores: true,
    showPlayerStats: true,
    showSubs: true
  }
}

function createSettingsStore() {
  // FIX: Wrap JSON.parse in try-catch. If localStorage is corrupted (partial
  // write, storage-full abort, etc.) JSON.parse throws and the entire app
  // crashes on load. Fall back to defaults instead.
  let parsed = {}
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) parsed = JSON.parse(stored)
  } catch (e) {
    console.warn('Settings corrupted — resetting to defaults:', e)
    try { localStorage.removeItem(SETTINGS_KEY) } catch (_) {}
  }

  const initial = {
    ...defaults,
    ...parsed,
    halftimeStats: { ...defaults.halftimeStats, ...(parsed.halftimeStats || {}) },
    quickViewSections: { ...defaults.quickViewSections, ...(parsed.quickViewSections || {}) },
    // Ensure arrays have fallbacks
    periods: parsed.periods?.length ? parsed.periods : defaults.periods,
    defaultStats: parsed.defaultStats?.length ? parsed.defaultStats : defaults.defaultStats,
    clubPrimaryColor: parsed.clubPrimaryColor ?? defaults.clubPrimaryColor,
  }

  const { subscribe, set, update } = writable(initial)

  return {
    subscribe,
    save: (newSettings) => {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
      } catch (e) {
        console.warn('Failed to persist settings:', e)
        // In-memory store still updated — settings work for this session
      }
      set(newSettings)
    }
  }
}

export const settingsStore = createSettingsStore()
