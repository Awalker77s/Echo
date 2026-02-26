import { useEffect, useRef } from 'react'

interface WaveformProps {
  analyser: React.RefObject<AnalyserNode | null>
  dataArray: React.RefObject<Uint8Array | null>
  active: boolean
  height?: number
}

export function Waveform({ analyser, dataArray, active, height = 140 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!active) return
    let raf: number

    const draw = () => {
      const canvas = canvasRef.current
      const a = analyser.current
      const arr = dataArray.current
      if (!canvas || !a || !arr) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      a.getByteTimeDomainData(arr)
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
      gradient.addColorStop(0, '#8a83db')
      gradient.addColorStop(1, '#6f6ac8')

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.beginPath()
      ctx.lineWidth = 3
      ctx.strokeStyle = gradient
      ctx.shadowColor = 'rgba(111, 106, 200, 0.35)'
      ctx.shadowBlur = 12

      const sliceWidth = canvas.width / arr.length
      let x = 0
      for (let i = 0; i < arr.length; i += 1) {
        const v = arr[i] / 128.0
        const y = (v * canvas.height) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [active, analyser, dataArray])

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={height}
      className="w-full rounded-[28px] bg-[#f9f4ff]/60 shadow-inner"
    />
  )
}
