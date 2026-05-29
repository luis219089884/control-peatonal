import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { VALIDAR_QR_MUTATION } from '../graphql/mutations'
import { MI_PANEL_GUARDIA_QUERY } from '../graphql/queries'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Seguridad2FA from '../components/Seguridad2FA'
import QrScanner from '../components/QrScanner'
import type { ValidarQRResponse } from '../types'

const TIPOS = [
  { value: 'estudiante',       label: 'Estudiante' },
  { value: 'docente',          label: 'Docente' },
  { value: 'administrativo',   label: 'Administrativo' },
  { value: 'personal_externo', label: 'Personal Externo' },
  { value: 'invitado',         label: 'Invitado' },
]

const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function PanelGuardia() {
  const [tipoPersona, setTipoPersona] = useState('estudiante')
  const [resultado, setResultado]   = useState<(ValidarQRResponse & { tipoPersona?: string }) | null>(null)
  const [escaneando, setEscaneando] = useState(false)
  const [showSeguridad, setShowSeguridad] = useState(false)

  const [validarQR, { loading }] = useMutation(VALIDAR_QR_MUTATION)
  const { data: panelData, loading: loadingPanel, refetch } = useQuery(MI_PANEL_GUARDIA_QUERY, {
    fetchPolicy: 'network-only',
  })

  const panel = panelData?.miPanelGuardia
  const registros = panel?.registrosHoy ?? []

  const now = new Date()
  const fechaHoy = `${DIAS[now.getDay()]} ${now.getDate()} de ${MESES[now.getMonth()]} ${now.getFullYear()}`

  useEffect(() => {
    if (!resultado) return
    const t = setTimeout(() => setResultado(null), 5000)
    return () => clearTimeout(t)
  }, [resultado])

  const handleValidarToken = useCallback(async (tokenHash: string) => {
    if (!tokenHash.trim() || !panel) return
    const idIngreso = panel.ingresoId ?? 1
    try {
      const { data } = await validarQR({
        variables: { tokenHash: tokenHash.trim(), idIngreso, tipoPersonaSeleccionado: tipoPersona },
      })
      setResultado(data?.validarQr)
      setEscaneando(false)
      refetch()
    } catch (e: unknown) {
      setResultado({ resultado: 'ERROR', mensaje: (e as Error).message })
      setEscaneando(false)
    }
  }, [panel, tipoPersona, validarQR, refetch])

  const permitidos = registros.filter((r: { accesoPermitido: boolean }) => r.accesoPermitido).length
  const rechazados = registros.length - permitidos

  if (loadingPanel) return <div className="flex justify-center mt-24"><LoadingSpinner text="Cargando panel..." /></div>

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7fa]">

      {/* Banner del guardia */}
      <div className="bg-[#1a3a6b] text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl p-2 text-2xl">👮</div>
            <div>
              <p className="font-bold text-lg">{panel?.nombreCompleto || 'Guardia'}</p>
              <p className="text-blue-200 text-sm">
                📍 {panel?.ingresoNombre} — {panel?.facultadNombre?.split('(')[1]?.replace(')','') || panel?.facultadNombre}
              </p>
              <p className="text-blue-300 text-xs mt-0.5">
                🕐 Horario: <span>{panel?.horario?.replace('-', ' - ') || '07:00 - 22:00'}</span> &nbsp;|&nbsp; 🏙️ {panel?.sedeNombre}
              </p>
            </div>
          </div>
          <div className="text-right space-y-1">
            <button
              type="button"
              onClick={() => setShowSeguridad(true)}
              className="text-xs bg-white/10 hover:bg-white/20 text-blue-100 px-3 py-1.5 rounded-lg transition-colors mb-1"
            >
              🔐 Seguridad (2FA opcional)
            </button>
            <p className="text-sm text-blue-200">📅 {fechaHoy}</p>
            <p className="text-sm font-semibold">
              {registros.length} ingresos hoy —{' '}
              <span className="text-green-300">{permitidos} ✅</span> —{' '}
              <span className="text-red-300">{rechazados} ❌</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 space-y-5">

        {/* Resultado escaneo */}
        {resultado && (
          <div className={`rounded-xl p-5 transition-all duration-300 fade-in ${
            resultado.resultado === 'PERMITIDO'
              ? 'bg-green-50 border-2 border-green-300'
              : 'bg-red-50 border-2 border-red-300'
          }`}>
            <div className="flex items-start gap-4">
              <span className="text-4xl">{resultado.resultado === 'PERMITIDO' ? '✅' : '❌'}</span>
              <div>
                <p className={`text-xl font-bold ${resultado.resultado === 'PERMITIDO' ? 'text-green-700' : 'text-red-700'}`}>
                  {resultado.resultado}
                </p>
                <p className="text-gray-700 mt-1">{resultado.mensaje}</p>
                {resultado.nombre && (
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                    <span>👤 {resultado.nombre}</span>
                    {resultado.tipoPersona && <Badge tipo={resultado.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />}
                    {resultado.facultad && <span>🏛️ {resultado.facultad}</span>}
                    {resultado.sede && <span>📍 {resultado.sede}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-2">
            <LoadingSpinner text="Validando QR..." />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Panel escaneo */}
          <div className="bg-white rounded-xl shadow-card p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#1a3a6b]">Validar Código QR</h2>
            <hr className="border-gray-100" />

            <div>
              <label className="label-field">Tipo de persona</label>
              <div className="flex flex-wrap gap-2">
                {TIPOS.map(t => (
                  <button key={t.value} onClick={() => setTipoPersona(t.value)}
                    disabled={escaneando || loading}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                      ${tipoPersona === t.value ? 'bg-[#1a3a6b] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                      disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {!escaneando ? (
              <button
                type="button"
                onClick={() => setEscaneando(true)}
                disabled={loading}
                className="w-full py-6 rounded-xl border-2 border-dashed border-[#1a3a6b]
                  text-[#1a3a6b] font-semibold text-lg hover:bg-[#f0f7ff] transition-all duration-200
                  flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="text-4xl">📷</span>
                <span>ESCANEAR QR</span>
                <span className="text-xs font-normal text-gray-400">Usa la cámara de este dispositivo</span>
              </button>
            ) : (
              <div className="space-y-3">
                <QrScanner active={escaneando && !loading} onScan={handleValidarToken} />
                <Button
                  variant="secondary"
                  onClick={() => setEscaneando(false)}
                  disabled={loading}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          {/* Últimos ingresos */}
          <div className="bg-white rounded-xl shadow-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1a3a6b]">Últimos Ingresos Hoy</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{registros.length}</span>
            </div>
            <hr className="border-gray-100" />
            {registros.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">📋</p><p className="text-sm">Sin registros hoy</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {[...registros].reverse().map((r: {
                  idRegistro: number; tipoPersona: string; nombreCompleto: string;
                  accesoPermitido: boolean; fechaHora: string;
                }) => (
                  <div key={r.idRegistro}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors duration-150">
                    <span className="text-xl">{r.accesoPermitido ? '✅' : '❌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.nombreCompleto}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(r.fechaHora).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge tipo={r.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSeguridad && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#f5f7fa] rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex items-center justify-between sticky top-0">
              <h3 className="font-bold">Seguridad de la cuenta</h3>
              <button
                type="button"
                onClick={() => setShowSeguridad(false)}
                className="text-white/70 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <Seguridad2FA />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
