import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text || typeof text !== 'string') return new Response('Missing text', { status: 400 })

  const apiKey = process.env.CARTESIA_API_KEY
  const voiceId = process.env.CARTESIA_VOICE_ID ?? 'a0e99841-438c-4a64-b679-ae501e7d6091'

  if (!apiKey) return new Response('Cartesia key not configured', { status: 500 })

  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Cartesia-Version': '2026-03-01',
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      model_id: 'sonic-2',
      transcript: text,
      voice: { mode: 'id', id: voiceId },
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
      language: 'en',
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('Cartesia TTS error:', error)
    return new Response('TTS failed', { status: res.status })
  }

  const audio = await res.arrayBuffer()
  return new Response(audio, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' },
  })
}
