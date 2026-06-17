import { Capacitor, registerPlugin } from '@capacitor/core'

const OnDeviceSpeech = registerPlugin('OnDeviceSpeech')

function normalizeSpeechResult(result = {}) {
  const alternatives = Array.isArray(result.alternatives)
    ? result.alternatives
        .map((alternative) => ({
          transcript: String(alternative?.transcript || alternative?.text || '').trim(),
          confidence:
            typeof alternative?.confidence === 'number' && Number.isFinite(alternative.confidence)
              ? alternative.confidence
              : null,
        }))
        .filter((alternative) => alternative.transcript)
    : []
  const transcript = String(result.transcript || alternatives[0]?.transcript || '').trim()

  return {
    ...result,
    transcript,
    confidence:
      typeof result.confidence === 'number' && Number.isFinite(result.confidence)
        ? result.confidence
        : (alternatives[0]?.confidence ?? null),
    alternatives,
  }
}

export async function isOnDeviceSpeechAvailable({ locale = 'en-IE' } = {}) {
  if (!Capacitor.isNativePlatform?.()) {
    return {
      available: false,
      reason: 'native_required',
      diagnostics: { requestedLocale: locale, recognizerIsAvailable: false },
    }
  }

  try {
    const availability = await OnDeviceSpeech.isAvailable({ locale })
    const normalized = {
      ...availability,
      diagnostics: {
        requestedLocale: locale,
        recognizerIsAvailable: Boolean(availability?.available),
        ...(availability?.diagnostics || {}),
      },
    }
    console.info('PitchNote OnDeviceSpeech availability', normalized)
    return normalized
  } catch (e) {
    const availability = {
      available: false,
      reason: e?.message || String(e),
      diagnostics: { requestedLocale: locale, recognizerIsAvailable: false },
    }
    console.warn('PitchNote OnDeviceSpeech availability failed', availability)
    return availability
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

  const result = await OnDeviceSpeech.recognize({
    contextualStrings,
    locale,
    maxDurationMs,
  })
  return normalizeSpeechResult(result)
}
