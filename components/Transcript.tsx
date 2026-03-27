'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface Message {
  id: string
  role: 'user' | 'duck'
  text: string
  partial?: boolean
}

interface TranscriptProps {
  messages: Message[]
  partialTranscript: string
}

export default function Transcript({ messages, partialTranscript }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partialTranscript])

  if (messages.length === 0 && !partialTranscript) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.p
          className="text-[#3a3632] text-sm tracking-widest uppercase font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          speak, and I'll listen
        </motion.p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`flex ${msg.role === 'duck' ? 'justify-start' : 'justify-end'}`}
          >
            {msg.role === 'duck' ? (
              <div className="max-w-[75%]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-[#F5A623]/60" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#F5A623]/40 font-light">
                    quack
                  </span>
                </div>
                <p
                  className="font-serif text-[#e8e3da] text-lg leading-relaxed italic"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {msg.text}
                  {msg.partial && (
                    <motion.span
                      className="inline-block w-1 h-4 bg-[#F5A623] ml-1 align-middle"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </p>
              </div>
            ) : (
              <div className="max-w-[75%]">
                <p
                  className="text-[#6b6660] text-base leading-relaxed font-light text-right"
                  style={{ letterSpacing: '0.01em' }}
                >
                  {msg.text}
                </p>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Partial live transcript */}
      {partialTranscript && (
        <motion.div
          className="flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p
            className="max-w-[75%] text-[#4a4640] text-base leading-relaxed font-light text-right"
            style={{ letterSpacing: '0.01em' }}
          >
            {partialTranscript}
            <motion.span
              className="inline-block w-0.5 h-4 bg-[#F5A623]/40 ml-1 align-middle"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          </p>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
