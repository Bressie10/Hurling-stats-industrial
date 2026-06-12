import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Injects a build timestamp into sw.js at build time so the cache version
// auto-bumps on every deploy — no manual CACHE string edit needed.
function swCacheVersion() {
	function patchServiceWorkers() {
		const ts = Date.now()
		const candidates = [
			path.resolve(__dirname, 'dist/sw.js'),
			path.resolve(__dirname, '.vercel/output/static/sw.js')
		]

		for (const swPath of candidates) {
			if (!fs.existsSync(swPath)) continue
			const src = fs.readFileSync(swPath, 'utf-8')
			fs.writeFileSync(swPath, src.replaceAll('gaa-v2-__CACHE_VERSION__', `gaa-v2-${ts}`))
		}
	}

	return {
		name: 'sw-cache-version',
		closeBundle: patchServiceWorkers
	}
}

export default defineConfig({
	plugins: [sveltekit(), swCacheVersion()]
});
