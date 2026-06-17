#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

let blockers = 0
let warnings = 0

function run(command, args = [], options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: options.env || process.env,
  })
}

function line(label, status, detail = '') {
  const suffix = detail ? ` - ${detail}` : ''
  console.log(`${status} - ${label}${suffix}`)
}

function required(label, ok, detail) {
  if (ok) line(label, 'ok', detail)
  else {
    blockers += 1
    line(label, 'missing', detail)
  }
}

function optional(label, ok, detail) {
  if (ok) line(label, 'ok', detail)
  else {
    warnings += 1
    line(label, 'warn', detail)
  }
}

function packageHas(name) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
}

function javaHomeCandidates() {
  return [
    process.env.JAVA_HOME,
    '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
    '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  ].filter(Boolean)
}

function envForJavaHome(javaHome) {
  return {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}:${process.env.PATH || ''}`,
  }
}

function javaVersionResult() {
  const systemJava = run('java', ['-version'])
  if (systemJava.status === 0)
    return { result: systemJava, javaHome: process.env.JAVA_HOME || null }

  for (const javaHome of javaHomeCandidates()) {
    const javaBin = path.join(javaHome, 'bin', 'java')
    if (!existsSync(javaBin)) continue
    const result = run(javaBin, ['-version'], { env: envForJavaHome(javaHome) })
    if (result.status === 0) return { result, javaHome }
  }

  return { result: systemJava, javaHome: null }
}

const capacitorConfig = existsSync('capacitor.config.json')
const releaseConfig = existsSync('native/shared/release.json')
required('native release config', releaseConfig, 'native/shared/release.json')
required('Capacitor config', capacitorConfig, 'capacitor.config.json')
required('Capacitor CLI package', packageHas('@capacitor/cli'), '@capacitor/cli')
required('Capacitor iOS package', packageHas('@capacitor/ios'), '@capacitor/ios')
required('Capacitor Android package', packageHas('@capacitor/android'), '@capacitor/android')

const { result: java, javaHome } = javaVersionResult()
const javaOutput = `${java.stdout || ''}${java.stderr || ''}`.trim().split('\n')[0] || 'not found'
const javaMajor = Number(javaOutput.match(/version "(\d+)/)?.[1] || 0)
required(
  'JDK 21+ for Android',
  java.status === 0 && javaMajor >= 21,
  javaMajor && javaMajor < 21
    ? `${javaOutput}; Capacitor Android requires source release 21`
    : javaHome
      ? `${javaOutput}; JAVA_HOME=${javaHome}`
      : javaOutput,
)

const sdkmanager = run(
  'sdkmanager',
  ['--version'],
  javaHome ? { env: envForJavaHome(javaHome) } : {},
)
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || ''
required(
  'Android SDK tools',
  sdkmanager.status === 0 || Boolean(androidHome),
  androidHome || (sdkmanager.stderr || sdkmanager.stdout || 'sdkmanager not found').trim(),
)

const androidProject = existsSync('android/app/build.gradle')
optional(
  'Android Capacitor project generated',
  androidProject,
  'run npm run native:android:init after JDK/Android SDK are installed',
)

const xcodeSelect = run('xcode-select', ['-p'])
const xcodePath = (xcodeSelect.stdout || xcodeSelect.stderr || '').trim()
const xcodebuild = run('xcodebuild', ['-version'])
const xcodeReady = xcodebuild.status === 0 && !xcodePath.includes('CommandLineTools')
required(
  'full Xcode for iOS',
  xcodeReady,
  xcodeReady
    ? xcodebuild.stdout.trim().split('\n').join(', ')
    : xcodebuild.stderr.trim() || xcodePath || 'xcodebuild not ready',
)

const iosProject =
  existsSync('ios/App/App.xcodeproj/project.pbxproj') || existsSync('ios/App/App.xcworkspace')
optional(
  'iOS Capacitor project generated',
  iosProject,
  'run npm run native:ios:add after full Xcode is selected',
)

console.log('')
if (blockers > 0) {
  console.log(`Native doctor found ${blockers} blocker(s) and ${warnings} warning(s).`)
  process.exitCode = 1
} else {
  console.log(`Native doctor passed with ${warnings} warning(s).`)
}
