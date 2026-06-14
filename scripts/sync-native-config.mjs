#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const checkOnly = process.argv.includes('--check')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writeOrCheck(path, value) {
  const expected = stableJson(value)
  if (checkOnly) {
    if (!existsSync(path)) {
      console.error(`missing - ${path}`)
      process.exitCode = 1
      return
    }
    const actual = readFileSync(path, 'utf8')
    if (actual !== expected) {
      console.error(`stale - ${path}`)
      process.exitCode = 1
      return
    }
    console.log(`ok - ${path}`)
    return
  }

  writeFileSync(path, expected)
  console.log(`wrote - ${path}`)
}

const release = readJson('native/shared/release.json')

writeOrCheck('capacitor.config.json', {
  appId: release.ios.bundleId,
  appName: release.appName,
  webDir: '.svelte-kit/output/client',
  server: {
    url: release.productionUrl,
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
})
