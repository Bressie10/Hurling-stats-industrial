import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'

export const CLUB = {
  name: "Doora Barfield GAA"
};

const STORE_BUILD_KEY = 'gaastat-store-build'
const STORE_BUILD_QUERY_PARAM = 'store_build'
const VALID_STORE_BUILDS = new Set(['ios', 'android'])

function normalizeStoreBuild(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return VALID_STORE_BUILDS.has(normalized) ? normalized : 'web'
}

function runtimeStoreBuild() {
  const envBuild = normalizeStoreBuild(env.PUBLIC_STORE_BUILD)
  if (envBuild !== 'web') return envBuild
  if (!browser) return 'web'

  const params = new URLSearchParams(window.location.search)
  const queryBuild = normalizeStoreBuild(params.get(STORE_BUILD_QUERY_PARAM))
  if (queryBuild !== 'web') {
    localStorage.setItem(STORE_BUILD_KEY, queryBuild)
    return queryBuild
  }

  return normalizeStoreBuild(localStorage.getItem(STORE_BUILD_KEY))
}

export const STORE_BUILD = runtimeStoreBuild()
export const IS_NATIVE_STORE_BUILD = STORE_BUILD === 'ios' || STORE_BUILD === 'android'
export const STORE_PLATFORM_LABEL = STORE_BUILD === 'ios'
  ? 'iOS App Store'
  : STORE_BUILD === 'android'
    ? 'Google Play'
    : 'web'
export const SHOW_WEB_PURCHASES = !IS_NATIVE_STORE_BUILD
