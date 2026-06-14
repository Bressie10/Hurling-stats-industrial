import { Capacitor, registerPlugin } from '@capacitor/core'

const OnDeviceSpeech = registerPlugin('OnDeviceSpeech')

export async function isOnDeviceSpeechAvailable() {
  if (!Capacitor.isNativePlatform?.()) {
    return { available: false, reason: 'native_required' }
  }

  try {
    return await OnDeviceSpeech.isAvailable()
  } catch (e) {
    return { available: false, reason: e?.message || String(e) }
  }
}

export async function recognizeOnDeviceSpeech({
  contextualStrings = [],
  locale = 'en-IE',
  maxDurationMs = 4500,
} = {}) {
  if (!Capacitor.isNativePlatform?.()) {
    throw new Error('On-device voice logging is available in the native app.')
  }

  return await OnDeviceSpeech.recognize({
    contextualStrings,
    locale,
    maxDurationMs,
  })
}
