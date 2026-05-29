import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QrScannerProps {
  active: boolean
  onScan: (token: string) => void
}

function pickCamera(cameras: { id: string; label: string }[]) {
  const back = cameras.find((c) =>
    /back|rear|environment|trás|trasera|posterior/i.test(c.label),
  )
  return back?.id ?? cameras[cameras.length - 1].id
}

export default function QrScanner({ active, onScan }: QrScannerProps) {
  const elementId = useId().replace(/:/g, '')
  const readerId = `qr-reader-${elementId}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onScanRef = useRef(onScan)
  const scannedRef = useRef(false)
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!active) return

    scannedRef.current = false
    setCameraError('')

    const scanner = new Html5Qrcode(readerId)
    scannerRef.current = scanner

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1,
    }

    const onDecode = (text: string) => {
      if (scannedRef.current) return
      scannedRef.current = true
      scanner.stop().catch(() => {})
      onScanRef.current(text.trim())
    }

    const startScanner = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (cameras.length === 0) {
          setCameraError('No se encontró cámara en este dispositivo.')
          return
        }
        await scanner.start(pickCamera(cameras), config, onDecode, () => {})
      } catch {
        try {
          await scanner.start({ facingMode: 'environment' }, config, onDecode, () => {})
        } catch {
          setCameraError(
            'No se pudo usar la cámara. Revisa los permisos del navegador e intenta de nuevo.',
          )
        }
      }
    }

    startScanner()

    return () => {
      const current = scannerRef.current
      if (!current) return
      if (current.isScanning) {
        current.stop().catch(() => {})
      }
      try {
        current.clear()
      } catch {
        /* ignore cleanup errors */
      }
      scannerRef.current = null
    }
  }, [active, readerId])

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
