'use client'

import { motion, useAnimationControls } from 'framer-motion'
import { useEffect } from 'react'

export type DuckState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface DuckProps {
  state: DuckState
  size?: number
}

export default function Duck({ state, size = 120 }: DuckProps) {
  const controls = useAnimationControls()

  useEffect(() => {
    if (state === 'idle') {
      controls.start({
        y: [0, -4, 0],
        transition: {
          duration: 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      })
    } else if (state === 'listening') {
      controls.start({
        y: [0, -6, 0],
        scale: [1, 1.03, 1],
        transition: {
          duration: 1.8,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      })
    } else if (state === 'thinking') {
      controls.start({
        rotate: [-2, 2, -2],
        transition: {
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      })
    } else if (state === 'speaking') {
      controls.start({
        y: [0, -8, 0, -4, 0],
        scale: [1, 1.05, 1, 1.03, 1],
        transition: {
          duration: 0.8,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      })
    }
  }, [state, controls])

  const isActive = state === 'listening' || state === 'speaking'
  const isThinking = state === 'thinking'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer glow ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 1.6,
          height: size * 1.6,
          background: 'radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)',
        }}
        animate={{
          opacity: isActive ? [0.5, 1, 0.5] : isThinking ? [0.3, 0.6, 0.3] : [0.2, 0.4, 0.2],
          scale: isActive ? [0.95, 1.05, 0.95] : [0.98, 1.02, 0.98],
        }}
        transition={{
          duration: isActive ? 1.5 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Inner pulse ring */}
      {isActive && (
        <motion.div
          className="absolute rounded-full border border-amber-400/20"
          style={{ width: size * 1.2, height: size * 1.2 }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      )}

      {/* Duck SVG */}
      <motion.div animate={controls} style={{ originX: '50%', originY: '80%' }}>
        <svg
          width={size * 0.85}
          height={size * 0.85}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Body */}
          <motion.ellipse
            cx="50"
            cy="65"
            rx="32"
            ry="24"
            fill="#F5A623"
            animate={{
              fill: isActive ? ['#F5A623', '#f7b83a', '#F5A623'] : '#F5A623',
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />

          {/* Body shading */}
          <ellipse cx="50" cy="68" rx="28" ry="18" fill="rgba(0,0,0,0.12)" />
          <ellipse cx="44" cy="60" rx="16" ry="10" fill="rgba(255,255,255,0.08)" />

          {/* Wing */}
          <ellipse
            cx="62"
            cy="67"
            rx="14"
            ry="9"
            fill="#e6981f"
            transform="rotate(-15 62 67)"
          />

          {/* Neck */}
          <path
            d="M 42 48 Q 38 38 44 30 Q 46 26 50 25 Q 54 24 56 28 Q 60 36 56 46 Q 54 50 50 51 Q 46 52 42 48 Z"
            fill="#F5A623"
          />

          {/* Head */}
          <motion.circle
            cx="52"
            cy="24"
            r="16"
            fill="#F5A623"
            animate={{
              fill: isActive ? ['#F5A623', '#f7b83a', '#F5A623'] : '#F5A623',
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          />

          {/* Head shading */}
          <circle cx="48" cy="20" r="8" fill="rgba(255,255,255,0.07)" />

          {/* Eye */}
          <circle cx="58" cy="20" r="4" fill="#0a0a0a" />
          <circle cx="59.5" cy="18.5" r="1.2" fill="rgba(255,255,255,0.7)" />

          {/* Beak */}
          <motion.path
            d="M 64 24 Q 74 22 73 26 Q 72 30 62 28 Z"
            fill="#e08800"
            animate={
              state === 'speaking'
                ? { d: ['M 64 24 Q 74 22 73 26 Q 72 30 62 28 Z', 'M 64 25 Q 74 21 73 27 Q 72 32 62 29 Z', 'M 64 24 Q 74 22 73 26 Q 72 30 62 28 Z'] }
                : {}
            }
            transition={{ duration: 0.4, repeat: Infinity }}
          />

          {/* Beak highlight */}
          <path d="M 65 24 Q 71 22 72 25 Q 69 23 65 24 Z" fill="rgba(255,255,255,0.2)" />

          {/* Feet */}
          <ellipse cx="40" cy="87" rx="10" ry="4" fill="#e08800" transform="rotate(-10 40 87)" />
          <ellipse cx="60" cy="87" rx="10" ry="4" fill="#e08800" transform="rotate(10 60 87)" />

          {/* Thinking dots */}
          {isThinking && (
            <>
              <motion.circle
                cx="78"
                cy="12"
                r="2"
                fill="#F5A623"
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
              />
              <motion.circle
                cx="85"
                cy="7"
                r="2.5"
                fill="#F5A623"
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
              />
              <motion.circle
                cx="92"
                cy="2"
                r="3"
                fill="#F5A623"
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
              />
            </>
          )}
        </svg>
      </motion.div>

      {/* State label */}
      <motion.div
        className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        key={state}
      >
        <span className="text-[10px] tracking-[0.2em] uppercase text-[#F5A623]/50 font-light">
          {state === 'idle' && 'waiting'}
          {state === 'listening' && 'listening'}
          {state === 'thinking' && 'thinking'}
          {state === 'speaking' && 'speaking'}
        </span>
      </motion.div>
    </div>
  )
}
