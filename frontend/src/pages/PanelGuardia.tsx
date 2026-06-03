import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { VALIDAR_QR_MUTATION } from '../graphql/mutations'
import { MI_PANEL_GUARDIA_QUERY } from '../graphql/queries'
import LoginBackground from '../components/LoginBackground'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Seguridad2FA from '../components/Seguridad2FA'
import QrScanner from '../components/QrScanner'
import { useAuth } from '../context/AuthContext'
import type { ValidarQRResponse } from '../types'

const TIPOS = [
  { value: 'estudiante',       label: 'Estudiante',       icon: '🎓', color: 'from-blue-500/80 to-blue-700/80',     border: 'border-blue-400/40' },
  { value: 'docente',          label: 'Docente',           icon: '👨‍🏫', color: 'from-violet-500/80 to-violet-700/80', border: 'border-violet-400/40' },
  { value: 'administrativo',   label: 'Administrativo',   icon: '🏢', color: 'from-teal-500/80 to-teal-700/80',    border: 'border-teal-400/40' },
  { value: 'personal_externo', label: 'Pers. Externo',    icon: '🔧', color: 'from-orange-500/80 to-orange-700/80', border: 'border-orange-400/40' },
  { value: 'invitado',         label: 'Invitado',          icon: '👥', color: 'from-pink-500/80 to-pink-700/80',    border: 'border-pink-400/40' },
]

const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type Estado = 'seleccion' | 'camara' | 'resultado'

