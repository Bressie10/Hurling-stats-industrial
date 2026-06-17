import { json } from '@sveltejs/kit'
import { env as privateEnv } from '$env/dynamic/private'
import { env as publicEnv } from '$env/dynamic/public'

export const prerender = false

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_BODY_BYTES = 128 * 1024
const MAX_QUESTION_CHARS = 700
const MAX_CONTEXT_CHARS = 14000
const MAX_ANSWER_CHARS = 900

function clipText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function bearerToken(request) {
  const auth = request.headers.get('authorization') || ''
  return auth.match(/^Bearer\s+(.+)$/i)?.[1] || ''
}

function openAiErrorMessage(body) {
  if (!body) return ''
  if (typeof body === 'string') return body
  return body?.error?.message || body?.error || body?.message || ''
}

function contextJson(context) {
  try {
    return clipText(JSON.stringify(context || {}, null, 2), MAX_CONTEXT_CHARS)
  } catch {
    return '{}'
  }
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

async function answerWithOpenAi({ apiKey, userId, model, question, context }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': userId
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content: [
            'You are Sideline AI, a hurling match-day assistant for a coach.',
            'Answer only from the supplied live match context. If data is missing, say so briefly.',
            'Use concrete numbers, player names, jersey numbers, score, puckouts, shooting, turnovers, and conceded data when relevant.',
            'For next-step questions, give two or three direct coaching actions based on the stats.',
            'Do not invent events, injuries, traits, or private knowledge. Do not log, undo, or confirm match events.',
            'Keep the answer suitable for text-to-speech: concise, plain, and under 80 words.'
          ].join(' ')
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nLive match context JSON:\n${context}`
        }
      ]
    })
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

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Answer request is too large.' }, { status: 413, headers })
  }

  const token = bearerToken(request)
  if (!token) {
    return json({ error: 'Sign in required.' }, { status: 401, headers })
  }

  const user = await verifySupabaseUser(token, supabaseUrl, supabaseAnonKey)
  if (!user?.id) {
    return json({ error: 'Authentication required.' }, { status: 401, headers })
  }

  const payload = await request.json().catch(() => null)
  const question = clipText(payload?.question, MAX_QUESTION_CHARS)
  if (!question) {
    return json({ error: 'Missing question.' }, { status: 400, headers })
  }

  const model = privateEnv.SIDELINE_ANSWER_MODEL || DEFAULT_MODEL
  const startedAt = Date.now()

  try {
    const { response, body } = await answerWithOpenAi({
      apiKey,
      userId: user.id,
      model,
      question,
      context: contextJson(payload?.context)
    })

    if (!response.ok) {
      const detail = openAiErrorMessage(body)
      return json({
        error: 'OpenAI answer failed.',
        status: response.status,
        detail,
        hint: /model|does not exist|not found|unsupported/i.test(detail)
          ? 'Set SIDELINE_ANSWER_MODEL to a chat-capable OpenAI model and redeploy.'
          : 'Sideline AI answer failed. Local match summary is still available.'
      }, { status: response.status, headers })
    }

    const answer = body?.choices?.[0]?.message?.content || ''
    return json({
      answer: clipText(answer, MAX_ANSWER_CHARS),
      model,
      durationMs: Date.now() - startedAt,
      usage: body?.usage || null
    }, { headers })
  } catch (error) {
    return json({
      error: 'Unable to answer Sideline AI question.',
      detail: error?.message || String(error)
    }, { status: 500, headers })
  }
}
