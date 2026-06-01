import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  LOGIN_MUTATION,
  VERIFICAR_LOGIN_2FA_MUTATION,
} from '../graphql/mutations'
import { useAuth } from '../context/AuthContext'
import type { AuthUser } from '../context/AuthContext'
import LoginBackground from '../components/LoginBackground'

type TipoUsuario = Exclude<AuthUser['tipo_usuario'], 'guardia'> | 'administrativo'

interface RolConfig {
  value: TipoUsuario
  label: string
  tituloLogin: string
  iconLocal: string
  iconRemoto: string
}

const TODOS_LOS_ROLES: RolConfig[] = [
  {
    value: 'estudiante',
    label: 'ESTUDIANTE',
    tituloLogin: 'Estudiantes',
    iconLocal: '/images/icono-estudiante.png',
    iconRemoto: 'https://perfil.uagrm.edu.bo/img/estudiante.png',
  },
  {
    value: 'docente',
    label: 'DOCENTE',
    tituloLogin: 'Docentes',
    iconLocal: '/images/icono-docente.png',
    iconRemoto: 'https://perfil.uagrm.edu.bo/img/docente.png',
  },
  {
    value: 'administrativo',
    label: 'ADMINISTRATIVO',
    tituloLogin: 'Administrativos',
    iconLocal: '/images/icono-administrativo.png',
    iconRemoto: 'https://perfil.uagrm.edu.bo/img/administrativo.png',
  },
  {
    value: 'personal_externo',
    label: 'PERSONAL EXTERNO',
    tituloLogin: 'Personal Externo',
    iconLocal: '/images/icono-externo.svg',
    iconRemoto: '/images/icono-externo.svg',
  },
]

const LOGO_LOCAL = '/images/logo-uagrm-horizontal.png'
const LOGO_REMOTO = 'https://www.uagrm.edu.bo/img/logo-88x707-gray.png'

const LOGIN_TEXT_SHADOW =
  '[text-shadow:0_1px_8px_rgba(0,0,0,0.95),0_2px_18px_rgba(0,0,0,0.75)]'
const LOGIN_TITLE_SHADOW =
  '[text-shadow:0_2px_14px_rgba(0,0,0,1),0_0_32px_rgba(0,0,0,0.85)]'

/** Solo borde sutil: el fondo de partículas se ve a través */
const FORM_SHELL = 'rounded-md overflow-hidden border border-white/30 bg-transparent'
const FORM_HEADER = 'border-b border-white/25 py-2.5 text-center bg-transparent'
const FORM_HEADER_TEXT = `text-sm text-white font-semibold ${LOGIN_TEXT_SHADOW}`
const INPUT_CLASS =
  `w-full rounded px-4 py-3 text-sm font-medium text-white bg-transparent border border-white/35
  placeholder:text-gray-200 placeholder:font-normal ${LOGIN_TEXT_SHADOW}
  focus:outline-none focus:border-cyan-300/80 focus:ring-1 focus:ring-cyan-400/50 transition-all duration-200`
const LINK_CLASS = `text-sm text-white font-medium hover:text-cyan-100 hover:underline ${LOGIN_TEXT_SHADOW}`

type Pantalla = 'seleccion' | 'login' | 'codigo_2fa'

function IconoRol({
  src, alt, remoto, grande,
}: {
  src: string; alt: string; remoto: string; grande?: boolean
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={`w-auto object-contain object-bottom transition-all duration-300
        ${grande ? 'max-h-[80px] md:max-h-[96px]' : 'max-h-[58px] md:max-h-[68px]'}`}
      onError={(e) => { (e.target as HTMLImageElement).src = remoto }}
    />
  )
}

