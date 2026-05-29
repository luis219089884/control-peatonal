import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { QRCodeSVG } from 'qrcode.react'
import { GENERAR_QR_MUTATION } from '../graphql/mutations'
import { MI_PERFIL_EXTENDIDO_QUERY } from '../graphql/queries'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'

type EstadoQR = 'sin_generar' | 'activo' | 'expirado'

export default function GenerarQR() {
  const { user } = useAuth()
  const [qr, setQr] = useState<{ token: string; expiraEn: string; segundosVida: number } | null>(null)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const [estado, setEstado] = useState<EstadoQR>('sin_generar')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [generarQR, { loading }] = useMutation(GENERAR_QR_MUTATION)
  const { data: extData } = useQuery(MI_PERFIL_EXTENDIDO_QUERY)
  const ext = extData?.miPerfilExtendido ? JSON.parse(extData.miPerfilExtendido) : null
  const facultad = ext?.facultades?.[0]

  const limpiarInterval = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  useEffect(() => {
    if (!qr) return
    limpiarInterval()
    const fin = new Date(qr.expiraEn).getTime()
    intervalRef.current = setInterval(() => {
      const restantes = Math.max(0, Math.round((fin - Date.now()) / 1000))
      setSegundosRestantes(restantes)
      if (restantes === 0) {
        limpiarInterval()
        setEstado('expirado')
      }
    }, 1000)
    return limpiarInterval
  }, [qr])

  const handleGenerar = async () => {
    limpiarInterval()
    setEstado('sin_generar')
    setQr(null)
    try {
      const { data } = await generarQR({ variables: { segundosVida: 60 } })
      const res = data?.generarQr
      if (res) {
        setQr(res)
        setSegundosRestantes(res.segundosVida)
        setEstado('activo')
      }
    } catch (e: unknown) {
      alert('Error al generar QR: ' + (e as Error).message)
    }
  }

  const porcentaje = qr ? (segundosRestantes / qr.segundosVida) * 100 : 0
  const colorBarra =
    segundosRestantes > 30 ? '#27ae60' :
    segundosRestantes > 10 ? '#f39c12' : '#e74c3c'

  const tiempoFormato = `${String(Math.floor(segundosRestantes / 60)).padStart(2, '0')}:${String(segundosRestantes % 60).padStart(2, '0')}`

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-[#1a3a6b]">Generar Código QR</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card datos del usuario */}
        <div className="bg-white rounded-xl shadow-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            👤 Datos del Usuario
          </h2>
          <hr className="border-gray-100" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Nombre:</span>
              <span className="text-sm font-semibold text-gray-800">
                {user?.nombres} {user?.apellidos}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Tipo:</span>
              <Badge tipo={user?.tipo_usuario as Parameters<typeof Badge>[0]['tipo']} />
            </div>
            {facultad && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Facultad:</span>
                  <span className="text-sm font-medium text-gray-700 text-right max-w-[55%]">{facultad.facultad}</span>
                </div>
                {facultad.carrera && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Carrera:</span>
                    <span className="text-sm font-medium text-gray-700 text-right max-w-[55%]">{facultad.carrera}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Sede:</span>
                  <span className="text-sm text-gray-600">{facultad.sede}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card instrucciones */}
        <div className="bg-[#f0f7ff] border border-[#c8e0ff] rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#1a3a6b] uppercase tracking-wide flex items-center gap-2">
            📱 Cómo usar tu QR
          </h2>
          <hr className="border-[#c8e0ff]" />
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2"><span className="font-bold text-[#1a3a6b]">1.</span> Presiona el botón "Generar QR"</li>
            <li className="flex gap-2"><span className="font-bold text-[#1a3a6b]">2.</span> Muestra el código al guardia en la entrada</li>
            <li className="flex gap-2"><span className="font-bold text-[#1a3a6b]">3.</span> El QR expira en <strong>60 segundos</strong></li>
            <li className="flex gap-2"><span className="font-bold text-[#1a3a6b]">4.</span> Si expira, genera uno nuevo</li>
          </ol>
          <p className="text-xs text-gray-400 mt-2">⚠️ Cada QR es de un solo uso y expira automáticamente.</p>
        </div>
      </div>

      {/* Card QR principal */}
      <div className="bg-white rounded-xl shadow-card p-6">
        <div className="flex flex-col items-center gap-5">

          {/* Estado: sin generar */}
          {estado === 'sin_generar' && (
            <div className="text-center py-4 space-y-3">
              <svg className="h-24 w-24 text-gray-200 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <p className="text-gray-500 text-sm">Presiona el botón para generar tu código QR de acceso</p>
            </div>
          )}

          {/* Estado: activo */}
          {estado === 'activo' && qr && (
            <>
              <div className="p-4 bg-white border-4 border-[#1a3a6b] rounded-xl shadow-card">
                <QRCodeSVG value={qr.token} size={200} level="H" />
              </div>

              {/* Contador */}
              <div className="text-4xl font-mono font-bold" style={{ color: colorBarra }}>
                ⏱ {tiempoFormato}
              </div>

              {/* Barra */}
              <div className="w-full max-w-xs space-y-1">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${porcentaje}%`, backgroundColor: colorBarra }}
                  />
                </div>
                <p className="text-xs text-center text-gray-500">
                  QR válido por {segundosRestantes} segundo{segundosRestantes !== 1 ? 's' : ''}
                </p>
              </div>
            </>
          )}

          {/* Estado: expirado */}
          {estado === 'expirado' && qr && (
            <div className="text-center py-4 space-y-3">
              <div className="relative inline-block opacity-30">
                <QRCodeSVG value={qr.token} size={160} level="H" />
              </div>
              <div className="flex items-center gap-2 text-[#e74c3c] font-semibold">
                <span>❌</span>
                <span>QR Expirado</span>
              </div>
              <p className="text-sm text-gray-400">Genera un nuevo código para acceder</p>
            </div>
          )}

          <Button
            onClick={handleGenerar}
            loading={loading}
            size="lg"
            className="w-full max-w-xs"
          >
            🔄 {estado === 'sin_generar' ? 'Generar QR de acceso' : 'Generar nuevo QR'}
          </Button>
        </div>
      </div>
    </div>
  )
}
