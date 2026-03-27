import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.CARTESIA_API_KEY
  if (!apiKey) return new Response('Cartesia key not configured', { status: 500 })

  const form = await req.formData()
  const file = form.get('file')

  if (!(file instanceof File)) {
    return new Response('Missing audio file', { status: 400 })
  }

  const upstream = new FormData()
  upstream.append('model', 'ink-whisper')
  upstream.append('language', 'en')
  upstream.append('file', file, file.name || 'recording.webm')

  const res = await fetch('https://api.cartesia.ai/stt', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Cartesia-Version': '2026-03-01',
    },
    body: upstream,
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('Cartesia STT error:', error)
    return new Response('Speech transcription failed', { status: res.status })
  }

  const data = await res.json() as { text?: string }
  return Response.json({ text: data.text ?? '' })
}
