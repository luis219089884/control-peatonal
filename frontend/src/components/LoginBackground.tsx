import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  red: boolean
}

const LINK_DISTANCE = 135
const LINK_DISTANCE_SQ = LINK_DISTANCE * LINK_DISTANCE
const RED_RATIO = 0.22

function particleCount(w: number, h: number, reduced: boolean) {
  const base = reduced ? 32 : 72
  const scaled = Math.floor(base * Math.sqrt((w * h) / (1280 * 720)))
  return Math.max(reduced ? 26 : 52, Math.min(scaled, reduced ? 40 : 92))
}

export default function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frameId = 0
    let particles: Particle[] = []
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const initParticles = (w: number, h: number) => {
      const n = particleCount(w, h, reducedMotion)
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: reducedMotion ? 0 : (Math.random() - 0.5) * 1.1,
        vy: reducedMotion ? 0 : (Math.random() - 0.5) * 1.1,
        radius: 1.2 + Math.random() * 2,
        red: Math.random() < RED_RATIO,
      }))
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initParticles(w, h)
    }

    const drawBackground = (w: number, h: number) => {
      const grad = ctx.createRadialGradient(w * 0.55, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.85)
      grad.addColorStop(0, '#0f2229')
      grad.addColorStop(0.45, '#0a161c')
      grad.addColorStop(1, '#04080c')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    }

    const updateParticles = (w: number, h: number) => {
      if (reducedMotion) return
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x <= 0 || p.x >= w) {
          p.vx *= -1
          p.x = Math.max(1, Math.min(w - 1, p.x))
        }
        if (p.y <= 0 || p.y >= h) {
          p.vy *= -1
          p.y = Math.max(1, Math.min(h - 1, p.y))
        }
      }
    }

    const drawLinks = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const distSq = dx * dx + dy * dy
          if (distSq > LINK_DISTANCE_SQ) continue

          const dist = Math.sqrt(distSq)
          const t = 1 - dist / LINK_DISTANCE
          const alpha = t * t * 0.55

          if (a.red && b.red) {
            ctx.strokeStyle = `rgba(255, 70, 85, ${alpha * 0.95})`
          } else if (a.red || b.red) {
            ctx.strokeStyle = `rgba(200, 100, 120, ${alpha * 0.45})`
          } else {
            ctx.strokeStyle = `rgba(0, 220, 245, ${alpha})`
          }
          ctx.lineWidth = 0.55 + t * 0.35
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
    }

    const drawNodes = () => {
      for (const p of particles) {
        const glowR = p.radius * 5
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR)
        if (p.red) {
          glow.addColorStop(0, 'rgba(255, 100, 110, 0.9)')
          glow.addColorStop(0.35, 'rgba(200, 40, 55, 0.35)')
          glow.addColorStop(1, 'transparent')
        } else {
          glow.addColorStop(0, 'rgba(140, 245, 255, 0.85)')
          glow.addColorStop(0.35, 'rgba(0, 200, 230, 0.3)')
          glow.addColorStop(1, 'transparent')
        }
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = p.red ? '#ff5c6a' : '#a8f6ff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const tick = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      drawBackground(w, h)
      updateParticles(w, h)
      drawLinks()
      drawNodes()
      frameId = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    frameId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div className="login-network-bg" aria-hidden>
      <canvas ref={canvasRef} className="login-network-bg__canvas" />
      <div className="login-network-bg__vignette" />
    </div>
  )
}
