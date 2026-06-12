// Renders PWA/store PNG icons from static/gaastat-icon.svg.
// Run after changing the icon: node scripts/generate-icons.mjs
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'static', 'gaastat-icon.svg')
const outDir = path.join(root, 'static', 'icons')

// All icons flattened onto white: maskable icons must fill the full canvas,
// and Apple rejects transparency in App Store icons.
const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-1024.png', size: 1024 }, // App Store / Play Store listing art
]

fs.mkdirSync(outDir, { recursive: true })

for (const { file, size } of targets) {
  await sharp(src, { density: Math.ceil((72 * size) / 512) })
    .resize(size, size)
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(outDir, file))
  console.log(`✓ ${file} (${size}×${size})`)
}
