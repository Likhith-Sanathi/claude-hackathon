'use client'

import { motion } from 'framer-motion'
import { DuckState } from './Duck'

interface MicButtonProps {
  state: DuckState
  onToggle: () => void
}

export default function MicButton({ state, onToggle }: MicButtonProps) {
  const isActive = state === 'listening'
  const isDisabled = state === 'thinking' || state === 'speaking'

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        onClick={onToggle}
        disabled={isDisabled}
        className="relative flex items-center justify-center rounded-full cursor-pointer select-none disabled:cursor-not-allowed"
        style={{ width: 64, height: 64 }}
        whileHover={!isDisabled ? { scale: 1.05 } : {}}
        whileTap={!isDisabled ? { scale: 0.95 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {/* Animated ring */}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[#F5A623]"
            animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}

        {/* Button fill */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            background: isActive
              ? 'radial-gradient(circle, rgba(245,166,35,0.25) 0%, rgba(245,166,35,0.1) 100%)'
              : isDisabled
              ? 'radial-gradient(circle, rgba(58,54,50,0.5) 0%, rgba(26,26,26,0.5) 100%)'
              : 'radial-gradient(circle, rgba(30,28,25,0.9) 0%, rgba(20,18,15,0.9) 100%)',
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Border */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          animate={{
            borderColor: isActive
              ? 'rgba(245,166,35,0.6)'
              : isDisabled
              ? 'rgba(58,54,50,0.3)'
              : 'rgba(58,54,50,0.5)',
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Icon */}
        <motion.svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          animate={{
            opacity: isDisabled ? 0.3 : 1,
          }}
        >
          {isActive ? (
            // Stop/square icon when listening
            <motion.rect
              x="7"
              y="7"
              width="10"
              height="10"
              rx="1"
              fill="#F5A623"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            />
          ) : (
            // Mic icon when idle
            <>
              <rect x="9" y="2" width="6" height="12" rx="3" fill="#e8e3da" opacity={isDisabled ? 0.3 : 0.8} />
              <path
                d="M5 10a7 7 0 0 0 14 0"
                stroke="#e8e3da"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity={isDisabled ? 0.3 : 0.8}
              />
              <line x1="12" y1="17" x2="12" y2="21" stroke="#e8e3da" strokeWidth="1.5" strokeLinecap="round" opacity={isDisabled ? 0.3 : 0.8} />
              <line x1="9" y1="21" x2="15" y2="21" stroke="#e8e3da" strokeWidth="1.5" strokeLinecap="round" opacity={isDisabled ? 0.3 : 0.8} />
            </>
          )}
        </motion.svg>
      </motion.button>

      <motion.span
        className="text-[10px] tracking-[0.2em] uppercase font-light"
        animate={{
          color: isActive ? 'rgba(245,166,35,0.7)' : 'rgba(107,102,96,0.6)',
        }}
        transition={{ duration: 0.3 }}
      >
        {isActive ? 'tap to stop' : isDisabled ? '...' : 'tap to speak'}
      </motion.span>
    </div>
  )
}
