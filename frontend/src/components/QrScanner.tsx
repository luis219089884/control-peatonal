import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QrScannerProps {
  active: boolean
  /** Pausa lectura sin desmontar (p. ej. mientras valida en servidor). */
  paused?: boolean
  onScan: (token: string) => void
}

function pickCamera(cameras: { id: string; label: string }[]) {
  const back = cameras.find((c) =>
    /back|rear|environment|trás|trasera|posterior/i.test(c.label),
  )
  return back?.id ?? cameras[cameras.length - 1].id
}

async function stopScannerSafely(scanner: Html5Qrcode) {
  try {
    if (scanner.isScanning) {
      await scanner.stop()
    }
  } catch {
    /* ignore */
  }
  try {
    scanner.clear()
  } catch {
    /* ignore */
  }
}

export default function QrScanner({ active, paused = false, onScan }: QrScannerProps) {
  const elementId = useId().replace(/:/g, '')
  const readerId = `qr-reader-${elementId}`
  const onScanRef = useRef(onScan)
  const pausedRef = useRef(paused)
  const scannedRef = useRef(false)
  const generationRef = useRef(0)
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (!active) return

    const generation = ++generationRef.current
    let cancelled = false
    const stale = () => cancelled || generation !== generationRef.current

    scannedRef.current = false
    setCameraError('')

    const host = document.getElementById(readerId)
    if (host) host.innerHTML = ''

    const scanner = new Html5Qrcode(readerId)

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1,
    }

    const onDecode = (text: string) => {
      if (stale() || pausedRef.current || scannedRef.current) return
      scannedRef.current = true
      void stopScannerSafely(scanner).then(() => {
        if (!stale()) onScanRef.current(text.trim())
      })
    }

    const startScanner = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (stale() || pausedRef.current) return
        if (cameras.length === 0) {
          setCameraError('No se encontró cámara en este dispositivo.')
          return
        }
        await scanner.start(pickCamera(cameras), config, onDecode, () => {})
      } catch {
        if (stale() || pausedRef.current) return
        try {
          await scanner.start({ facingMode: 'environment' }, config, onDecode, () => {})
        } catch {
          if (!stale()) {
            setCameraError(
              'No se pudo usar la cámara. Revisa los permisos del navegador e intenta de nuevo.',
            )
          }
          return
        }
      }
      if (stale() || pausedRef.current) {
        await stopScannerSafely(scanner)
      }
    }

    if (paused) {
      void stopScannerSafely(scanner)
    } else {
      void startScanner()
    }

    return () => {
      cancelled = true
      void stopScannerSafely(scanner)
    }
  }, [active, paused, readerId])

  if (!active) return null

  return (
    <div className="space-y-3">
      {cameraError ? (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {cameraError}
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center">
          Apunta la cámara al código QR en pantalla
        </p>
      )}
      <div
        id={readerId}
        className="w-full rounded-xl overflow-hidden border border-gray-200 bg-black min-h-[280px]"
      />
    </div>
  )
}
