import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import fs from 'fs'
import path from 'path'

// Injects a build timestamp into sw.js at build time so the cache version
// auto-bumps on every deploy — no manual CACHE string edit needed.
function swCacheVersion() {
  return {
    name: 'sw-cache-version',
    writeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js')
      if (!fs.existsSync(swPath)) return
      const ts = Date.now()
      const src = fs.readFileSync(swPath, 'utf-8')
      fs.writeFileSync(swPath, src.replace('__CACHE_VERSION__', ts))
    }
  }
}

export default defineConfig({
  plugins: [svelte(), swCacheVersion()],
})
