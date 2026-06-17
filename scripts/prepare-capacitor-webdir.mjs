#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

const clientDir = '.svelte-kit/output/client'
const appDir = `${clientDir}/_app`
const prerenderedIndex = '.svelte-kit/output/prerendered/pages/index.html'
const clientIndex = `${clientDir}/index.html`
const envFile = `${appDir}/env.js`

if (!existsSync(clientDir)) {
  console.error(`missing - ${clientDir}; run npm run build first`)
  process.exit(1)
}

if (!existsSync(prerenderedIndex)) {
  console.error(`missing - ${prerenderedIndex}; the native bundle needs a prerendered shell`)
  process.exit(1)
}

const publicEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key.startsWith('PUBLIC_')),
)

mkdirSync(appDir, { recursive: true })
copyFileSync(prerenderedIndex, clientIndex)
writeFileSync(envFile, `export const env = ${JSON.stringify(publicEnv, null, 2)};\n`)

console.log(`prepared - ${clientIndex}`)
console.log(`prepared - ${envFile}`)
