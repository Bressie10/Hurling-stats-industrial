import { text } from '@sveltejs/kit'
import { OPENAI_API_KEY } from '$env/static/private'

export const prerender = false

const REALTIME_MODEL = 'gpt-realtime-2'
const SESSION_CONFIG = {
  type: 'realtime',
  model: REALTIME_MODEL,
  audio: {
    output: {
      voice: 'marin'
    }
  }
}

export async function POST({ request }) {
  const headers = { 'Cache-Control': 'no-store' }

  if (!OPENAI_API_KEY) {
    return text('OPENAI_API_KEY is not configured.', { status: 500, headers })
  }

  const sdp = await request.text()
  if (!sdp?.trim()) {
    return text('Missing WebRTC offer SDP.', { status: 400, headers })
  }

  try {
    const formData = new FormData()
    formData.set('sdp', sdp)
    formData.set('session', JSON.stringify(SESSION_CONFIG))

    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Safety-Identifier': request.headers.get('x-sideline-user') || 'sideline-ai'
      },
      body: formData
    })

    const body = await response.text().catch(() => '')

    if (!response.ok) {
      return text(body || 'OpenAI Realtime WebRTC connection failed.', {
        status: response.status,
        headers
      })
    }

    return text(body, { headers })
  } catch (error) {
    return text(error?.message || 'Unable to connect to OpenAI Realtime.', {
      status: 500,
      headers
    })
  }
}
