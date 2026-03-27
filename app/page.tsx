'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Duck, { DuckState } from '@/components/Duck'
import Waveform from '@/components/Waveform'
import Transcript, { Message } from '@/components/Transcript'
import MicButton from '@/components/MicButton'
import { speakText } from '@/lib/elevenlabs'
import { ConversationMessage } from '@/lib/claude'

// ──────────────────────────────────────────────
// Silence-detection fallback (used when ElevenLabs
// WebSocket VAD is not available / STT is simplified)
// ──────────────────────────────────────────────
const SILENCE_MS = 2200

export default function QuackPage() {
  const [duckState, setDuckState] = useState<DuckState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [partialTranscript, setPartialTranscript] = useState('')
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const historyRef = useRef<ConversationMessage[]>([])
  const accumulatedRef = useRef('')
  const isDuckTurnRef = useRef(false)
  const isListeningRef = useRef(false)

  // ── cleanup ──────────────────────────────────
  const cleanupAudio = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: 'session.end' })) } catch {}
      }
      wsRef.current.close()
      wsRef.current = null
    }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setAnalyser(null)
    isListeningRef.current = false
  }, [])

  // ── call duck (Claude) ────────────────────────
  const callDuck = useCallback(async (userText: string) => {
    if (!userText.trim() || isDuckTurnRef.current) return
    isDuckTurnRef.current = true

    setDuckState('thinking')
    setPartialTranscript('')

    // Add user message to transcript
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText.trim(),
    }
    setMessages(prev => [...prev, userMsg])

    // Add user to history
    historyRef.current = [
      ...historyRef.current,
      { role: 'user', content: userText.trim() },
    ]

    // Create a streaming duck message placeholder
    const duckId = `duck-${Date.now()}`
    setMessages(prev => [...prev, { id: duckId, role: 'duck', text: '', partial: true }])

    try {
      const response = await fetch('/api/duck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: userText.trim(),
          history: historyRef.current.slice(-12),
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
        const chunk = decoder.decode(value, { stream: true })
        fullResponse += chunk

        setMessages(prev =>
          prev.map(m => m.id === duckId ? { ...m, text: fullResponse, partial: true } : m)
        )
      }

      // Mark message as complete
      setMessages(prev =>
        prev.map(m => m.id === duckId ? { ...m, text: fullResponse, partial: false } : m)
      )

      // Add duck to history
      historyRef.current = [
        ...historyRef.current,
        { role: 'assistant', content: fullResponse },
      ]

      // Speak it
      if (fullResponse.trim()) {
        try {
          await speakText(fullResponse)
        } catch (e) {
          console.warn('TTS failed, continuing silently:', e)
        }
      }
    } catch (e) {
      console.error('Duck call failed:', e)
      setMessages(prev => prev.filter(m => m.id !== duckId))
    } finally {
      isDuckTurnRef.current = false
      setDuckState(isListeningRef.current ? 'listening' : 'idle')
      accumulatedRef.current = ''
    }
  }, [])

  // ── start mic ─────────────────────────────────
  const startListening = useCallback(async () => {
    try {
      setError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })

      setHasPermission(true)
      streamRef.current = stream
      isListeningRef.current = true
      setDuckState('listening')

      // Set up Web Audio for waveform visualiser
      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      const analyserNode = audioCtx.createAnalyser()
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.8
      const src = audioCtx.createMediaStreamSource(stream)
      src.connect(analyserNode)
      setAnalyser(analyserNode)

      // ── ElevenLabs STT via WebSocket ──────────
      const elApiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
      if (elApiKey) {
        const ws = new WebSocket(
          `wss://api.elevenlabs.io/v1/speech-to-text/stream?xi-api-key=${elApiKey}`
        )
        wsRef.current = ws

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'session.start',
            session: { model: 'scribe_v1', language: 'en' }
          }))

          // Pipe raw PCM into WebSocket
          const wsAudioCtx = new AudioContext({ sampleRate: 16000 })
          const wsSrc = wsAudioCtx.createMediaStreamSource(stream)
          const proc = wsAudioCtx.createScriptProcessor(2048, 1, 1)
          processorRef.current = proc

          proc.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return
            const input = e.inputBuffer.getChannelData(0)
            const pcm = new Int16Array(input.length)
            for (let i = 0; i < input.length; i++) {
              pcm[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32767)))
            }
            ws.send(pcm.buffer)
          }

          wsSrc.connect(proc)
          proc.connect(wsAudioCtx.destination)
          sourceRef.current = wsSrc
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'transcript') {
              const text: string = data.transcript || ''
              if (data.is_final) {
                accumulatedRef.current += ' ' + text
                setPartialTranscript(accumulatedRef.current.trim())
                // Reset silence timer on speech
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
                silenceTimerRef.current = setTimeout(() => {
                  if (accumulatedRef.current.trim().length > 5 && !isDuckTurnRef.current) {
                    callDuck(accumulatedRef.current.trim())
                  }
                }, SILENCE_MS)
              } else {
                setPartialTranscript((accumulatedRef.current + ' ' + text).trim())
              }
            } else if (data.type === 'vad' && data.event === 'speech_end') {
              if (accumulatedRef.current.trim().length > 5 && !isDuckTurnRef.current) {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
                callDuck(accumulatedRef.current.trim())
              }
            }
          } catch {}
        }

        ws.onerror = () => {
          console.warn('ElevenLabs STT WS error — falling back to MediaRecorder STT')
          fallbackSTT(stream)
        }
      } else {
        // No ElevenLabs key: use browser's SpeechRecognition fallback
        fallbackSTT(stream)
      }
    } catch (e: unknown) {
      console.error('Mic error:', e)
      const msg = e instanceof Error ? e.message : 'Microphone access denied'
      setError(msg)
      setDuckState('idle')
    }
  }, [callDuck])

  // ── Web Speech API fallback ───────────────────
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const fallbackSTT = useCallback((stream: MediaStream) => {
    const SR = (window.SpeechRecognition || window.webkitSpeechRecognition) as typeof SpeechRecognition | undefined

    if (!SR) {
      setError('Speech recognition not available in this browser. Please use Chrome.')
      return
    }

    const recognition = new SR()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (final) {
        accumulatedRef.current += ' ' + final
        setPartialTranscript(accumulatedRef.current.trim())

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(() => {
          if (accumulatedRef.current.trim().length > 5 && !isDuckTurnRef.current) {
            callDuck(accumulatedRef.current.trim())
          }
        }, SILENCE_MS)
      } else {
        setPartialTranscript((accumulatedRef.current + ' ' + interim).trim())
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
    }

    recognition.onend = () => {
      // Restart if still listening
      if (isListeningRef.current) {
        try { recognition.start() } catch {}
      }
    }

    recognition.start()
  }, [callDuck])

  // ── stop mic ──────────────────────────────────
  const stopListening = useCallback(() => {
    isListeningRef.current = false
    setDuckState('idle')
    setPartialTranscript('')

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }

    cleanupAudio()
  }, [cleanupAudio])

  // ── toggle ────────────────────────────────────
  const handleToggle = useCallback(() => {
    if (duckState === 'listening') {
      stopListening()
    } else if (duckState === 'idle') {
      startListening()
    }
  }, [duckState, startListening, stopListening])

  // Cleanup on unmount
  useEffect(() => () => { cleanupAudio() }, [cleanupAudio])

  return (
    <div className="grain relative min-h-screen flex flex-col overflow-hidden">
      {/* Ambient background gradient */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(245,166,35,0.04) 0%, transparent 100%)',
        }}
      />

      {/* Header */}
      <motion.header
        className="relative z-10 flex items-center justify-between px-8 pt-8 pb-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <h1
            className="font-serif text-2xl text-[#e8e3da]"
            style={{ letterSpacing: '-0.02em', lineHeight: 1 }}
          >
            Quack
          </h1>
          <p
            className="text-[#3a3632] text-[10px] tracking-[0.25em] uppercase mt-1 font-light"
          >
            think out loud
          </p>
        </div>

        {/* Session indicator */}
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
      </motion.header>

      {/* Main layout */}
      <div className="relative z-10 flex flex-col flex-1 max-w-2xl w-full mx-auto px-4">

        {/* Duck + waveform */}
        <motion.div
          className="flex flex-col items-center gap-10 pt-10 pb-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <Duck state={duckState} size={140} />

          <div className="w-full flex flex-col items-center gap-6">
            <Waveform analyser={analyser} active={duckState === 'listening'} />
            <MicButton state={duckState} onToggle={handleToggle} />
          </div>
        </motion.div>

        {/* Divider */}
        <motion.div
          className="w-full h-px bg-gradient-to-r from-transparent via-[#2a2a2a] to-transparent my-2"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        />

        {/* Transcript */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0" style={{ maxHeight: '40vh' }}>
          <Transcript messages={messages} partialTranscript={partialTranscript} />
        </div>
      </div>

      {/* Error toast */}
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

      {/* First-time prompt overlay */}
      <AnimatePresence>
        {!hasPermission && duckState === 'idle' && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.8 }}
            className="pointer-events-none absolute bottom-24 left-0 right-0 flex justify-center"
          >
            <p className="text-[#2a2a2a] text-xs tracking-widest uppercase font-light">
              tap the mic to begin
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
