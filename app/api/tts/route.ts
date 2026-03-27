import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string') {
      return new Response('Missing text', { status: 400 })
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'nPczCjzI2devNBz1zQrb' // Brian - calm, warm
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      return new Response('ElevenLabs API key not configured', { status: 500 })
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: false,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('ElevenLabs TTS error:', error)
      return new Response('TTS generation failed', { status: 500 })
    }

    const audioBuffer = await response.arrayBuffer()

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('TTS route error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
