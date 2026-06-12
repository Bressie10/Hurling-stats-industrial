import { json } from '@sveltejs/kit'
import { env as privateEnv } from '$env/dynamic/private'
import { env as publicEnv } from '$env/dynamic/public'

export const prerender = false

const DEFAULT_MODEL = 'gpt-4o-mini-transcribe'
const FALLBACK_MODEL = 'whisper-1'
const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MIN_AUDIO_BYTES = 900
const MAX_PROMPT_CHARS = 2200

function clipText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function defaultFileName(audio) {
  const type = String(audio?.type || '')
  if (type.includes('mp4')) return 'sideline-command.m4a'
  if (type.includes('wav')) return 'sideline-command.wav'
  if (type.includes('ogg')) return 'sideline-command.ogg'
  return 'sideline-command.webm'
}

function openAiErrorMessage(body) {
  if (!body) return ''
  if (typeof body === 'string') return body
  return body?.error?.message || body?.error || body?.message || ''
}

function transcriptionHint(detail) {
  const text = String(detail || '').toLowerCase()
  if (/duration|too short|empty|decode|format|file|audio/.test(text)) {
    return 'Voice clip was too short or could not be read. Hold Talk a little longer and try again.'
  }
  if (/model|does not exist|not found|unsupported/.test(text)) {
    return `Transcription model failed. Set SIDELINE_TRANSCRIPTION_MODEL=${FALLBACK_MODEL} and redeploy.`
  }
  return 'Voice transcription failed. Try again.'
}

function bearerToken(request) {
  const auth = request.headers.get('authorization') || ''
  return auth.match(/^Bearer\s+(.+)$/i)?.[1] || ''
}

async function verifySupabaseUser(token, supabaseUrl, supabaseAnonKey) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey
    }
  })

  if (!response.ok) return null
  return await response.json().catch(() => null)
}

async function transcribeWithOpenAi({ apiKey, userId, audio, model, prompt }) {
  const openAiForm = new FormData()
  openAiForm.set('file', audio, audio.name || defaultFileName(audio))
  openAiForm.set('model', model)
  openAiForm.set('response_format', 'json')
  openAiForm.set('language', 'en')
  if (prompt) openAiForm.set('prompt', prompt)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Safety-Identifier': userId
    },
    body: openAiForm
  })

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')

  return { response, body }
}

export async function POST({ request }) {
  const headers = { 'Cache-Control': 'no-store' }
  const apiKey = privateEnv.OPENAI_API_KEY
  const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL
  const supabaseAnonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY

  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500, headers })
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'Supabase auth env vars are not configured.' }, { status: 500, headers })
  }

  const token = bearerToken(request)
  if (!token) {
    return json({ error: 'Sign in required.' }, { status: 401, headers })
  }

  const user = await verifySupabaseUser(token, supabaseUrl, supabaseAnonKey)
  if (!user?.id) {
    return json({ error: 'Authentication required.' }, { status: 401, headers })
  }

  let form
  try {
    form = await request.formData()
  } catch (_) {
    return json({ error: 'Expected multipart form data.' }, { status: 400, headers })
  }

  const audio = form.get('audio') || form.get('file')
  if (!audio || typeof audio.arrayBuffer !== 'function') {
    return json({ error: 'Missing audio file.' }, { status: 400, headers })
  }

  if (audio.size <= 0) {
    return json({ error: 'Empty audio file.' }, { status: 400, headers })
  }

  if (audio.size < MIN_AUDIO_BYTES) {
    return json({
      error: 'Voice clip is too short.',
      hint: 'Hold Talk a little longer and try again.'
    }, { status: 400, headers })
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return json({ error: 'Audio clip is too large.' }, { status: 413, headers })
  }

  const model = privateEnv.SIDELINE_TRANSCRIPTION_MODEL || DEFAULT_MODEL
  const prompt = clipText(form.get('prompt'), MAX_PROMPT_CHARS)
  const startedAt = Date.now()

  try {
    let activeModel = model
    let { response, body } = await transcribeWithOpenAi({
      apiKey,
      userId: user.id,
      audio,
      model: activeModel,
      prompt
    })

    let detail = openAiErrorMessage(body)
    if (!response.ok && response.status === 400 && activeModel !== FALLBACK_MODEL && /model|does not exist|not found|unsupported/i.test(detail)) {
      activeModel = FALLBACK_MODEL
      ;({ response, body } = await transcribeWithOpenAi({
        apiKey,
        userId: user.id,
        audio,
        model: activeModel,
        prompt
      }))
      detail = openAiErrorMessage(body)
    }

    if (!response.ok) {
      return json({
        error: 'OpenAI transcription failed.',
        status: response.status,
        detail,
        hint: transcriptionHint(detail)
      }, { status: response.status, headers })
    }

    const transcript = typeof body === 'string' ? body : body?.text || body?.transcript || ''
    return json({
      transcript: clipText(transcript, 2000),
      model: activeModel,
      durationMs: Date.now() - startedAt,
      usage: typeof body === 'object' && body ? body.usage || null : null
    }, { headers })
  } catch (error) {
    return json({
      error: 'Unable to transcribe Sideline AI audio.',
      detail: error?.message || String(error)
    }, { status: 500, headers })
  }
}
