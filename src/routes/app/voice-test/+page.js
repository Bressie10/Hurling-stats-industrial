import { redirect } from '@sveltejs/kit'
import { SHOW_VOICE_TEST_HARNESS } from '$lib/config.js'

export const ssr = false

export function load() {
  if (!SHOW_VOICE_TEST_HARNESS) throw redirect(307, '/app/settings')
}
