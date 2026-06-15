import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { QRCodeSVG } from 'qrcode.react'
import { GENERAR_QR_MUTATION } from '../graphql/mutations'
import { MI_PERFIL_EXTENDIDO_QUERY } from '../graphql/queries'
import Badge from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'

type EstadoQR = 'sin_generar' | 'activo' | 'expirado'

export default function GenerarQR() {
  const { user } = useAuth()
  const [qr, setQr] = useState<{ token: string; expiraEn: string; segundosVida: number } | null>(null)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const [estado, setEstado] = useState<EstadoQR>('sin_generar')
  const [errorMsg, setErrorMsg] = useState('')
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
      if (restantes === 0) { limpiarInterval(); setEstado('expirado') }
    }, 1000)
    return limpiarInterval
  }, [qr])

  const handleGenerar = async () => {
    limpiarInterval()
    setEstado('sin_generar')
    setQr(null)
    setErrorMsg('')
    try {
      const { data } = await generarQR({ variables: { segundosVida: 60 } })
      const res = data?.generarQr
      if (res) {
        setQr(res)
        setSegundosRestantes(res.segundosVida)
        setEstado('activo')
      }
    } catch (e: unknown) {
      setErrorMsg((e as Error).message || 'Error al generar QR.')
    }
  }

  const porcentaje = qr ? (segundosRestantes / qr.segundosVida) * 100 : 0
  const colorBarra = segundosRestantes > 30 ? '#27ae60' : segundosRestantes > 10 ? '#f39c12' : '#e74c3c'
  const tiempoFormato = `${String(Math.floor(segundosRestantes / 60)).padStart(2, '0')}:${String(segundosRestantes % 60).padStart(2, '0')}`

  return (
    <div className="max-w-lg mx-auto space-y-5 px-1">

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">Mi QR de Acceso</h1>
        <Badge tipo={user?.tipo_usuario as Parameters<typeof Badge>[0]['tipo']} />
      </div>

      {estado !== 'activo' && (
        <button
          onClick={handleGenerar}
          disabled={loading}
          className="w-full flex flex-col items-center gap-3 py-8 px-4 rounded-2xl
            bg-gradient-to-br from-[#1a3a6b] to-[#2a5298]
            border border-blue-400/30 shadow-lg
            text-white font-bold text-lg tracking-wide
            hover:scale-[1.02] hover:brightness-110 active:scale-95
            transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-5xl">🔑</span>
          {loading ? 'Generando...' : 'Generar QR'}
        </button>
      )}

      {estado === 'activo' && qr && (
        <div className="bg-white rounded-2xl shadow-card p-6 flex flex-col items-center gap-4 animate-fadeIn">

          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold
            bg-blue-100 text-blue-700 border border-blue-200">
            <span>🔑</span>
            <span>QR de acceso</span>
          </div>

          <div className="p-4 bg-white border-4 border-[#1a3a6b] rounded-xl shadow-card">
            <QRCodeSVG value={qr.token} size={200} level="H" />
          </div>

          <div className="text-4xl font-mono font-bold" style={{ color: colorBarra }}>
            ⏱ {tiempoFormato}
          </div>

          <div className="w-full max-w-xs space-y-1">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${porcentaje}%`, backgroundColor: colorBarra }}
              />
            </div>
            <p className="text-xs text-center text-gray-500">
              Muestra este código al guardia en el portón
            </p>
          </div>

          <button
            onClick={() => { limpiarInterval(); setEstado('sin_generar'); setQr(null) }}
            className="text-gray-400 hover:text-gray-600 text-sm transition-colors mt-1"
          >
            Cancelar
          </button>
        </div>
      )}

      {estado === 'expirado' && qr && (
        <div className="bg-white rounded-2xl shadow-card p-6 flex flex-col items-center gap-3 animate-fadeIn">
          <div className="relative inline-block opacity-30">
            <QRCodeSVG value={qr.token} size={160} level="H" />
          </div>
          <p className="text-red-500 font-semibold">QR Expirado</p>
          <p className="text-sm text-gray-400 text-center">Genera un nuevo código</p>
          <button
            onClick={handleGenerar}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#1a3a6b] text-white font-semibold text-sm
              hover:bg-[#2a5298] transition-colors disabled:opacity-50 mt-2"
          >
            🔑 Generar nuevo QR
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card p-4 space-y-2 text-sm">
        <p className="font-semibold text-[#1a3a6b] text-xs uppercase tracking-wide mb-2">Mis datos</p>
        <div className="flex justify-between text-gray-600">
          <span>Nombre</span>
          <span className="font-medium text-gray-800">{user?.nombres} {user?.apellidos}</span>
        </div>
        {facultad && (
          <>
            <div className="flex justify-between text-gray-600">
              <span>Facultad</span>
              <span className="font-medium text-gray-800 text-right max-w-[55%]">{facultad.facultad}</span>
            </div>
            {facultad.carrera && (
              <div className="flex justify-between text-gray-600">
                <span>Carrera</span>
                <span className="font-medium text-gray-800 text-right max-w-[55%]">{facultad.carrera}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Sede</span>
              <span className="text-gray-700">{facultad.sede}</span>
            </div>
          </>
        )}
      </div>

      <div className="bg-[#f0f7ff] border border-[#c8e0ff] rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-[#1a3a6b] uppercase tracking-wide">Cómo usar</p>
        <ol className="space-y-1 text-sm text-gray-600">
          <li>1. Toca <strong>Generar QR</strong> antes de pasar por el portón</li>
          <li>2. Muestra el código al guardia</li>
          <li>3. Si es tu primera vez del día en la sede → <strong>entrada</strong></li>
          <li>4. Si ya estás adentro → <strong>salida</strong></li>
          <li>5. Cada QR expira en <strong>60 segundos</strong> y es de un solo uso</li>
        </ol>
      </div>

    </div>
  )
}
