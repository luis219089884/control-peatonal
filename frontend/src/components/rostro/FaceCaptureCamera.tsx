import { useCallback, useEffect, useRef, useState } from 'react'

interface FaceCaptureCameraProps {
  active: boolean
  instruccion: string
  /** 'user' = selfie (perfil); 'environment' = cámara trasera (portón). */
  facingMode?: 'user' | 'environment'
  onCapture: (dataUrl: string) => void
}

export default function FaceCaptureCamera({
  active,
  instruccion,
  facingMode = 'user',
  onCapture,
}: FaceCaptureCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const generationRef = useRef(0)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
  }, [])

  useEffect(() => {
    if (!active) {
      stopStream()
      return
    }

    const generation = ++generationRef.current
    let cancelled = false
    const stale = () => cancelled || generation !== generationRef.current

    setError('')
    setReady(false)

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        })
        if (stale()) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        if (!stale()) setReady(true)
      } catch {
        if (!stale()) {
          setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      stopStream()
    }
  }, [active, facingMode, stopStream])

  const capturar = () => {
    const video = videoRef.current
    if (!video || !ready) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.88))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center text-gray-600">{instruccion}</p>

      {error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="relative mx-auto w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden bg-gray-900 border-2 border-[#2a5298]/30 shadow-lg">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[58%] h-[72%] rounded-[50%] border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm">
              Iniciando cámara...
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={capturar}
        disabled={!ready || !!error}
        className="w-full py-3 rounded-xl bg-[#1a3a6b] hover:bg-[#2a5298] text-white font-semibold text-sm
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        📸 Capturar foto
      </button>
    </div>
  )
}
