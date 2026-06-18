#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/run-android-gradle.mjs <gradle-task> [...args]')
  process.exit(1)
}

function javaHomeCandidates() {
  return [
    process.env.JAVA_HOME,
    '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
    '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
    '/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home',
  ].filter(Boolean)
}

function findJavaHome() {
  for (const javaHome of javaHomeCandidates()) {
    const javaBin = path.join(javaHome, 'bin', 'java')
    if (existsSync(javaBin)) return javaHome
  }
  return process.env.JAVA_HOME || ''
}

function androidSdkCandidates() {
  return [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(homedir(), 'Library/Android/sdk'),
    '/opt/android-sdk',
    '/usr/local/share/android-sdk',
  ].filter(Boolean)
}

function findAndroidSdk() {
  for (const sdkRoot of androidSdkCandidates()) {
    if (
      existsSync(path.join(sdkRoot, 'platforms')) &&
      existsSync(path.join(sdkRoot, 'platform-tools'))
    ) {
      return sdkRoot
    }
  }
  return process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || ''
}

function prependExistingPath(env, dirs) {
  const existing = dirs.filter((dir) => existsSync(dir))
  if (!existing.length) return
  env.PATH = `${existing.join(path.delimiter)}${path.delimiter}${env.PATH || ''}`
}

const javaHome = findJavaHome()
const androidSdk = findAndroidSdk()
const env = { ...process.env }
if (javaHome) {
  env.JAVA_HOME = javaHome
  prependExistingPath(env, [path.join(javaHome, 'bin')])
}
if (androidSdk) {
  env.ANDROID_HOME = androidSdk
  env.ANDROID_SDK_ROOT = androidSdk
  prependExistingPath(env, [
    path.join(androidSdk, 'cmdline-tools/latest/bin'),
    path.join(androidSdk, 'platform-tools'),
    path.join(androidSdk, 'emulator'),
  ])
}

const result = spawnSync('./gradlew', args, {
  cwd: 'android',
  env,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
