import { useState, useEffect, useCallback, useRef } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import {
  VALIDAR_QR_MUTATION,
  REGISTRAR_ACCESO_MANUAL_MUTATION,
  REGISTRAR_ACCESO_LOGISTICO_MUTATION,
} from '../graphql/mutations'
import { MI_PANEL_GUARDIA_QUERY } from '../graphql/queries'
import LoginBackground from '../components/LoginBackground'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Seguridad2FA from '../components/Seguridad2FA'
import QrScanner from '../components/QrScanner'
import { useAuth } from '../context/AuthContext'
import type { ValidarQRResponse } from '../types'

const TIPOS = [
  { value: 'estudiante',       label: 'Estudiante',     icon: '🎓' },
  { value: 'docente',          label: 'Docente',         icon: '👨‍🏫' },
  { value: 'administrativo',   label: 'Administrativo', icon: '🏢' },
  { value: 'personal_externo', label: 'Pers. Externo',  icon: '🔧' },
  { value: 'invitado',         label: 'Invitado',        icon: '👥' },
  { value: 'logistico',        label: 'Logístico',       icon: '🚚' },
]

const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type Estado = 'listo' | 'resultado'

interface ResultadoScan extends ValidarQRResponse {
  tipoPersona?: string
  tipoMovimiento?: string
}

