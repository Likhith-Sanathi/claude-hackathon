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

  const onContextMenu = (e: React.MouseEvent) => e.preventDefault()

  useEffect(() => {
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
    <div className="flex flex-col items-center gap-5">
      {/* Outer glow layer */}
      <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
        {/* Ambient glow */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 120, height: 120 }}
          animate={{
            boxShadow: isRecording
              ? '0 0 60px 20px rgba(245,166,35,0.35), 0 0 120px 40px rgba(245,166,35,0.12)'
              : isDisabled
              ? '0 0 0px 0px rgba(245,166,35,0)'
              : '0 0 40px 8px rgba(245,166,35,0.08)',
          }}
          transition={{ duration: 0.4 }}
        />

        {/* Expanding pulse rings (recording only) */}
        {isRecording && (
          <>
            <motion.div
              className="absolute rounded-full border border-[#F5A623]/50"
              style={{ width: 120, height: 120 }}
              animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full border border-[#F5A623]/25"
              style={{ width: 120, height: 120 }}
              animate={{ scale: [1, 2.2], opacity: [0.35, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
            />
          </>
        )}

        {/* Main button */}
        <motion.button
          onPointerDown={handleStart}
          onPointerUp={handleEnd}
          onPointerLeave={handleEnd}
          onPointerCancel={handleEnd}
          onContextMenu={onContextMenu}
          draggable={false}
          disabled={isDisabled}
          className="relative flex items-center justify-center rounded-full cursor-pointer select-none touch-none disabled:cursor-not-allowed overflow-hidden"
          style={{ width: 120, height: 120 }}
          animate={{ scale: isRecording ? 1.06 : 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          {/* Glassmorphism background */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ backdropFilter: 'blur(12px)' }}
            animate={{
              backgroundColor: isRecording
                ? 'rgba(245,166,35,0.15)'
                : isDisabled
                ? 'rgba(15,13,10,0.7)'
                : 'rgba(22,19,15,0.75)',
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Inner ring border */}
          <motion.div
            className="absolute rounded-full"
            style={{ inset: 2 }}
            animate={{
              boxShadow: isRecording
                ? 'inset 0 0 0 1px rgba(245,166,35,0.6), inset 0 0 20px rgba(245,166,35,0.1)'
                : isDisabled
                ? 'inset 0 0 0 1px rgba(40,36,30,0.4)'
                : 'inset 0 0 0 1px rgba(70,62,52,0.5)',
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Icon */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="relative z-10">
            {isRecording ? (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                {[3, 6.5, 10, 13.5, 17, 20.5].map((x, i) => (
                  <motion.rect
                    key={x}
                    x={x}
                    width={2}
                    rx={1}
                    fill="#F5A623"
                    animate={{ height: [3, 12, 3], y: [10.5, 6, 10.5] }}
                    transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.09, ease: 'easeInOut' }}
                  />
                ))}
              </motion.g>
            ) : (
              <motion.g
                animate={{ opacity: isDisabled ? 0.2 : 0.9 }}
                transition={{ duration: 0.25 }}
              >
                <rect x="9" y="2" width="6" height="12" rx="3" fill="#e8e3da" />
                <path d="M5 10a7 7 0 0 0 14 0" stroke="#e8e3da" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21" stroke="#e8e3da" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="9" y1="21" x2="15" y2="21" stroke="#e8e3da" strokeWidth="1.5" strokeLinecap="round" />
              </motion.g>
            )}
          </svg>
        </motion.button>
      </div>

      {/* Labels */}
      <div className="flex flex-col items-center gap-1">
        <motion.span
          className="text-[10px] tracking-[0.22em] uppercase font-light"
          animate={{ color: isRecording ? 'rgba(245,166,35,0.9)' : 'rgba(107,102,96,0.55)' }}
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
