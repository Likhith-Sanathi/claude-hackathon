export async function speakText(text: string): Promise<void> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`TTS error: ${res.status}`)

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)

  return new Promise((resolve, reject) => {
    const cleanup = () => URL.revokeObjectURL(url)
    audio.onended = () => { cleanup(); resolve() }
    audio.onerror = () => {
      cleanup()
      reject(new Error('Audio playback failed'))
    }
    audio.play().catch((error) => {
      cleanup()
      reject(error)
    })
  })
}

export async function transcribeAudio(audio: Blob): Promise<string> {
  const mimeType = audio.type || 'audio/webm'
  const extension = mimeType.includes('mp4')
    ? 'm4a'
    : mimeType.includes('ogg')
    ? 'ogg'
    : 'webm'

  const formData = new FormData()
  formData.append('file', new File([audio], `recording.${extension}`, { type: mimeType }))

  const res = await fetch('/api/stt', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) throw new Error(`STT error: ${res.status}`)

  const data = await res.json() as { text?: string }
  return data.text ?? ''
}
