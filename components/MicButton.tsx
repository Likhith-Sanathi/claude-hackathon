'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { DuckState } from './Duck'

interface MicButtonProps {
  state: DuckState
  onPressStart: () => void
  onPressEnd: () => void
}

export default function MicButton({ state, onPressStart, onPressEnd }: MicButtonProps) {
  const isRecording = state === 'listening'
  const isDisabled = state === 'thinking' || state === 'speaking'
  const holdingRef = useRef(false)

  const handleStart = () => {
    if (isDisabled || holdingRef.current) return
    holdingRef.current = true
    onPressStart()
  }

  const handleEnd = () => {
    if (!holdingRef.current) return
    holdingRef.current = false
    onPressEnd()
  }

  // Prevent context menu on long-press mobile
  const onContextMenu = (e: React.MouseEvent) => e.preventDefault()

  useEffect(() => {
    // Cancel hold if pointer leaves window (e.g. dragged out)
    const onPointerUp = () => {
      if (!holdingRef.current) return
      holdingRef.current = false
      onPressEnd()
    }
    window.addEventListener('pointerup', onPointerUp)
    return () => window.removeEventListener('pointerup', onPointerUp)
  }, [onPressEnd])

  const label = isRecording ? 'release to send' : isDisabled ? '...' : 'hold to speak'

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.button
        onPointerDown={handleStart}
        onPointerUp={handleEnd}
        onPointerLeave={handleEnd}
        onPointerCancel={handleEnd}
        onContextMenu={onContextMenu}
        draggable={false}
        disabled={isDisabled}
        className="relative flex items-center justify-center rounded-full cursor-pointer select-none touch-none disabled:cursor-not-allowed"
        style={{ width: 80, height: 80 }}
        animate={{ scale: isRecording ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* Pulse rings while recording */}
        {isRecording && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[#F5A623]"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border border-[#F5A623]/40"
              animate={{ scale: [1, 1.9, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
            />
          </>
        )}

        {/* Fill */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            backgroundColor: isRecording
              ? 'rgba(245,166,35,0.2)'
              : isDisabled
              ? 'rgba(20,18,15,0.6)'
              : 'rgba(22,20,17,0.95)',
          }}
          transition={{ duration: 0.25 }}
        />

        {/* Border */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          animate={{
            borderColor: isRecording
              ? 'rgba(245,166,35,0.7)'
              : isDisabled
              ? 'rgba(40,38,35,0.4)'
              : 'rgba(58,54,50,0.5)',
          }}
          transition={{ duration: 0.25 }}
        />

        {/* Icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {isRecording ? (
            // Waveform bars while recording
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {[4, 7, 10, 13, 16, 19].map((x, i) => (
                <motion.rect
                  key={x}
                  x={x}
                  width={2}
                  rx={1}
                  fill="#F5A623"
                  animate={{ height: [4, 10, 4], y: [10, 7, 10] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </motion.g>
          ) : (
            // Mic icon
            <g opacity={isDisabled ? 0.25 : 0.85}>
              <rect x="9" y="2" width="6" height="12" rx="3" fill="#e8e3da" />
              <path d="M5 10a7 7 0 0 0 14 0" stroke="#e8e3da" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12" y2="21" stroke="#e8e3da" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9" y1="21" x2="15" y2="21" stroke="#e8e3da" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          )}
        </svg>
      </motion.button>

      <div className="flex flex-col items-center gap-1">
        <motion.span
          className="text-[10px] tracking-[0.2em] uppercase font-light"
          animate={{ color: isRecording ? 'rgba(245,166,35,0.8)' : 'rgba(107,102,96,0.6)' }}
          transition={{ duration: 0.25 }}
        >
          {label}
        </motion.span>
        {!isDisabled && !isRecording && (
          <span className="text-[9px] tracking-[0.15em] text-[#2a2a2a] uppercase font-light">
            or hold space
          </span>
        )}
      </div>
    </div>
  )
}
