'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Duck, { DuckState } from '@/components/Duck'
import Starfield from '@/components/Starfield'
import Waveform from '@/components/Waveform'
import Transcript, { Message } from '@/components/Transcript'
import MicButton from '@/components/MicButton'
import { speakText, transcribeAudio } from '@/lib/voice'
import { ConversationMessage } from '@/lib/claude'

export default function QuackPage() {
  const [duckState, setDuckState] = useState<DuckState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [partialTranscript, setPartialTranscript] = useState('')
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'mirror' | 'assistant'>('mirror')
  const [speechUnavailable, setSpeechUnavailable] = useState(false)
  const [textInput, setTextInput] = useState('')

  const modeRef = useRef<'mirror' | 'assistant'>('mirror')
  const historyRef = useRef<ConversationMessage[]>([])
  const isDuckTurnRef = useRef(false)
  const isRecordingRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const cleanupAudio = useCallback(() => {
    mediaRecorderRef.current = null
    chunksRef.current = []
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    audioContextRef.current?.close()
    audioContextRef.current = null
    setAnalyser(null)
  }, [])

  const callDuck = useCallback(async (userText: string) => {
    if (!userText.trim() || isDuckTurnRef.current) return
    isDuckTurnRef.current = true

    setDuckState('thinking')
    setPartialTranscript('')

    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', text: userText.trim() }
    setMessages(prev => [...prev, userMsg])
    historyRef.current = [...historyRef.current, { role: 'user', content: userText.trim() }]

    const duckId = `duck-${Date.now()}`
    setMessages(prev => [...prev, { id: duckId, role: 'duck', text: '', partial: true }])

    try {
      const response = await fetch('/api/duck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: userText.trim(),
          history: historyRef.current.slice(-12),
          mode: modeRef.current,
        }),
      })

      if (!response.ok) throw new Error('Duck API failed')

      setDuckState('speaking')

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullResponse += decoder.decode(value, { stream: true })
        setMessages(prev =>
          prev.map(message =>
            message.id === duckId ? { ...message, text: fullResponse, partial: true } : message
          )
        )
      }

      setMessages(prev =>
        prev.map(message =>
          message.id === duckId ? { ...message, text: fullResponse, partial: false } : message
        )
      )
      historyRef.current = [...historyRef.current, { role: 'assistant', content: fullResponse }]

      if (fullResponse.trim()) {
        try {
          await speakText(fullResponse)
        } catch (e) {
          console.warn('TTS failed, continuing silently:', e)
        }
      }
    } catch (e) {
      console.error('Duck call failed:', e)
      setMessages(prev => prev.filter(message => message.id !== duckId))
      setError('Duck response failed')
    } finally {
      isDuckTurnRef.current = false
      setDuckState('idle')
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isDuckTurnRef.current) return
    setError(null)
    setSpeechUnavailable(false)
    setPartialTranscript('')

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSpeechUnavailable(true)
      setError('Voice input is not supported in this browser — type below instead')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.8
      audioContext.createMediaStreamSource(stream).connect(analyserNode)
      setAnalyser(analyserNode)

      const supportedMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ].find(type => MediaRecorder.isTypeSupported(type))

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        isRecordingRef.current = false
        cleanupAudio()
        setDuckState('idle')
        setError('Recording failed')
      }

      recorder.start(250)
      mediaRecorderRef.current = recorder
      isRecordingRef.current = true
      setDuckState('listening')
      setPartialTranscript('Listening…')
    } catch (e) {
      console.error('Recording start failed:', e)
      cleanupAudio()
      setError('Microphone access denied')
    }
  }, [cleanupAudio])

  const stopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return
    isRecordingRef.current = false

    const recorder = mediaRecorderRef.current
    if (!recorder) {
      cleanupAudio()
      setDuckState('idle')
      setPartialTranscript('')
      return
    }

    setDuckState('thinking')
    setPartialTranscript('Transcribing…')

    const mimeType = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm'
    const audioBlobPromise = new Promise<Blob>((resolve, reject) => {
      recorder.addEventListener(
        'stop',
        () => resolve(new Blob(chunksRef.current, { type: mimeType })),
        { once: true }
      )
      recorder.addEventListener(
        'error',
        () => reject(new Error('Recorder stop failed')),
        { once: true }
      )
    })

    try {
      recorder.stop()
      const audioBlob = await audioBlobPromise
      cleanupAudio()

      if (!audioBlob.size) {
        setPartialTranscript('')
        setDuckState('idle')
        setError('No audio was captured')
        return
      }

      const transcript = (await transcribeAudio(audioBlob)).trim()

      if (!transcript) {
        setPartialTranscript('')
        setDuckState('idle')
        setError('I could not hear anything. Try again.')
        return
      }

      setPartialTranscript(transcript)
      await callDuck(transcript)
    } catch (e) {
      console.error('Transcription failed:', e)
      cleanupAudio()
      setPartialTranscript('')
      setDuckState('idle')
      setError('Speech transcription failed')
    }
  }, [callDuck, cleanupAudio])

  const submitText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isDuckTurnRef.current) return
    setTextInput('')
    await callDuck(trimmed)
  }, [callDuck])

  useEffect(() => {
    let spaceDown = false

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || spaceDown || e.repeat) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (speechUnavailable) return
      e.preventDefault()
      spaceDown = true
      void startRecording()
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceDown = false
      void stopRecording()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [speechUnavailable, startRecording, stopRecording])

  useEffect(() => () => {
    isRecordingRef.current = false
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
    }
    cleanupAudio()
  }, [cleanupAudio])

  return (
    <div className="grain relative min-h-screen flex flex-col overflow-hidden">
      <Starfield count={250} />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(245,166,35,0.04) 0%, transparent 100%)',
        }}
      />

      <motion.header
        className="relative z-10 flex items-center justify-between px-8 pt-8 pb-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <h1 className="font-serif text-2xl text-[#e8e3da]" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
            Quack
          </h1>
          <p className="text-[#3a3632] text-[10px] tracking-[0.25em] uppercase mt-1 font-light">
            {mode === 'mirror' ? 'think out loud' : 'ask anything'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-full border border-[#2a2a2a] p-0.5 bg-[#111]">
            {(['mirror', 'assistant'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="relative px-3 py-1 rounded-full text-[10px] tracking-[0.12em] uppercase font-light"
                style={{ color: mode === m ? '#0a0a0a' : '#3a3632' }}
              >
                {mode === m && (
                  <motion.span
                    layoutId="mode-pill"
                    className="absolute inset-0 rounded-full bg-[#F5A623]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{m}</span>
              </button>
            ))}
          </div>

          <AnimatePresence>
            {messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623]/50" />
                <span className="text-[10px] text-[#3a3632] tracking-[0.15em] uppercase font-light">
                  {Math.floor(messages.length / 2)} exchange{messages.length / 2 !== 1 ? 's' : ''}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      <div className="relative z-10 flex flex-col flex-1 max-w-2xl w-full mx-auto px-4">
        <Duck state={duckState} />
        <motion.div
          className="flex flex-col items-center gap-10 pt-10 pb-8 relative z-10"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* State label */}
          <motion.div
            className="whitespace-nowrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={duckState}
          >
            <span className="text-[10px] tracking-[0.2em] uppercase text-[#F5A623]/50 font-light">
              {duckState === 'idle' && 'waiting'}
              {duckState === 'listening' && 'listening'}
              {duckState === 'thinking' && 'thinking'}
              {duckState === 'speaking' && 'speaking'}
            </span>
          </motion.div>

          <div className="w-full flex flex-col items-center gap-6">
            <Waveform analyser={analyser} active={duckState === 'listening'} />
            {speechUnavailable ? (
              <form
                className="w-full flex items-center gap-2"
                onSubmit={e => {
                  e.preventDefault()
                  void submitText(textInput)
                }}
              >
                <input
                  autoFocus
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder="Type your message…"
                  disabled={duckState === 'thinking' || duckState === 'speaking'}
                  className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-full px-5 py-2.5 text-sm text-[#e8e3da] placeholder:text-[#3a3632] font-light focus:outline-none focus:border-[#F5A623]/40 transition-colors disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || duckState === 'thinking' || duckState === 'speaking'}
                  className="w-10 h-10 rounded-full bg-[#F5A623] flex items-center justify-center disabled:opacity-30 transition-opacity"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 7h12M7 1l6 6-6 6" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            ) : (
              <MicButton state={duckState} onPressStart={() => { void startRecording() }} onPressEnd={() => { void stopRecording() }} />
            )}
          </div>
        </motion.div>

        <motion.div
          className="w-full h-px bg-linear-to-r from-transparent via-[#2a2a2a] to-transparent my-2"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        />

        <div className="flex-1 overflow-hidden flex flex-col min-h-0" style={{ maxHeight: '40vh' }}>
          <Transcript messages={messages} partialTranscript={partialTranscript} />
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#3a3632] px-5 py-3 rounded-lg"
          >
            <p className="text-sm text-[#6b6660] font-light">{error}</p>
            <button
              className="absolute top-2 right-3 text-[#3a3632] text-xs hover:text-[#6b6660]"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
