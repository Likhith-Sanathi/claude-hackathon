'use client'

import { useRef, useEffect, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import * as THREE from 'three'

export type DuckState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface DuckProps {
  state: DuckState
}

function DuckModel({ state }: { state: DuckState }) {
  const groupRef = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/duck.glb')

  useFrame((_, delta) => {
    if (!groupRef.current) return
    // Continuous tumble on all axes — like floating in space
    groupRef.current.rotation.y += delta * 0.6
    groupRef.current.rotation.x += delta * 0.15
    groupRef.current.rotation.z += delta * 0.1
  })

  return (
    <group ref={groupRef}>
      <primitive
        object={scene}
        scale={0.24}
        position={[0, 0.2, 0]}
        rotation={[0, Math.PI, 0]}
      />
    </group>
  )
}

useGLTF.preload('/duck.glb')

const CANVAS_SIZE = 800

export default function Duck({ state }: DuckProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number>(0)

  // Track the CENTER of the duck, not top-left
  const centerRef = useRef({ x: 0, y: 0 })
  const velRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })

  const pickTarget = useCallback(() => {
    // Targets can be anywhere on screen with some padding
    const pad = 60
    targetRef.current = {
      x: pad + Math.random() * (window.innerWidth - pad * 2),
      y: pad + Math.random() * (window.innerHeight - pad * 2),
    }
  }, [])

  const animate = useCallback(() => {
    const c = centerRef.current
    const vel = velRef.current
    const target = targetRef.current
    const w = window.innerWidth
    const h = window.innerHeight
    const t = Date.now() / 1000

    // Gravity toward target
    const dx = target.x - c.x
    const dy = target.y - c.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    const gravity = 0.008
    if (dist > 1) {
      vel.x += (dx / dist) * gravity
      vel.y += (dy / dist) * gravity
    }

    // Organic drift
    vel.x += Math.sin(t * 0.7) * 0.003 + Math.sin(t * 1.3 + 2) * 0.002
    vel.y += Math.cos(t * 0.5) * 0.003 + Math.cos(t * 1.1 + 5) * 0.002

    // Light damping
    vel.x *= 0.995
    vel.y *= 0.995

    // Max speed
    const maxSpeed = 1.5
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y)
    if (speed > maxSpeed) {
      vel.x = (vel.x / speed) * maxSpeed
      vel.y = (vel.y / speed) * maxSpeed
    }

    // Move center
    c.x += vel.x
    c.y += vel.y

    // Bounce the CENTER off screen edges with padding
    const pad = 40
    if (c.x < pad) { c.x = pad; vel.x = Math.abs(vel.x) * 0.6 }
    if (c.x > w - pad) { c.x = w - pad; vel.x = -Math.abs(vel.x) * 0.6 }
    if (c.y < pad) { c.y = pad; vel.y = Math.abs(vel.y) * 0.6 }
    if (c.y > h - pad) { c.y = h - pad; vel.y = -Math.abs(vel.y) * 0.6 }

    // New target when close
    if (dist < 80) pickTarget()

    // Position the canvas so its center aligns with the duck center
    if (elRef.current) {
      const left = c.x - CANVAS_SIZE / 2
      const top = c.y - CANVAS_SIZE / 2
      elRef.current.style.transform = `translate(${left}px, ${top}px)`
    }

    frameRef.current = requestAnimationFrame(animate)
  }, [pickTarget])

  useEffect(() => {
    centerRef.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
    const angle = Math.random() * Math.PI * 2
    velRef.current = { x: Math.cos(angle) * 0.5, y: Math.sin(angle) * 0.5 }
    pickTarget()
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [animate, pickTarget])

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div
        ref={elRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
        }}
      >
        <Canvas
          camera={{ position: [0, 1.2, 2.5], fov: 40 }}
          style={{ background: 'transparent' }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 5, 4]} intensity={1.2} />
          <directionalLight position={[-2, 3, -2]} intensity={0.3} color="#ffe0a0" />
          <pointLight position={[0, -2, 3]} intensity={0.3} color="#F5A623" />
          <DuckModel state={state} />
          <Environment preset="city" />
        </Canvas>
      </div>
    </div>
  )
}
