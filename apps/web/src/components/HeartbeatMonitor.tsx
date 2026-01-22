'use client'

import { useEffect, useRef, useState } from 'react'

interface HeartbeatMonitorProps {
  bpm?: number // Beats per minute (use volume/1M as BPM)
  label?: string
  color?: string
}

export default function HeartbeatMonitor({ 
  bpm = 75, 
  label = 'SYSTEM PULSE',
  color = '#00ff00'
}: HeartbeatMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [heartbeat, setHeartbeat] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize Audio Context (on user interaction)
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }, [])

  // Play beep sound (realistic ECG monitor beep)
  const playBeep = () => {
    if (!audioContextRef.current) return

    const ctx = audioContextRef.current
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    // ECG monitor beep: short, high-pitched tone
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(800, ctx.currentTime) // 800Hz beep
    
    // Quick attack/release for sharp beep
    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01) // Fast attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08) // Quick decay

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.08) // 80ms beep
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const width = canvas.width
    const height = canvas.height

    // ECG wave data (MORE REALISTIC heartbeat pattern - medical grade!)
    const ecgWave = [
      // Baseline (calm)
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      // P wave (atrial contraction - small gentle bump)
      0, 0.05, 0.12, 0.18, 0.22, 0.2, 0.15, 0.08, 0, 0,
      // PR segment (flat)
      0, 0, 0, 0, 0, 0, 0, 0,
      // Q wave (small dip)
      0, -0.15, -0.25, -0.2, 0,
      // R wave (MASSIVE SPIKE! - ventricular contraction)
      0.3, 0.8, 1.6, 2.2, 1.8, 0.9, 0.2,
      // S wave (drop)
      -0.3, -0.5, -0.3, 0,
      // ST segment (slight elevation)
      0, 0.05, 0.08, 0.08, 0.05, 0,
      // T wave (ventricular repolarization - smooth dome)
      0, 0.1, 0.2, 0.35, 0.45, 0.5, 0.48, 0.4, 0.3, 0.2, 0.1, 0,
      // Baseline (long rest before next beat)
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]

    let offset = 0
    const speed = Math.max(0.5, bpm / 60) // Convert BPM to speed (min 0.5 for smooth animation)

    function drawECG() {
      if (!ctx || !canvas) return

      // Clear with fade effect (trail)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, width, height)

      // Draw grid (like real ECG paper - finer detail)
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.08)'
      ctx.lineWidth = 0.5
      
      // Fine grid (1mm squares)
      for (let x = 0; x < width; x += 10) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      
      for (let y = 0; y < height; y += 10) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      
      // Bold grid (5mm squares) - standout
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)'
      ctx.lineWidth = 1
      
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      
      for (let y = 0; y < height; y += 50) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Draw ECG wave (THICKER & MORE GLOW)
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.shadowBlur = 15
      ctx.shadowColor = color
      ctx.beginPath()

      const centerY = height * 0.62 // Much lower center (62% from top - spike won't clip!)
      const scale = height * 0.25 // Smaller amplitude to ensure spike fits with padding

      // Draw with interpolation for smoother curve
      for (let x = 0; x < width; x++) {
        const wavePos = (x + offset) / 3 // Slower, smoother movement
        const waveIndex = Math.floor(wavePos) % ecgWave.length
        const nextIndex = (waveIndex + 1) % ecgWave.length
        
        // Linear interpolation between points for smoothness
        const t = wavePos - Math.floor(wavePos)
        const interpolated = ecgWave[waveIndex] * (1 - t) + ecgWave[nextIndex] * t
        
        const y = centerY - interpolated * scale
        
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()
      
      // Add extra glow layer for dramatic effect
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.shadowBlur = 20
      ctx.globalAlpha = 0.3
      ctx.stroke()
      ctx.globalAlpha = 1.0
      ctx.shadowBlur = 0

      // Move wave
      offset += speed * 1.5
      if (offset > ecgWave.length * 3) {
        offset = 0
        setHeartbeat(prev => prev + 1) // Trigger heartbeat flash
      }
    }

    const interval = setInterval(drawECG, 1000 / 60) // 60 FPS

    return () => clearInterval(interval)
  }, [bpm, color])

  // Flash effect + beep sound on heartbeat
  useEffect(() => {
    if (heartbeat > 0) {
      playBeep() // Play beep on every heartbeat! 🔊
    }
    const timer = setTimeout(() => setHeartbeat(0), 100)
    return () => clearTimeout(timer)
  }, [heartbeat])

  return (
    <div className="relative bg-black border-2 border-primary/30 rounded-sm overflow-hidden">
      {/* Label */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3">
        <div 
          className={`w-3 h-3 rounded-full transition-all duration-150 ${
            heartbeat > 0 
              ? 'bg-primary scale-[2] shadow-[0_0_20px_rgba(0,255,0,0.8)]' 
              : 'bg-primary/50 shadow-[0_0_10px_rgba(0,255,0,0.3)]'
          }`}
        />
        <span className="text-primary font-mono text-sm tracking-wider font-bold">{label}</span>
      </div>

      {/* BPM Display - BIGGER */}
      <div className={`absolute top-3 right-3 z-10 bg-black/90 px-3 py-2 rounded border-2 transition-all duration-150 ${
        heartbeat > 0 ? 'border-primary shadow-lg shadow-primary/50 scale-105' : 'border-primary/30'
      }`}>
        <div className="text-primary font-mono text-2xl font-bold tabular-nums">
          {Math.round(bpm)}
        </div>
        <div className="text-primary/50 font-mono text-[10px] text-center tracking-wider">BPM</div>
      </div>

      {/* Canvas - MASSIVE with padding! */}
      <canvas
        ref={canvasRef}
        width={1000}
        height={350}
        className="w-full h-[350px]"
        style={{ imageRendering: 'crisp-edges' }}
      />

      {/* Scanline effect - ENHANCED */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Moving scanline */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/10 to-transparent animate-pulse" />
        {/* CRT curve effect */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/20" />
        {/* Heartbeat flash */}
        {heartbeat > 0 && (
          <div className="absolute inset-0 bg-primary/10 animate-ping" />
        )}
      </div>
    </div>
  )
}