export default function PanelGuardia() {
  const [tipoPersona, setTipoPersona]     = useState<string | null>(null)
  const [estado, setEstado]               = useState<Estado>('seleccion')
  const [resultado, setResultado]         = useState<(ValidarQRResponse & { tipoPersona?: string }) | null>(null)
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [showSeguridad, setShowSeguridad] = useState(false)
  const [filtroTipo, setFiltroTipo]       = useState('todos')
  const [filtroAcceso, setFiltroAcceso]   = useState('todos')

  const { logout } = useAuth()
  const [validarQR, { loading }] = useMutation(VALIDAR_QR_MUTATION)
  const { data: panelData, loading: loadingPanel, refetch } = useQuery(MI_PANEL_GUARDIA_QUERY, {
    fetchPolicy: 'network-only',
  })

  const panel    = panelData?.miPanelGuardia
  const registros = panel?.registrosHoy ?? []

  const now      = new Date()
  const fechaHoy = `${DIAS[now.getDay()]} ${now.getDate()} de ${MESES[now.getMonth()]} ${now.getFullYear()}`

  // Auto-dismiss resultado después de 3.5 segundos
  useEffect(() => {
    if (estado !== 'resultado') return
    const t = setTimeout(() => {
      setEstado('seleccion')
      setTipoPersona(null)
      setResultado(null)
    }, 3500)
    return () => clearTimeout(t)
  }, [estado])

  const handleSeleccionarTipo = (tipo: string) => {
    setTipoPersona(tipo)
    setEstado('camara')
  }

  const handleValidarToken = useCallback(async (tokenHash: string) => {
    if (!tokenHash.trim() || !panel) return
    const idIngreso = panel.ingresoId ?? 1
    try {
      const { data } = await validarQR({
        variables: { tokenHash: tokenHash.trim(), idIngreso, tipoPersonaSeleccionado: tipoPersona },
      })
      setResultado({ ...data?.validarQr, tipoPersona: tipoPersona ?? '' })
      setEstado('resultado')
      refetch()
    } catch (e: unknown) {
      setResultado({ resultado: 'ERROR', mensaje: (e as Error).message, tipoPersona: tipoPersona ?? '' })
      setEstado('resultado')
    }
  }, [panel, tipoPersona, validarQR, refetch])

  const permitidos  = registros.filter((r: { accesoPermitido: boolean }) => r.accesoPermitido).length
  const rechazados  = registros.length - permitidos

  const registrosFiltrados = registros.filter((r: { tipoPersona: string; accesoPermitido: boolean }) => {
    if (filtroTipo !== 'todos' && r.tipoPersona !== filtroTipo) return false
    if (filtroAcceso === 'permitido' && !r.accesoPermitido) return false
    if (filtroAcceso === 'rechazado' && r.accesoPermitido) return false
    return true
  })

  const tipoInfo = TIPOS.find(t => t.value === tipoPersona)

  if (loadingPanel) return (
    <div className="min-h-screen relative flex items-center justify-center">
      <LoginBackground />
      <div className="relative z-10 text-white"><LoadingSpinner text="Cargando panel..." /></div>
    </div>
  )

  return (
    <div className="min-h-screen relative overflow-hidden">
      <LoginBackground />

      {/* ── Botón abrir drawer (arriba izquierda) ── */}
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
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Drawer lateral izquierdo ── */}
      <aside className={`fixed top-0 left-0 h-full w-80 z-50 flex flex-col
        bg-[#04080c]/96 backdrop-blur-2xl border-r border-white/10 shadow-2xl
        transition-transform duration-300 ease-in-out
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Header del drawer */}
        <div className="bg-white/5 px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl p-2.5 text-xl">👮</div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">{panel?.nombreCompleto || 'Guardia'}</p>
              <p className="text-cyan-400 text-xs">Personal de Seguridad</p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-white/40 hover:text-white text-lg transition-colors leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Info del puesto */}
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

          {/* Stats de ingresos */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/10">
              <p className="text-xl font-extrabold text-white">{registros.length}</p>
              <p className="text-xs text-white/40 leading-tight">Total</p>
            </div>
            <div className="bg-green-500/10 rounded-xl p-2.5 text-center border border-green-500/20">
              <p className="text-xl font-extrabold text-green-400">{permitidos}</p>
              <p className="text-xs text-green-400/60 leading-tight">OK</p>
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
            🔐 Seguridad (2FA opcional)
          </button>
        </div>

        {/* Historial */}
        <div className="flex-1 flex flex-col overflow-hidden px-4 pt-4 pb-4">
          <p className="text-white font-semibold text-xs uppercase tracking-widest mb-3 flex-shrink-0">
            Historial de ingresos
          </p>

          {/* Filtros */}
          <div className="space-y-2 mb-3 flex-shrink-0">
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="w-full bg-white/8 text-white/80 text-xs rounded-lg px-3 py-2
                border border-white/15 focus:outline-none focus:border-cyan-400 transition-colors"
            >
              <option value="todos" className="bg-[#04080c]">Todos los tipos</option>
              {TIPOS.map(t => <option key={t.value} value={t.value} className="bg-[#04080c]">{t.label}</option>)}
            </select>
            <select
              value={filtroAcceso}
              onChange={e => setFiltroAcceso(e.target.value)}
              className="w-full bg-white/8 text-white/80 text-xs rounded-lg px-3 py-2
                border border-white/15 focus:outline-none focus:border-cyan-400 transition-colors"
            >
              <option value="todos" className="bg-[#04080c]">Todos los accesos</option>
              <option value="permitido" className="bg-[#04080c]">Solo permitidos ✅</option>
              <option value="rechazado" className="bg-[#04080c]">Solo rechazados ❌</option>
            </select>
          </div>

          {/* Lista */}
          {/* Cerrar sesión */}
          <button
            type="button"
            onClick={logout}
            className="w-full mb-3 flex-shrink-0 flex items-center justify-center gap-2
              bg-red-500/15 hover:bg-red-500/30 border border-red-500/30
              text-red-300 hover:text-red-200 text-xs font-semibold
              px-3 py-2.5 rounded-lg transition-all duration-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
                accesoPermitido: boolean; fechaHora: string;
              }) => (
                <div key={r.idRegistro}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5
                    border border-white/8 hover:bg-white/10 transition-colors">
                  <span className="text-sm">{r.accesoPermitido ? '✅' : '❌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/90 truncate">{r.nombreCompleto}</p>
                    <p className="text-xs text-white/35">
                      {new Date(r.fechaHora).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
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

        {/* Estado 0 — Selección de tipo */}
        {estado === 'seleccion' && (
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl animate-fadeIn">

            {/* Logo horizontal oficial UAGRM */}
            <div className="text-center w-full max-w-lg">
              <img
                src="/images/logo-uagrm-horizontal.png"
                alt="Universidad Autónoma Gabriel René Moreno"
                className="w-full max-w-md mx-auto h-auto object-contain
                  drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
                onError={e => {
                  (e.target as HTMLImageElement).src = 'https://www.uagrm.edu.bo/img/logo-88x707-gray.png'
                }}
              />
              <div className="flex items-center justify-center gap-3 mt-3">
                <div className="h-px flex-1 max-w-[90px] bg-gradient-to-r from-transparent to-cyan-500/50" />
                <p className="text-white/45 text-xs tracking-[0.25em] uppercase font-medium">
                  Control Peatonal
                </p>
                <div className="h-px flex-1 max-w-[90px] bg-gradient-to-l from-transparent to-cyan-500/50" />
              </div>
            </div>

            {/* Tarjetas de tipo */}
            <div className="w-full space-y-4">
              <p className="text-white/40 text-xs text-center uppercase tracking-widest">
                ¿Quién desea ingresar?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => handleSeleccionarTipo(t.value)}
                    className={`bg-gradient-to-br ${t.color} backdrop-blur-sm
                      py-7 px-4 rounded-2xl flex flex-col items-center gap-3
                      border ${t.border} shadow-lg
                      hover:scale-105 hover:shadow-2xl hover:brightness-110
                      active:scale-95 transition-all duration-200 group`}
                  >
                    <span className="text-5xl group-hover:scale-110 transition-transform duration-200 drop-shadow">
                      {t.icon}
                    </span>
                    <span className="text-white font-bold text-base tracking-wide drop-shadow">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Estado 1 — Cámara activa */}
        {estado === 'camara' && tipoInfo && (
          <div className="flex flex-col items-center gap-5 w-full max-w-xs animate-fadeIn">
            {/* Chip del tipo seleccionado */}
            <div className="text-center space-y-1">
              <span className="text-6xl drop-shadow-lg">{tipoInfo.icon}</span>
              <p className="text-white font-bold text-xl mt-2 drop-shadow">{tipoInfo.label}</p>
              <p className="text-white/40 text-xs tracking-wide">Acerca el código QR a la cámara</p>
            </div>

            {/* Marco de la cámara */}
            <div className={`w-full rounded-2xl overflow-hidden border-2 ${tipoInfo.border}
              shadow-2xl bg-black/30 backdrop-blur-sm`}>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <LoadingSpinner text="Validando..." />
                </div>
              ) : (
                <QrScanner active={!loading} onScan={handleValidarToken} />
              )}
            </div>

            {/* Volver */}
            <button
              type="button"
              onClick={() => { setEstado('seleccion'); setTipoPersona(null) }}
              disabled={loading}
              className="text-white/35 hover:text-white/70 text-sm transition-colors
                disabled:opacity-30 flex items-center gap-1.5 mt-1"
            >
              ← Cambiar tipo de persona
            </button>
          </div>
        )}

        {/* Estado 2 — Resultado */}
        {estado === 'resultado' && resultado && (
          <div className="flex flex-col items-center w-full max-w-sm animate-scaleIn">
            <div className={`w-full rounded-3xl p-8 text-center border shadow-2xl backdrop-blur-xl
              ${resultado.resultado === 'PERMITIDO'
                ? 'bg-green-500/15 border-green-400/30 shadow-green-500/20'
                : 'bg-red-500/15 border-red-400/30 shadow-red-500/20'
              }`}>

              {/* Ícono grande */}
              <div className="text-8xl mb-4 leading-none">
                {resultado.resultado === 'PERMITIDO' ? '✅' : '❌'}
              </div>

              {/* Título */}
              <h2 className={`text-3xl font-extrabold mb-3 drop-shadow-lg
                ${resultado.resultado === 'PERMITIDO' ? 'text-green-300' : 'text-red-300'}`}>
                {resultado.resultado === 'PERMITIDO' ? '¡Bienvenido/a!' : 'Acceso Denegado'}
              </h2>

              {/* Nombre */}
              {resultado.nombre && (
                <p className="text-white font-bold text-lg mb-1">{resultado.nombre}</p>
              )}

              {/* Mensaje */}
              <p className={`text-sm leading-relaxed
                ${resultado.resultado === 'PERMITIDO' ? 'text-green-200/80' : 'text-red-200/80'}`}>
                {resultado.mensaje}
              </p>

              {/* Detalles */}
              {(resultado.facultad || resultado.sede) && (
                <p className="text-white/40 text-xs mt-3">
                  🏛️ {resultado.facultad}{resultado.sede ? ` — ${resultado.sede}` : ''}
                </p>
              )}

              {resultado.tipoPersona && (
                <div className="flex justify-center mt-3">
                  <Badge tipo={resultado.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />
                </div>
              )}

              {/* Barra de progreso */}
              <div className="mt-6 w-full bg-white/10 rounded-full h-1 overflow-hidden">
                <div className={`h-1 rounded-full animate-shrink
                  ${resultado.resultado === 'PERMITIDO' ? 'bg-green-400' : 'bg-red-400'}`} />
              </div>
              <p className="text-white/25 text-xs mt-2">Volviendo al inicio...</p>
            </div>
          </div>
        )}
      </main>

      {/* ── Modal Seguridad 2FA ── */}
      {showSeguridad && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#04080c]/95 border border-white/15 rounded-2xl shadow-2xl
            w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="bg-white/5 px-6 py-4 rounded-t-2xl flex items-center justify-between
              border-b border-white/10 sticky top-0">
              <h3 className="font-bold text-white">Seguridad de la cuenta</h3>
              <button
                type="button"
                onClick={() => setShowSeguridad(false)}
                className="text-white/40 hover:text-white text-xl transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-5"><Seguridad2FA /></div>
          </div>
        </div>
      )}
    </div>
  )
}