function TarjetaPerfil({
  rol,
  resaltada,
  atenuada,
  onElegir,
  onPointerEnter,
}: {
  rol: RolConfig
  resaltada: boolean
  atenuada: boolean
  onElegir: () => void
  onPointerEnter: () => void
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      onMouseEnter={onPointerEnter}
      onFocus={onPointerEnter}
      className={`
        relative flex flex-col overflow-hidden bg-[#ececec] border border-gray-200/70
        transition-all duration-300 ease-out cursor-pointer focus:outline-none
        focus-visible:ring-2 focus-visible:ring-[#1a3a6b]/50
        ${resaltada
          ? 'w-[118px] sm:w-[132px] h-[138px] sm:h-[152px] z-20 shadow-[0_14px_32px_rgba(0,0,0,0.22)] -translate-y-1'
          : 'w-[92px] sm:w-[102px] h-[108px] sm:h-[118px] z-0 shadow-sm'}
        ${atenuada ? 'opacity-50 scale-[0.92]' : 'opacity-100 scale-100'}
      `}
      aria-label={rol.tituloLogin}
    >
      <div className="flex-1 flex items-end justify-center px-2 pt-3 pb-1 min-h-0">
        <IconoRol
          src={rol.iconLocal}
          alt={rol.tituloLogin}
          remoto={rol.iconRemoto}
          grande={resaltada}
        />
      </div>
      <div
        className={`
          w-full bg-[#1a3a6b] text-white text-center font-bold tracking-wider
          transition-all duration-300 ease-out overflow-hidden
          ${resaltada ? 'py-2.5 text-[11px] sm:text-xs opacity-100 max-h-12' : 'py-0 text-[10px] opacity-0 max-h-0'}
        `}
      >
        {rol.label}
      </div>
    </button>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { login, user } = useAuth()

  const [pantalla, setPantalla] = useState<Pantalla>('seleccion')
  const [rolSeleccionado, setRolSeleccionado] = useState<TipoUsuario | null>(null)
  const [hoverRol, setHoverRol] = useState<TipoUsuario | null>(null)

  const [ci, setCi] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPass, setMostrarPass] = useState(false)
  const [error, setError] = useState('')
  const [codigo, setCodigo] = useState('')
  const [partialToken, setPartialToken] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [doLogin, { loading }] = useMutation(LOGIN_MUTATION)
  const [verificar2FA, { loading: loading2FA }] = useMutation(VERIFICAR_LOGIN_2FA_MUTATION)

  if (user) {
    if (user.rol === 'admin') navigate('/admin', { replace: true })
    else if (user.rol === 'guardia') navigate('/panel-guardia', { replace: true })
    else navigate('/perfil', { replace: true })
  }

  const rolConfig = TODOS_LOS_ROLES.find(r => r.value === rolSeleccionado) ?? null
  const rolActivo = hoverRol

  const redirigir = (rol: string) => {
    if (rol === 'admin') navigate('/admin')
    else if (rol === 'guardia') navigate('/panel-guardia')
    else navigate('/perfil')
  }

  const elegirRol = (tipo: TipoUsuario) => {
    setRolSeleccionado(tipo)
    setError('')
    setCi('')
    setPassword('')
    setPantalla('login')
  }

  const volverSeleccion = () => {
    setPantalla('seleccion')
    setRolSeleccionado(null)
    setHoverRol(null)
    setError('')
    setCodigo('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rolSeleccionado) return
    setError('')
    try {
      const { data } = await doLogin({
        variables: { ci, password, tipoUsuario: rolSeleccionado },
      })
      const res = data?.login
      if (!res?.token && !res?.needs2fa) {
        setError(res?.message || 'Error al iniciar sesión.')
        return
      }
      if (res.needs2fa) {
        setPartialToken(res.partialToken)
        setNombreUsuario(`${res.nombres} ${res.apellidos}`)
        setPantalla('codigo_2fa')
        return
      }
      login(res.token, {
        id_usuario: 0,
        tipo_usuario: res.tipoUsuario as AuthUser['tipo_usuario'],
        rol: res.rol as AuthUser['rol'],
        nombres: res.nombres,
        apellidos: res.apellidos,
      })
      redirigir(res.rol)
    } catch {
      setError('No se pudo conectar con el servidor.')
    }
  }

  const handleVerificar = async () => {
    setError('')
    if (codigo.length !== 6) { setError('El código debe tener 6 dígitos.'); return }
    try {
      const { data } = await verificar2FA({ variables: { partialToken, codigo } })
      const res = data?.verificarLogin2fa
      if (!res?.token) { setError(res?.message || 'Código incorrecto.'); return }
      login(res.token, {
        id_usuario: 0,
        tipo_usuario: res.tipoUsuario as AuthUser['tipo_usuario'],
        rol: res.rol as AuthUser['rol'],
        nombres: res.nombres,
        apellidos: res.apellidos,
      })
      redirigir(res.rol)
    } catch {
      setError('Error al verificar el código.')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-4 py-10">
      <LoginBackground />

      <div className="relative z-10 w-full flex flex-col items-center max-w-5xl">

      {/* Logo UAGRM — horizontal gris (oficial) */}
      <header className="text-center mb-10 w-full max-w-2xl">
        <img
          src={LOGO_LOCAL}
          alt="Universidad Autónoma Gabriel René Moreno"
          className="w-full max-w-xl mx-auto h-auto object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
          onError={(e) => { (e.target as HTMLImageElement).src = LOGO_REMOTO }}
        />
      </header>

      {/* ── Selección de perfil (estilo perfil.uagrm.edu.bo) ── */}
      {pantalla === 'seleccion' && (
        <main className="w-full max-w-4xl fade-in text-center">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#8B1A1A] mb-3 tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
            Bienvenido al Perfil
          </h1>
          <p className="text-[#e8e4e6] font-semibold text-base md:text-lg mb-10">
            Elige tu tipo de cuenta
          </p>

          <div
            className="flex flex-wrap items-end justify-center gap-3 sm:gap-4 md:gap-5 mb-8 min-h-[160px] sm:min-h-[168px]"
            onMouseLeave={() => setHoverRol(null)}
          >
            {TODOS_LOS_ROLES.map(rol => (
              <TarjetaPerfil
                key={rol.value}
                rol={rol}
                resaltada={rolActivo === rol.value}
                atenuada={rolActivo !== null && rolActivo !== rol.value}
                onElegir={() => elegirRol(rol.value)}
                onPointerEnter={() => setHoverRol(rol.value)}
              />
            ))}
          </div>

          <p className="text-sm">
            <button
              type="button"
              className="text-[#d8d2d5] hover:text-white hover:underline font-medium transition-colors"
              onClick={() => {}}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </p>
        </main>
      )}

      {/* ── Formulario de login ── */}
      {pantalla === 'login' && rolConfig && (
        <div className="w-full max-w-md fade-in">
          <div className={FORM_SHELL}>
            <div className={FORM_HEADER}>
              <span className={FORM_HEADER_TEXT}>Inicio de sesión</span>
            </div>

            <div className="px-8 py-8">
              <h2 className={`text-2xl md:text-3xl font-bold text-white text-center mb-8 ${LOGIN_TITLE_SHADOW}`}>
                {rolConfig.tituloLogin}
              </h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="text"
                  value={ci}
                  onChange={e => setCi(e.target.value)}
                  placeholder="Carnet de identidad"
                  required
                  autoFocus
                  className={INPUT_CLASS}
                />

                <div className="relative">
                  <input
                    type={mostrarPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Contraseña"
                    required
                    className={`${INPUT_CLASS} pr-10`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setMostrarPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
                    aria-label={mostrarPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {mostrarPass ? '🙈' : '👁'}
                  </button>
                </div>

                {error && (
                  <div className={`text-red-100 text-sm font-medium rounded px-3 py-2 border border-red-400/50 bg-red-950/25 ${LOGIN_TEXT_SHADOW}`}>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-[#8B1A1A]/75 hover:bg-[#8B1A1A]/90 text-white font-semibold py-3 rounded
                    border border-white/25 transition-all duration-200 disabled:opacity-50 text-sm tracking-wide ${LOGIN_TEXT_SHADOW}`}
                >
                  {loading ? 'Verificando...' : 'Iniciar Sesión'}
                </button>
              </form>

              <p className="text-center mt-5">
                <button type="button" onClick={volverSeleccion} className={LINK_CLASS}>
                  ← Elegir otro tipo de cuenta
                </button>
              </p>
            </div>
          </div>

          <p className="text-center mt-4">
            <button type="button" className={LINK_CLASS}>
              ¿Olvidaste tu contraseña?
            </button>
          </p>
        </div>
      )}

      {/* ── 2FA ── */}
      {pantalla === 'codigo_2fa' && (
        <div className="w-full max-w-md fade-in">
          <div className={FORM_SHELL}>
            <div className={FORM_HEADER}>
              <span className={FORM_HEADER_TEXT}>Verificación en dos pasos</span>
            </div>

            <div className="px-8 py-8 space-y-5">
              <div className="text-center">
                <div className="text-4xl mb-2 drop-shadow-lg">🔐</div>
                <p className={`text-sm text-white ${LOGIN_TEXT_SHADOW}`}>
                  Hola, <strong>{nombreUsuario}</strong>
                </p>
                <p className={`text-xs text-gray-100 mt-2 ${LOGIN_TEXT_SHADOW}`}>
                  Ingresa el código de 6 dígitos de Google Authenticator
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                className={`${INPUT_CLASS} py-4 text-center text-2xl font-mono tracking-[0.4em]`}
              />
              {error && (
                <div className={`text-red-100 text-sm font-medium rounded px-3 py-2 border border-red-400/50 bg-red-950/25 ${LOGIN_TEXT_SHADOW}`}>
                  ⚠️ {error}
                </div>
              )}
              <button
                type="button"
                onClick={handleVerificar}
                disabled={loading2FA}
                className={`w-full bg-[#8B1A1A]/75 hover:bg-[#8B1A1A]/90 text-white font-semibold py-3 rounded
                  border border-white/25 disabled:opacity-50 text-sm ${LOGIN_TEXT_SHADOW}`}
              >
                {loading2FA ? 'Verificando...' : 'Verificar código'}
              </button>
              <button
                type="button"
                onClick={volverSeleccion}
                className={`w-full ${LINK_CLASS}`}
              >
                ← Volver
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-10 text-xs text-gray-400 text-center">
        Sistema de Control Peatonal — UAGRM
      </footer>

      </div>
    </div>
  )
}
