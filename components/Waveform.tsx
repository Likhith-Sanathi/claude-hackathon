'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface WaveformProps {
  analyser: AnalyserNode | null
  active: boolean
}

export default function Waveform({ analyser, active }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const barsRef = useRef<number[]>(new Array(40).fill(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const BAR_COUNT = 40

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)

      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      let amplitudes: number[]

      if (analyser && active) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)

        amplitudes = Array.from({ length: BAR_COUNT }, (_, i) => {
          const index = Math.floor((i / BAR_COUNT) * (dataArray.length * 0.6))
          return dataArray[index] / 255
        })
      } else {
        // Ambient idle animation
        const t = Date.now() / 1000
        amplitudes = Array.from({ length: BAR_COUNT }, (_, i) => {
          const wave = Math.sin(t * 1.2 + i * 0.4) * 0.5 + 0.5
          return wave * 0.08 + 0.02
        })
      }

      // Smooth bars
      barsRef.current = barsRef.current.map((prev, i) => {
        const target = amplitudes[i]
        return prev + (target - prev) * 0.25
      })

      const barW = W / BAR_COUNT
      const gap = 2

      barsRef.current.forEach((amp, i) => {
        const barHeight = Math.max(2, amp * H * 0.9)
        const x = i * barW + gap / 2
        const y = (H - barHeight) / 2
        const w = barW - gap

        const alpha = active ? 0.5 + amp * 0.5 : 0.15 + amp * 0.2

        // Gradient per bar
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight)
        gradient.addColorStop(0, `rgba(245, 166, 35, ${alpha * 0.6})`)
        gradient.addColorStop(0.5, `rgba(245, 166, 35, ${alpha})`)
        gradient.addColorStop(1, `rgba(245, 166, 35, ${alpha * 0.6})`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(x, y, w, barHeight, 1)
        ctx.fill()
      })
    }

    draw()

    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser, active])

  return (
    <motion.div
      className="flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: active ? 1 : 0.4 }}
      transition={{ duration: 0.5 }}
    >
      <canvas
        ref={canvasRef}
        width={280}
        height={48}
        className="w-[280px] h-12"
      />
    </motion.div>
  )
}
