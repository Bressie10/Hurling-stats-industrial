import { json } from '@sveltejs/kit'
import { OPENAI_API_KEY } from '$env/static/private'

export const prerender = false

const REALTIME_MODEL = 'gpt-realtime-2'

export async function POST({ request }) {
  const apiKey = OPENAI_API_KEY
  const headers = { 'Cache-Control': 'no-store' }

  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500, headers })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': request.headers.get('x-sideline-user') || 'sideline-ai'
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          audio: {
            output: {
              voice: 'marin'
            }
          }
        }
      })
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return json({
        error: 'OpenAI Realtime session creation failed.',
        status: response.status,
        detail: data?.error?.message || data?.error || null
      }, { status: response.status, headers })
    }

    const clientSecret = data?.client_secret || (data?.value ? {
      value: data.value,
      expires_at: data.expires_at
    } : null)

    if (!clientSecret?.value) {
      return json({
        error: 'OpenAI Realtime session response was missing a client secret.',
        responseKeys: data && typeof data === 'object' ? Object.keys(data) : []
      }, { status: 502, headers })
    }

    return json({
      model: REALTIME_MODEL,
      client_secret: clientSecret,
      session: data?.session || null
    }, { headers })
  } catch (error) {
    return json({
      error: 'Unable to create OpenAI Realtime session.',
      detail: error?.message || String(error)
    }, { status: 500, headers })
  }
}
