import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useMutation } from '@apollo/client'
import {
  VALIDAR_QR_MUTATION,
  REGISTRAR_ACCESO_MANUAL_MUTATION,
  REGISTRAR_ACCESO_LOGISTICO_MUTATION,
} from '../../graphql/mutations'
import LoginBackground from '../LoginBackground'
import Badge from '../ui/Badge'
import LoadingSpinner from '../ui/LoadingSpinner'
import Seguridad2FA from '../Seguridad2FA'
import QrScanner from '../QrScanner'
import { useAuth } from '../../context/AuthContext'
import type { ValidarQRResponse } from '../../types'

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

export interface RegistroHoy {
  idRegistro: number
  tipoPersona: string
  nombreCompleto: string
  accesoPermitido: boolean
  fechaHora: string
  tipoMovimiento?: string
  metodo?: string
}

export interface PanelData {
  nombreCompleto: string
  turno?: string
  horario?: string
  ingresoId: number
  ingresoNombre: string
  facultadNombre: string
  sedeNombre: string
  guardiaAsignadoNombre?: string | null
  registrosHoy: RegistroHoy[]
}

interface ResultadoScan extends ValidarQRResponse {
  tipoPersona?: string
  tipoMovimiento?: string
}

const INPUT_MODAL =
  'w-full bg-[#0e1828] border border-white/30 text-white rounded-xl px-4 py-3 ' +
  'text-base placeholder:text-white/45 focus:outline-none focus:border-cyan-400 ' +
  'focus:ring-2 focus:ring-cyan-400/30 caret-white'

const SELECT_MODAL =
  'w-full bg-[#0e1828] border border-white/30 text-white rounded-xl px-3 py-2.5 ' +
  'text-sm focus:outline-none focus:border-cyan-400'

const SELECT_DRAWER =
  'w-full bg-[#0e1828] text-white text-xs rounded-lg px-3 py-2.5 border border-white/25 ' +
  'focus:outline-none focus:border-cyan-400'

const SELECT_ADMIN =
  'w-full bg-white text-gray-800 text-xs rounded-lg px-3 py-2 border border-gray-200 ' +
  'focus:outline-none focus:border-[#2a5298]'

function ModalManual({
  idIngreso, onClose, onResult,
}: {
  idIngreso: number
  onClose: () => void
  onResult: (r: ResultadoScan, metodo: 'manual' | 'logistico') => void
}) {
  const [ci, setCi] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [registrar, { loading }] = useMutation(REGISTRAR_ACCESO_MANUAL_MUTATION)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ci.trim()) { setError('Ingresa un CI.'); return }
    setError('')
    try {
      const { data } = await registrar({ variables: { ci: ci.trim(), idIngreso } })
      const r = data?.registrarAccesoManual
      onResult({
        resultado: r?.resultado === 'PERMITIDO' ? 'PERMITIDO' : 'RECHAZADO',
        mensaje: r?.mensaje ?? '',
        nombre: r?.nombre,
        sede: r?.sede,
        facultad: r?.facultad,
        tipoPersona: r?.tipoPersona,
        tipoMovimiento: r?.tipoMovimiento,
      }, 'manual')
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#06101a]/97 border border-white/15 rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn [color-scheme:dark]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-white font-bold flex items-center gap-2"><span>⌨️</span> Registro Manual</h3>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wide">CI del usuario</label>
            <input ref={inputRef} value={ci} onChange={e => setCi(e.target.value)}
              placeholder="Número de carnet de identidad" className={INPUT_MODAL} autoComplete="off" />
            <p className="text-xs text-white/40 mt-2">El sistema detecta automáticamente si es entrada o salida.</p>
          </div>
          {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-semibold text-sm hover:bg-cyan-500/30 disabled:opacity-50">
            {loading ? 'Registrando...' : 'Registrar Acceso'}
          </button>
        </form>
      </div>
    </div>
  )
}

const MOTIVOS = ['Delivery', 'Proveedor', 'Mantenimiento', 'Mensajería', 'Visita rápida', 'Otro']

