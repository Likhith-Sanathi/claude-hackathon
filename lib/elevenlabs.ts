// ElevenLabs TTS via API route (avoids exposing key client-side)
export async function speakText(text: string): Promise<void> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    throw new Error(`TTS error: ${response.status}`)
  }

  const audioBlob = await response.blob()
  const audioUrl = URL.createObjectURL(audioBlob)
  const audio = new Audio(audioUrl)

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      resolve()
    }
    audio.onerror = reject
    audio.play().catch(reject)
  })
}

// ElevenLabs STT via WebSocket
// Returns an object with start/stop controls and callbacks
export interface STTController {
  start: () => Promise<void>
  stop: () => void
}

export function createSTTSession(
  onPartial: (text: string) => void,
  onFinal: (text: string) => void,
  onVADSilence: () => void,
  getStream: () => MediaStream | null
): STTController {
  let ws: WebSocket | null = null
  let processor: ScriptProcessorNode | null = null
  let audioContext: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let lastTranscript = ''
  let isConnected = false

  const SILENCE_THRESHOLD_MS = 2000 // 2 seconds of silence triggers duck

  const resetSilenceTimer = () => {
    if (silenceTimer) clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      if (lastTranscript.trim().length > 5) {
        onVADSilence()
      }
    }, SILENCE_THRESHOLD_MS)
  }

  const start = async () => {
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
    if (!apiKey) {
      console.error('ElevenLabs API key not set')
      return
    }

    const stream = getStream()
    if (!stream) {
      console.error('No media stream available')
      return
    }

    // Use ElevenLabs Scribe v2 Realtime WebSocket
    const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/stream?xi-api-key=${apiKey}`
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      isConnected = true

      // Send initial config
      ws!.send(JSON.stringify({
        type: 'session.start',
        session: {
          model: 'scribe_v1',
          language: 'en',
          disable_default_filler_audio: true,
        }
      }))

      // Set up audio pipeline
      audioContext = new AudioContext({ sampleRate: 16000 })
      source = audioContext.createMediaStreamSource(stream)
      processor = audioContext.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (!isConnected || ws?.readyState !== WebSocket.OPEN) return
        const inputData = e.inputBuffer.getChannelData(0)
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, Math.round(inputData[i] * 32767)))
        }
        ws!.send(pcmData.buffer)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'transcript') {
          if (data.transcript) {
            lastTranscript = data.transcript
            if (data.is_final) {
              onFinal(data.transcript)
            } else {
              onPartial(data.transcript)
              resetSilenceTimer()
            }
          }
        } else if (data.type === 'vad') {
          // Voice activity detection events
          if (data.event === 'speech_end' && lastTranscript.trim().length > 5) {
            if (silenceTimer) clearTimeout(silenceTimer)
            onVADSilence()
          }
        }
      } catch {
        // Binary data or non-JSON, skip
      }
    }

    ws.onerror = (e) => {
      console.error('STT WebSocket error:', e)
    }

    ws.onclose = () => {
      isConnected = false
    }
  }

  const stop = () => {
    isConnected = false

    if (silenceTimer) clearTimeout(silenceTimer)

    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'session.end' }))
      }
      ws.close()
      ws = null
    }

    if (processor) {
      processor.disconnect()
      processor = null
    }

    if (source) {
      source.disconnect()
      source = null
    }

    if (audioContext) {
      audioContext.close()
      audioContext = null
    }

    lastTranscript = ''
  }

  return { start, stop }
}
