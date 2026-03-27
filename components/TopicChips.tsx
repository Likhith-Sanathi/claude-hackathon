'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface TopicChipsProps {
  topics: string[]
  onSelect: (topic: string) => void
}

export default function TopicChips({ topics, onSelect }: TopicChipsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 min-h-[28px]">
      <AnimatePresence mode="wait">
        {topics.map((topic, i) => (
          <motion.button
            key={topic}
            onClick={() => onSelect(topic)}
            initial={{ opacity: 0, y: 8, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.88 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 28,
              delay: i * 0.06,
            }}
            className="relative px-3 py-1 rounded-full text-[10px] tracking-[0.14em] uppercase font-light cursor-pointer select-none overflow-hidden"
            style={{
              background: 'rgba(245,166,35,0.04)',
              border: '1px solid rgba(245,166,35,0.2)',
              color: 'rgba(245,166,35,0.7)',
            }}
            whileHover={{
              background: 'rgba(245,166,35,0.10)',
              borderColor: 'rgba(245,166,35,0.45)',
              color: 'rgba(245,166,35,0.95)',
            }}
            whileTap={{ scale: 0.95 }}
          >
            {topic}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