function ModalLogistico({
  idIngreso, onClose, onResult,
}: {
  idIngreso: number
  onClose: () => void
  onResult: (r: ResultadoScan, metodo: 'manual' | 'logistico') => void
}) {
  const [ci, setCi] = useState('')
  const [nombre, setNombre] = useState('')
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [mov, setMov] = useState<'entrada' | 'salida'>('entrada')
  const [error, setError] = useState('')
  const [registrar, { loading }] = useMutation(REGISTRAR_ACCESO_LOGISTICO_MUTATION)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ci.trim() || !nombre.trim()) { setError('CI y nombre son requeridos.'); return }
    setError('')
    try {
      const { data } = await registrar({
        variables: { ci: ci.trim(), nombreCompleto: nombre.trim(), motivo, tipoMovimiento: mov, idIngreso },
      })
      const r = data?.registrarAccesoLogistico
      onResult({
        resultado: r?.resultado === 'REGISTRADO' ? 'PERMITIDO' : 'RECHAZADO',
        mensaje: r?.mensaje ?? '',
        nombre: r?.nombre,
        tipoPersona: 'logistico',
        tipoMovimiento: r?.tipoMovimiento,
      }, 'logistico')
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#06101a]/97 border border-white/15 rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn [color-scheme:dark]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-white font-bold flex items-center gap-2"><span>🚚</span> Acceso Logístico</h3>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wide">CI</label>
              <input value={ci} onChange={e => setCi(e.target.value)} placeholder="Carnet"
                className={INPUT_MODAL + ' py-2.5 text-sm'} autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wide">Motivo</label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)} className={SELECT_MODAL}>
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wide">Nombre completo</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Apellidos y nombres"
              className={INPUT_MODAL} autoComplete="off" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setMov('entrada')}
              className={`py-3 rounded-xl text-sm font-semibold border transition-all
                ${mov === 'entrada' ? 'bg-green-500/20 border-green-400/50 text-green-300' : 'bg-white/5 border-white/10 text-white/40'}`}>
              🚪 Entrada
            </button>
            <button type="button" onClick={() => setMov('salida')}
              className={`py-3 rounded-xl text-sm font-semibold border transition-all
                ${mov === 'salida' ? 'bg-orange-500/20 border-orange-400/50 text-orange-300' : 'bg-white/5 border-white/10 text-white/40'}`}>
              🏃 Salida
            </button>
          </div>
          {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 font-semibold text-sm hover:bg-amber-500/30 disabled:opacity-50">
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function HistorialLista({
  registrosFiltrados,
  modo,
}: {
  registrosFiltrados: RegistroHoy[]
  modo: 'guardia' | 'admin'
}) {
  if (registrosFiltrados.length === 0) {
    return (
      <div className={`text-center py-10 ${modo === 'admin' ? 'text-gray-400' : 'text-white/25'}`}>
        <p className="text-2xl mb-2">📋</p>
        <p className="text-xs">Sin registros hoy</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {[...registrosFiltrados].reverse().map(r => (
        <div key={r.idRegistro}
          className={modo === 'admin'
            ? 'flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100'
            : 'flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 transition-colors'}>
          <span className="text-sm">
            {!r.accesoPermitido ? '❌' : r.tipoMovimiento === 'salida' ? '🏃' : '✅'}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium truncate ${modo === 'admin' ? 'text-gray-800' : 'text-white/90'}`}>
              {r.nombreCompleto}
            </p>
            <p className={`text-xs ${modo === 'admin' ? 'text-gray-400' : 'text-white/35'}`}>
              {new Date(r.fechaHora).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
              {r.tipoMovimiento ? ` · ${r.tipoMovimiento}` : ''}
              {r.metodo && r.metodo !== 'qr' ? ` · ${r.metodo}` : ''}
            </p>
          </div>
          <Badge tipo={r.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />
        </div>
      ))}
    </div>
  )
}

function ResultadoCard({ resultado, esPermitido, esEntrada, dark }: {
  resultado: ResultadoScan
  esPermitido: boolean
  esEntrada: boolean
  dark?: boolean
}) {
  const base = dark
    ? `${!esPermitido ? 'bg-red-500/15 border-red-400/30' : esEntrada ? 'bg-green-500/15 border-green-400/30' : 'bg-orange-500/15 border-orange-400/30'} border backdrop-blur-xl`
    : `${!esPermitido ? 'bg-red-50 border-red-200' : esEntrada ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} border`

  return (
    <div className={`w-full rounded-3xl p-8 text-center shadow-lg ${base}`}>
      <div className="text-6xl mb-4">{!esPermitido ? '❌' : esEntrada ? '🚪' : '🏃'}</div>
      <h2 className={`text-2xl font-extrabold mb-3 ${dark
        ? (!esPermitido ? 'text-red-300' : esEntrada ? 'text-green-300' : 'text-orange-300')
        : (!esPermitido ? 'text-red-700' : esEntrada ? 'text-green-700' : 'text-orange-700')}`}>
        {!esPermitido ? 'Acceso No Válido' : esEntrada ? 'Bienvenido/a' : 'Hasta luego'}
      </h2>
      {resultado.nombre && <p className={`font-bold text-lg mb-1 ${dark ? 'text-white' : 'text-gray-800'}`}>{resultado.nombre}</p>}
      <p className={`text-sm ${dark ? 'text-white/80' : 'text-gray-600'}`}>{resultado.mensaje}</p>
    </div>
  )
}

export interface PanelGuardiaOperativoProps {
  modo: 'guardia' | 'admin'
  panel: PanelData | null | undefined
  loadingPanel: boolean
  idIngreso: number
  onRefetch: () => Promise<unknown>
  onCambiarPorton?: () => void
}

export default function PanelGuardiaOperativo({
  modo, panel, loadingPanel, idIngreso, onRefetch, onCambiarPorton,
}: PanelGuardiaOperativoProps) {
  const esAdmin = modo === 'admin'
  const [estado, setEstado] = useState<Estado>('listo')
  const [resultado, setResultado] = useState<ResultadoScan | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showSeguridad, setShowSeguridad] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [showLogistico, setShowLogistico] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroAcceso, setFiltroAcceso] = useState('todos')
  const [filtroMov, setFiltroMov] = useState('todos')
  const [registrosLocal, setRegistrosLocal] = useState<RegistroHoy[]>([])

  const { logout } = useAuth()
  const [validarQR, { loading }] = useMutation(VALIDAR_QR_MUTATION)

  const registros = useMemo(() => {
    const server: RegistroHoy[] = panel?.registrosHoy ?? []
    const ids = new Set(server.map(r => r.idRegistro))
    const locales = registrosLocal.filter(r => !ids.has(r.idRegistro))
    return [...locales, ...server]
  }, [panel?.registrosHoy, registrosLocal])

  const now = new Date()
  const fechaHoy = `${DIAS[now.getDay()]} ${now.getDate()} de ${MESES[now.getMonth()]} ${now.getFullYear()}`

  useEffect(() => {
    if (estado !== 'resultado') return
    const t = setTimeout(() => { setEstado('listo'); setResultado(null) }, 3500)
    return () => clearTimeout(t)
  }, [estado])

  const handleValidarToken = useCallback(async (tokenHash: string) => {
    if (!tokenHash.trim() || !panel || !idIngreso || loading) return
    try {
      const { data } = await validarQR({ variables: { tokenHash: tokenHash.trim(), idIngreso } })
      const r = data?.validarQr
      setResultado({ ...r, tipoPersona: r?.tipoPersona ?? '', tipoMovimiento: r?.tipoMovimiento ?? '' })
      setEstado('resultado')
      await onRefetch()
    } catch (e: unknown) {
      setResultado({ resultado: 'ERROR', mensaje: (e as Error).message })
      setEstado('resultado')
    }
  }, [panel, validarQR, onRefetch, loading, idIngreso])

  const handleManualResult = async (r: ResultadoScan, metodo: 'manual' | 'logistico') => {
    const nombre = r.nombre?.trim()
    if (r.resultado === 'PERMITIDO' && nombre) {
      setRegistrosLocal(prev => [{
        idRegistro: -Date.now(),
        tipoPersona: r.tipoPersona ?? (metodo === 'logistico' ? 'logistico' : 'estudiante'),
        nombreCompleto: nombre,
        accesoPermitido: true,
        fechaHora: new Date().toISOString(),
        tipoMovimiento: r.tipoMovimiento,
        metodo,
      }, ...prev])
    }
    setResultado(r)
    setEstado('resultado')
    await onRefetch()
  }

  const entradas = registros.filter(r => r.accesoPermitido && r.tipoMovimiento === 'entrada').length
  const salidas = registros.filter(r => r.accesoPermitido && r.tipoMovimiento === 'salida').length
  const rechazados = registros.filter(r => !r.accesoPermitido).length

  const registrosFiltrados = registros.filter(r => {
    if (filtroTipo !== 'todos' && r.tipoPersona !== filtroTipo) return false
    if (filtroAcceso === 'permitido' && !r.accesoPermitido) return false
    if (filtroAcceso === 'rechazado' && r.accesoPermitido) return false
    if (filtroMov !== 'todos' && r.tipoMovimiento !== filtroMov) return false
    return true
  })

  const esPermitido = resultado?.resultado === 'PERMITIDO'
  const esEntrada = resultado?.tipoMovimiento === 'entrada'
  const selectClass = esAdmin ? SELECT_ADMIN : SELECT_DRAWER

  const filtrosHistorial = (
    <div className="space-y-2 mb-3">
      <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className={selectClass}>
        <option value="todos">Todos los tipos</option>
        {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <select value={filtroAcceso} onChange={e => setFiltroAcceso(e.target.value)} className={selectClass}>
          <option value="todos">Todos</option>
          <option value="permitido">OK ✅</option>
          <option value="rechazado">Neg ❌</option>
        </select>
        <select value={filtroMov} onChange={e => setFiltroMov(e.target.value)} className={selectClass}>
          <option value="todos">Movim.</option>
          <option value="entrada">🚪 Entrada</option>
          <option value="salida">🏃 Salida</option>
        </select>
      </div>
    </div>
  )

  const statsCards = (
    <div className="grid grid-cols-3 gap-2">
      <div className={`rounded-xl p-2.5 text-center border ${esAdmin ? 'bg-green-50 border-green-200' : 'bg-green-500/10 border-green-500/20'}`}>
        <p className={`text-xl font-extrabold ${esAdmin ? 'text-green-600' : 'text-green-400'}`}>{entradas}</p>
        <p className={`text-xs ${esAdmin ? 'text-green-600/70' : 'text-green-400/60'}`}>Entradas</p>
      </div>
      <div className={`rounded-xl p-2.5 text-center border ${esAdmin ? 'bg-orange-50 border-orange-200' : 'bg-orange-500/10 border-orange-500/20'}`}>
        <p className={`text-xl font-extrabold ${esAdmin ? 'text-orange-600' : 'text-orange-400'}`}>{salidas}</p>
        <p className={`text-xs ${esAdmin ? 'text-orange-600/70' : 'text-orange-400/60'}`}>Salidas</p>
      </div>
      <div className={`rounded-xl p-2.5 text-center border ${esAdmin ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/20'}`}>
        <p className={`text-xl font-extrabold ${esAdmin ? 'text-red-600' : 'text-red-400'}`}>{rechazados}</p>
        <p className={`text-xs ${esAdmin ? 'text-red-600/70' : 'text-red-400/60'}`}>Negados</p>
      </div>
    </div>
  )

  const scannerBlock = (
    <div className="flex flex-col items-center gap-4 w-full">
      {estado === 'listo' ? (
        <>
          {!esAdmin && (
            <div className="text-center w-full max-w-xs">
              <img src="/images/logo-uagrm-horizontal.png" alt="UAGRM"
                className="w-full max-w-xs mx-auto h-auto object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
                onError={e => { (e.target as HTMLImageElement).src = 'https://www.uagrm.edu.bo/img/logo-88x707-gray.png' }} />
            </div>
          )}
          <div className={`w-full rounded-2xl overflow-hidden border-2 ${esAdmin ? 'border-[#2a5298]/30 bg-gray-900' : 'border-cyan-400/30 bg-black/30'} shadow-xl`}>
            {loading ? (
              <div className="flex items-center justify-center py-16"><LoadingSpinner text="Validando..." /></div>
            ) : (
              <QrScanner active={!loading && !!panel} onScan={handleValidarToken} />
            )}
          </div>
          <p className={`text-xs tracking-widest uppercase text-center ${esAdmin ? 'text-gray-500' : 'text-white/30'}`}>
            Acerque el código QR a la cámara
          </p>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button type="button" onClick={() => setShowManual(true)}
              className={esAdmin
                ? 'flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1a3a6b] text-white text-sm font-medium hover:bg-[#2a5298]'
                : 'flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/8 border border-white/15 text-white/70 text-sm'}>
              ⌨️ <span>Registro Manual</span>
            </button>
            <button type="button" onClick={() => setShowLogistico(true)}
              className={esAdmin
                ? 'flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600'
                : 'flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/70 text-sm'}>
              🚚 <span>Acceso Logístico</span>
            </button>
          </div>
        </>
      ) : resultado && (
        <ResultadoCard resultado={resultado} esPermitido={!!esPermitido} esEntrada={!!esEntrada} dark={!esAdmin} />
      )}
    </div>
  )

  if (loadingPanel) {
    if (esAdmin) {
      return <div className="flex justify-center py-20"><LoadingSpinner text="Cargando panel..." /></div>
    }
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <LoginBackground />
        <div className="relative z-10 text-white"><LoadingSpinner text="Cargando panel..." /></div>
      </div>
    )
  }

  if (esAdmin) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-card p-4 md:p-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1a3a6b]">👮 Panel Guardia</h1>
            <p className="text-sm text-gray-600 mt-1">
              Operando en: <strong>{panel?.ingresoNombre}</strong> — {panel?.facultadNombre}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              🏙️ {panel?.sedeNombre} · 📅 {fechaHoy}
              {panel?.guardiaAsignadoNombre
                ? ` · Guardia asignado: ${panel.guardiaAsignadoNombre}`
                : ' · Sin guardia asignado'}
            </p>
            <p className="text-xs text-[#2a5298] mt-1">Operador: {panel?.nombreCompleto}</p>
          </div>
          {onCambiarPorton && (
            <button type="button" onClick={onCambiarPorton}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
              Cambiar portón
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-card p-4 md:p-6">{scannerBlock}</div>
          <div className="bg-white rounded-xl shadow-card p-4 md:p-6 flex flex-col min-h-[420px]">
            <p className="font-semibold text-sm text-[#1a3a6b] mb-3">Historial del día — {panel?.ingresoNombre}</p>
            {statsCards}
            <div className="mt-4 flex-1 flex flex-col min-h-0">
              {filtrosHistorial}
              <div className="flex-1 overflow-y-auto max-h-[360px]">
                <HistorialLista registrosFiltrados={registrosFiltrados} modo="admin" />
              </div>
            </div>
          </div>
        </div>

        {showManual && <ModalManual idIngreso={idIngreso} onClose={() => setShowManual(false)} onResult={handleManualResult} />}
        {showLogistico && <ModalLogistico idIngreso={idIngreso} onClose={() => setShowLogistico(false)} onResult={handleManualResult} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <LoginBackground />
      <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú"
        className="fixed top-4 left-4 z-40 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-3 rounded-xl border border-white/20 shadow-lg">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />}

      <aside className={`fixed top-0 left-0 h-full w-80 z-50 flex flex-col bg-[#04080c]/96 backdrop-blur-2xl border-r border-white/10 shadow-2xl transition-transform duration-300 [color-scheme:dark] ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="bg-white/5 px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl p-2.5 text-xl">👮</div>
            <div>
              <p className="font-bold text-white text-sm">{panel?.nombreCompleto || 'Guardia'}</p>
              <p className="text-cyan-400 text-xs">Personal de Seguridad</p>
            </div>
          </div>
          <button type="button" onClick={() => setDrawerOpen(false)} className="text-white/40 hover:text-white text-lg">✕</button>
        </div>
        <div className="px-5 py-4 border-b border-white/10 space-y-2">
          <p className="text-blue-200 text-xs">📍 {panel?.ingresoNombre} — {panel?.facultadNombre}</p>
          <p className="text-blue-300 text-xs">🕐 Horario: {panel?.horario?.replace('-', ' - ') || '07:00 - 22:00'}</p>
          <p className="text-blue-300 text-xs">🏙️ {panel?.sedeNombre} | 📅 {fechaHoy}</p>
          {statsCards}
          <button type="button" onClick={() => { setShowSeguridad(true); setDrawerOpen(false) }}
            className="w-full mt-1 text-xs bg-white/8 hover:bg-white/15 text-blue-200 px-3 py-2 rounded-lg border border-white/10">
            🔐 Seguridad (2FA)
          </button>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden px-4 pt-4 pb-4">
          <p className="text-white font-semibold text-xs uppercase tracking-widest mb-3">Historial del día</p>
          {filtrosHistorial}
          <div className="flex-1 overflow-y-auto min-h-0">
            <HistorialLista registrosFiltrados={registrosFiltrados} modo="guardia" />
          </div>
          <button type="button" onClick={logout}
            className="w-full mt-3 flex-shrink-0 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs font-semibold px-3 py-2.5 rounded-lg">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{scannerBlock}</div>
      </main>

      {showManual && <ModalManual idIngreso={idIngreso} onClose={() => setShowManual(false)} onResult={handleManualResult} />}
      {showLogistico && <ModalLogistico idIngreso={idIngreso} onClose={() => setShowLogistico(false)} onResult={handleManualResult} />}
      {showSeguridad && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#04080c]/95 border border-white/15 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-white/5 px-6 py-4 flex items-center justify-between border-b border-white/10 sticky top-0">
              <h3 className="font-bold text-white">Seguridad de la cuenta</h3>
              <button type="button" onClick={() => setShowSeguridad(false)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-5"><Seguridad2FA /></div>
          </div>
        </div>
      )}
    </div>
  )
}