// ── Modal Registro Manual ─────────────────────────────────────────────────────
function ModalManual({
  idIngreso,
  onClose,
  onResult,
}: {
  idIngreso: number
  onClose: () => void
  onResult: (r: ResultadoScan) => void
}) {
  const [ci, setCi]             = useState('')
  const [error, setError]       = useState('')
  const inputRef                = useRef<HTMLInputElement>(null)
  const [registrar, { loading }] = useMutation(REGISTRAR_ACCESO_MANUAL_MUTATION)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ci.trim()) { setError('Ingresa un CI.'); return }
    setError('')
    try {
      const { data } = await registrar({
        variables: { ci: ci.trim(), idIngreso },
      })
      const r = data?.registrarAccesoManual
      onResult({
        resultado: r?.resultado === 'PERMITIDO' ? 'PERMITIDO' : 'RECHAZADO',
        mensaje: r?.mensaje ?? '',
        nombre: r?.nombre,
        sede: r?.sede,
        facultad: r?.facultad,
        tipoPersona: r?.tipoPersona,
        tipoMovimiento: r?.tipoMovimiento,
      })
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#06101a]/97 border border-white/15 rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-white font-bold flex items-center gap-2">
            <span>⌨️</span> Registro Manual
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wide">
              CI del usuario
            </label>
            <input
              ref={inputRef}
              value={ci}
              onChange={e => setCi(e.target.value)}
              placeholder="Número de carnet de identidad"
              className="w-full bg-white/8 border border-white/15 text-white rounded-xl px-4 py-3
                text-sm placeholder-white/25 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            <p className="text-xs text-white/40 mt-2">
              El sistema detecta automáticamente si es entrada o salida.
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/40
              text-cyan-300 font-semibold text-sm hover:bg-cyan-500/30
              transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Registrando...' : 'Registrar Acceso'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Modal Acceso Logístico ────────────────────────────────────────────────────
const MOTIVOS = ['Delivery', 'Proveedor', 'Mantenimiento', 'Mensajería', 'Visita rápida', 'Otro']

function ModalLogistico({
  idIngreso,
  onClose,
  onResult,
}: {
  idIngreso: number
  onClose: () => void
  onResult: (r: ResultadoScan) => void
}) {
  const [ci, setCi]           = useState('')
  const [nombre, setNombre]   = useState('')
  const [motivo, setMotivo]   = useState(MOTIVOS[0])
  const [mov, setMov]         = useState<'entrada' | 'salida'>('entrada')
  const [error, setError]     = useState('')
  const [registrar, { loading }] = useMutation(REGISTRAR_ACCESO_LOGISTICO_MUTATION)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ci.trim() || !nombre.trim()) { setError('CI y nombre son requeridos.'); return }
    setError('')
    try {
      const { data } = await registrar({
        variables: {
          ci: ci.trim(),
          nombreCompleto: nombre.trim(),
          motivo,
          tipoMovimiento: mov,
          idIngreso,
        },
      })
      const r = data?.registrarAccesoLogistico
      onResult({
        resultado: r?.resultado === 'REGISTRADO' ? 'PERMITIDO' : 'RECHAZADO',
        mensaje: r?.mensaje ?? '',
        nombre: r?.nombre,
        tipoPersona: 'logistico',
        tipoMovimiento: r?.tipoMovimiento,
      })
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#06101a]/97 border border-white/15 rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-white font-bold flex items-center gap-2">
            <span>🚚</span> Acceso Logístico
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-white/40 text-xs">
            Para delivery, proveedores y visitantes sin cuenta en el sistema.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wide">CI</label>
              <input
                value={ci}
                onChange={e => setCi(e.target.value)}
                placeholder="Carnet"
                className="w-full bg-white/8 border border-white/15 text-white rounded-xl px-3 py-2.5
                  text-sm placeholder-white/25 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wide">Motivo</label>
              <select
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className="w-full bg-[#06101a] border border-white/15 text-white rounded-xl px-3 py-2.5
                  text-sm focus:outline-none focus:border-cyan-400 transition-colors"
              >
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wide">Nombre completo</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Apellidos y nombres"
              className="w-full bg-white/8 border border-white/15 text-white rounded-xl px-4 py-3
                text-sm placeholder-white/25 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMov('entrada')}
              className={`py-3 rounded-xl text-sm font-semibold border transition-all
                ${mov === 'entrada'
                  ? 'bg-green-500/20 border-green-400/50 text-green-300'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30'
                }`}
            >
              🚪 Entrada
            </button>
            <button
              type="button"
              onClick={() => setMov('salida')}
              className={`py-3 rounded-xl text-sm font-semibold border transition-all
                ${mov === 'salida'
                  ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30'
                }`}
            >
              🏃 Salida
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-500/20 border border-amber-400/40
              text-amber-300 font-semibold text-sm hover:bg-amber-500/30
              transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Panel principal ───────────────────────────────────────────────────────────
export default function PanelGuardia() {
  const [estado, setEstado]               = useState<Estado>('listo')
  const [resultado, setResultado]         = useState<ResultadoScan | null>(null)
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [showSeguridad, setShowSeguridad] = useState(false)
  const [showManual, setShowManual]       = useState(false)
  const [showLogistico, setShowLogistico] = useState(false)
  const [filtroTipo, setFiltroTipo]       = useState('todos')
  const [filtroAcceso, setFiltroAcceso]   = useState('todos')
  const [filtroMov, setFiltroMov]         = useState('todos')

  const { logout } = useAuth()
  const [validarQR, { loading }] = useMutation(VALIDAR_QR_MUTATION)
  const { data: panelData, loading: loadingPanel, refetch } = useQuery(MI_PANEL_GUARDIA_QUERY, {
    fetchPolicy: 'network-only',
  })

  const panel     = panelData?.miPanelGuardia
  const registros = panel?.registrosHoy ?? []
  const idIngreso = panel?.ingresoId ?? 1

  const now      = new Date()
  const fechaHoy = `${DIAS[now.getDay()]} ${now.getDate()} de ${MESES[now.getMonth()]} ${now.getFullYear()}`

  // Auto-dismiss resultado después de 3.5 s
  useEffect(() => {
    if (estado !== 'resultado') return
    const t = setTimeout(() => { setEstado('listo'); setResultado(null) }, 3500)
    return () => clearTimeout(t)
  }, [estado])

  const handleValidarToken = useCallback(async (tokenHash: string) => {
    if (!tokenHash.trim() || !panel || loading) return
    try {
      const { data } = await validarQR({
        variables: { tokenHash: tokenHash.trim(), idIngreso },
      })
      const r = data?.validarQr
      setResultado({
        ...r,
        tipoPersona: r?.tipoPersona ?? '',
        tipoMovimiento: r?.tipoMovimiento ?? '',
      })
      setEstado('resultado')
      refetch()
    } catch (e: unknown) {
      setResultado({ resultado: 'ERROR', mensaje: (e as Error).message })
      setEstado('resultado')
    }
  }, [panel, validarQR, refetch, loading, idIngreso])

  const handleManualResult = (r: ResultadoScan) => {
    setResultado(r)
    setEstado('resultado')
    refetch()
  }

  const entradas  = registros.filter((r: { tipoMovimiento?: string; accesoPermitido: boolean }) => r.accesoPermitido && r.tipoMovimiento === 'entrada').length
  const salidas   = registros.filter((r: { tipoMovimiento?: string; accesoPermitido: boolean }) => r.accesoPermitido && r.tipoMovimiento === 'salida').length
  const rechazados = registros.filter((r: { accesoPermitido: boolean }) => !r.accesoPermitido).length

  const registrosFiltrados = registros.filter((r: {
    tipoPersona: string; accesoPermitido: boolean; tipoMovimiento?: string
  }) => {
    if (filtroTipo   !== 'todos' && r.tipoPersona    !== filtroTipo)  return false
    if (filtroAcceso === 'permitido' && !r.accesoPermitido)           return false
    if (filtroAcceso === 'rechazado' &&  r.accesoPermitido)           return false
    if (filtroMov    !== 'todos' && r.tipoMovimiento !== filtroMov)   return false
    return true
  })

  const esPermitido = resultado?.resultado === 'PERMITIDO'
  const esEntrada   = resultado?.tipoMovimiento === 'entrada'

  if (loadingPanel) return (
    <div className="min-h-screen relative flex items-center justify-center">
      <LoginBackground />
      <div className="relative z-10 text-white"><LoadingSpinner text="Cargando panel..." /></div>
    </div>
  )

  return (
    <div className="min-h-screen relative overflow-hidden">
      <LoginBackground />

      {/* ── Botón abrir drawer ── */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir menú"
        className="fixed top-4 left-4 z-40 bg-white/10 hover:bg-white/20 backdrop-blur-md
          text-white p-3 rounded-xl border border-white/20 shadow-lg
          transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ── Drawer overlay ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
      )}

      {/* ── Drawer lateral ── */}
      <aside className={`fixed top-0 left-0 h-full w-80 z-50 flex flex-col
        bg-[#04080c]/96 backdrop-blur-2xl border-r border-white/10 shadow-2xl
        transition-transform duration-300 ease-in-out
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        <div className="bg-white/5 px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl p-2.5 text-xl">👮</div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">{panel?.nombreCompleto || 'Guardia'}</p>
              <p className="text-cyan-400 text-xs">Personal de Seguridad</p>
            </div>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="text-white/40 hover:text-white text-lg transition-colors p-1">✕</button>
        </div>

        <div className="px-5 py-4 border-b border-white/10 space-y-2 flex-shrink-0">
          <div className="flex items-start gap-2 text-blue-200 text-xs">
            <span className="mt-0.5">📍</span>
            <span>{panel?.ingresoNombre} — {panel?.facultadNombre}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-300 text-xs">
            <span>🕐</span>
            <span>Horario: {panel?.horario?.replace('-', ' - ') || '07:00 - 22:00'}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-300 text-xs">
            <span>🏙️</span>
            <span>{panel?.sedeNombre}</span>
            <span className="text-white/20">|</span>
            <span>📅 {fechaHoy}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-green-500/10 rounded-xl p-2.5 text-center border border-green-500/20">
              <p className="text-xl font-extrabold text-green-400">{entradas}</p>
              <p className="text-xs text-green-400/60 leading-tight">Entradas</p>
            </div>
            <div className="bg-orange-500/10 rounded-xl p-2.5 text-center border border-orange-500/20">
              <p className="text-xl font-extrabold text-orange-400">{salidas}</p>
              <p className="text-xs text-orange-400/60 leading-tight">Salidas</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-2.5 text-center border border-red-500/20">
              <p className="text-xl font-extrabold text-red-400">{rechazados}</p>
              <p className="text-xs text-red-400/60 leading-tight">Negados</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setShowSeguridad(true); setDrawerOpen(false) }}
            className="w-full mt-1 text-xs bg-white/8 hover:bg-white/15 text-blue-200
              px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border border-white/10"
          >
            🔐 Seguridad (2FA)
          </button>
        </div>

        {/* Historial */}
        <div className="flex-1 flex flex-col overflow-hidden px-4 pt-4 pb-4">
          <p className="text-white font-semibold text-xs uppercase tracking-widest mb-3 flex-shrink-0">Historial del día</p>

          <div className="space-y-2 mb-3 flex-shrink-0">
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              className="w-full bg-white/8 text-white/80 text-xs rounded-lg px-3 py-2 border border-white/15 focus:outline-none focus:border-cyan-400 transition-colors">
              <option value="todos" className="bg-[#04080c]">Todos los tipos</option>
              {TIPOS.map(t => <option key={t.value} value={t.value} className="bg-[#04080c]">{t.label}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select value={filtroAcceso} onChange={e => setFiltroAcceso(e.target.value)}
                className="w-full bg-white/8 text-white/80 text-xs rounded-lg px-3 py-2 border border-white/15 focus:outline-none focus:border-cyan-400 transition-colors">
                <option value="todos" className="bg-[#04080c]">Todos</option>
                <option value="permitido" className="bg-[#04080c]">OK ✅</option>
                <option value="rechazado" className="bg-[#04080c]">Neg ❌</option>
              </select>
              <select value={filtroMov} onChange={e => setFiltroMov(e.target.value)}
                className="w-full bg-white/8 text-white/80 text-xs rounded-lg px-3 py-2 border border-white/15 focus:outline-none focus:border-cyan-400 transition-colors">
                <option value="todos" className="bg-[#04080c]">Movim.</option>
                <option value="entrada" className="bg-[#04080c]">🚪 Entrada</option>
                <option value="salida" className="bg-[#04080c]">🏃 Salida</option>
              </select>
            </div>
          </div>

          <button type="button" onClick={logout}
            className="w-full mb-3 flex-shrink-0 flex items-center justify-center gap-2
              bg-red-500/15 hover:bg-red-500/30 border border-red-500/30
              text-red-300 hover:text-red-200 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all duration-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {registrosFiltrados.length === 0 ? (
              <div className="text-center py-10 text-white/25">
                <p className="text-2xl mb-2">📋</p>
                <p className="text-xs">Sin registros</p>
              </div>
            ) : (
              [...registrosFiltrados].reverse().map((r: {
                idRegistro: number; tipoPersona: string; nombreCompleto: string;
                accesoPermitido: boolean; fechaHora: string; tipoMovimiento?: string; metodo?: string;
              }) => (
                <div key={r.idRegistro}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 transition-colors">
                  <span className="text-sm">
                    {!r.accesoPermitido ? '❌' : r.tipoMovimiento === 'salida' ? '🏃' : '✅'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/90 truncate">{r.nombreCompleto}</p>
                    <p className="text-xs text-white/35">
                      {new Date(r.fechaHora).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      {r.tipoMovimiento ? ` · ${r.tipoMovimiento}` : ''}
                      {r.metodo && r.metodo !== 'qr' ? ` · ${r.metodo}` : ''}
                    </p>
                  </div>
                  <Badge tipo={r.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">

        {/* Estado listo */}
        {estado === 'listo' && (
          <div className="flex flex-col items-center gap-5 w-full max-w-sm animate-fadeIn">

            {/* Logo */}
            <div className="text-center w-full max-w-xs">
              <img
                src="/images/logo-uagrm-horizontal.png"
                alt="UAGRM"
                className="w-full max-w-xs mx-auto h-auto object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
                onError={e => { (e.target as HTMLImageElement).src = 'https://www.uagrm.edu.bo/img/logo-88x707-gray.png' }}
              />
              <div className="flex items-center justify-center gap-3 mt-3">
                <div className="h-px flex-1 max-w-[70px] bg-gradient-to-r from-transparent to-cyan-500/50" />
                <p className="text-white/45 text-xs tracking-[0.25em] uppercase font-medium">Control Peatonal</p>
                <div className="h-px flex-1 max-w-[70px] bg-gradient-to-l from-transparent to-cyan-500/50" />
              </div>
            </div>

            {/* Cámara QR */}
            <div className="w-full rounded-2xl overflow-hidden border-2 border-cyan-400/30
              shadow-2xl shadow-cyan-500/10 bg-black/30 backdrop-blur-sm">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <LoadingSpinner text="Validando..." />
                </div>
              ) : (
                <QrScanner active={!loading} onScan={handleValidarToken} />
              )}
            </div>

            <p className="text-white/30 text-xs tracking-widest uppercase text-center">
              Acerque el código QR a la cámara
            </p>

            {/* Botones alternativos */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                  bg-white/8 hover:bg-white/15 border border-white/15 hover:border-white/30
                  text-white/70 hover:text-white text-sm font-medium
                  transition-all duration-200 active:scale-95"
              >
                ⌨️ <span>Registro Manual</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLogistico(true)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                  bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40
                  text-amber-300/70 hover:text-amber-200 text-sm font-medium
                  transition-all duration-200 active:scale-95"
              >
                🚚 <span>Acceso Logístico</span>
              </button>
            </div>
          </div>
        )}

        {/* Estado resultado */}
        {estado === 'resultado' && resultado && (
          <div className="flex flex-col items-center w-full max-w-sm animate-scaleIn">
            <div className={`w-full rounded-3xl p-8 text-center border shadow-2xl backdrop-blur-xl
              ${!esPermitido                 ? 'bg-red-500/15    border-red-400/30    shadow-red-500/20'
              : esEntrada                   ? 'bg-green-500/15  border-green-400/30  shadow-green-500/20'
              :                               'bg-orange-500/15 border-orange-400/30 shadow-orange-500/20'
              }`}>

              <div className="text-8xl mb-4 leading-none">
                {!esPermitido ? '❌' : esEntrada ? '🚪' : '🏃'}
              </div>

              <h2 className={`text-3xl font-extrabold mb-3 drop-shadow-lg
                ${!esPermitido ? 'text-red-300' : esEntrada ? 'text-green-300' : 'text-orange-300'}`}>
                {!esPermitido ? 'Acceso No Válido' : esEntrada ? 'Bienvenido/a' : 'Hasta luego'}
              </h2>

              {resultado.nombre && (
                <p className="text-white font-bold text-lg mb-1">{resultado.nombre}</p>
              )}

              {esPermitido && resultado.tipoMovimiento && (
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3
                  ${esEntrada
                    ? 'bg-green-500/20 text-green-300 border border-green-400/30'
                    : 'bg-orange-500/20 text-orange-300 border border-orange-400/30'
                  }`}>
                  {esEntrada ? '🚪 Entrada' : '🏃 Salida'}
                  {resultado.tipoPersona === 'logistico' ? ' · Logístico' : ''}
                </span>
              )}

              <p className={`text-sm leading-relaxed
                ${!esPermitido ? 'text-red-200/80' : esEntrada ? 'text-green-200/80' : 'text-orange-200/80'}`}>
                {resultado.mensaje}
              </p>

              {(resultado.facultad || resultado.sede) && (
                <p className="text-white/40 text-xs mt-3">
                  🏛️ {resultado.facultad}{resultado.sede ? ` — ${resultado.sede}` : ''}
                </p>
              )}

              {resultado.tipoPersona && resultado.tipoPersona !== 'logistico' && (
                <div className="flex justify-center mt-3">
                  <Badge tipo={resultado.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />
                </div>
              )}

              <div className="mt-6 w-full bg-white/10 rounded-full h-1 overflow-hidden">
                <div className={`h-1 rounded-full animate-shrink
                  ${!esPermitido ? 'bg-red-400' : esEntrada ? 'bg-green-400' : 'bg-orange-400'}`} />
              </div>
              <p className="text-white/25 text-xs mt-2">Volviendo al escáner...</p>
            </div>
          </div>
        )}
      </main>

      {/* ── Modales ── */}
      {showManual && (
        <ModalManual
          idIngreso={idIngreso}
          onClose={() => setShowManual(false)}
          onResult={handleManualResult}
        />
      )}
      {showLogistico && (
        <ModalLogistico
          idIngreso={idIngreso}
          onClose={() => setShowLogistico(false)}
          onResult={handleManualResult}
        />
      )}

      {/* ── Modal Seguridad 2FA ── */}
      {showSeguridad && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#04080c]/95 border border-white/15 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="bg-white/5 px-6 py-4 rounded-t-2xl flex items-center justify-between border-b border-white/10 sticky top-0">
              <h3 className="font-bold text-white">Seguridad de la cuenta</h3>
              <button type="button" onClick={() => setShowSeguridad(false)} className="text-white/40 hover:text-white text-xl transition-colors">✕</button>
            </div>
            <div className="p-5"><Seguridad2FA /></div>
          </div>
        </div>
      )}
    </div>
  )
}
