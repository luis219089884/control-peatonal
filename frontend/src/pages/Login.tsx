import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  LOGIN_MUTATION,
  VERIFICAR_LOGIN_2FA_MUTATION,
} from '../graphql/mutations'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import type { AuthUser } from '../context/AuthContext'

type TipoUsuario = Exclude<AuthUser['tipo_usuario'], 'guardia'> | 'administrativo'

interface RolConfig {
  value: TipoUsuario
  label: string
  tituloLogin: string
  descripcion: string
}

const ROLES: RolConfig[] = [
  {
    value: 'estudiante',
    label: 'ESTUDIANTE',
    tituloLogin: 'Estudiantes',
    descripcion: 'Acceso con carnet y contraseña institucional',
  },
  {
    value: 'docente',
    label: 'DOCENTE',
    tituloLogin: 'Docentes',
    descripcion: 'Personal docente de la universidad',
  },
  {
    value: 'administrativo',
    label: 'ADMINISTRATIVO',
    tituloLogin: 'Administrativos',
    descripcion: 'Personal administrativo UAGRM',
  },
  {
    value: 'personal_externo',
    label: 'PERSONAL EXTERNO',
    tituloLogin: 'Personal Externo',
    descripcion: 'Empresas contratadas, proveedores y seguridad',
  },
]

type Pantalla = 'seleccion' | 'login' | 'codigo_2fa'

const ICONOS_IMG: Partial<Record<TipoUsuario, { local: string; remoto: string }>> = {
  estudiante: {
    local: '/images/icono-estudiante.png',
    remoto: 'https://perfil.uagrm.edu.bo/img/estudiante.png',
  },
}

function IconoEstudiante({ activo }: { activo: boolean }) {
  const cfg = ICONOS_IMG.estudiante!
  return (
    <img
      src={cfg.local}
      alt="Estudiante"
      className={`h-full w-auto max-h-24 object-contain object-bottom transition-all duration-300
        ${activo ? 'opacity-100' : 'opacity-55 grayscale'}`}
      onError={(e) => { (e.target as HTMLImageElement).src = cfg.remoto }}
    />
  )
}

function IconoDocente({ activo }: { activo: boolean }) {
  return (
    <svg viewBox="0 0 80 100" className={`w-full h-full ${activo ? 'text-gray-900' : 'text-gray-400'}`} fill="currentColor">
      <rect x="8" y="12" width="64" height="40" rx="2" opacity="0.15" />
      <rect x="12" y="16" width="56" height="32" rx="1" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <circle cx="40" cy="58" r="9" />
      <path d="M26 78 Q40 68 54 78 L54 92 L26 92 Z" />
      <rect x="34" y="8" width="12" height="8" rx="1" />
    </svg>
  )
}

function IconoAdministrativo({ activo }: { activo: boolean }) {
  return (
    <svg viewBox="0 0 80 100" className={`w-full h-full ${activo ? 'text-gray-900' : 'text-gray-400'}`} fill="currentColor">
      <rect x="14" y="20" width="52" height="32" rx="2" opacity="0.2" />
      <rect x="18" y="24" width="44" height="24" rx="1" opacity="0.35" />
      <circle cx="40" cy="62" r="9" />
      <path d="M24 82 Q40 72 56 82 L56 94 L24 94 Z" />
    </svg>
  )
}

function IconoExterno({ activo }: { activo: boolean }) {
  return (
    <svg viewBox="0 0 80 100" className={`w-full h-full ${activo ? 'text-gray-900' : 'text-gray-400'}`} fill="currentColor">
      <rect x="20" y="14" width="40" height="28" rx="2" opacity="0.2" />
      <path d="M28 42 L40 30 L52 42 Z" opacity="0.4" />
      <circle cx="40" cy="58" r="9" />
      <path d="M26 78 Q40 68 54 78 L54 92 L26 92 Z" />
      <rect x="32" y="8" width="16" height="6" rx="1" opacity="0.35" />
    </svg>
  )
}

const ICONOS: Record<TipoUsuario, (p: { activo: boolean }) => JSX.Element> = {
  estudiante: IconoEstudiante,
  docente: IconoDocente,
  administrativo: IconoAdministrativo,
  personal_externo: IconoExterno,
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

  const rolConfig = ROLES.find(r => r.value === rolSeleccionado)
  const rolActivo = rolSeleccionado ?? hoverRol

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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 py-10">

      {/* Logo universidad */}
      <div className="text-center mb-8 max-w-lg">
        <img
          src="/images/logo-uagrm.png"
          alt="Universidad Autónoma Gabriel René Moreno"
          className="h-20 md:h-24 w-auto mx-auto object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://yt3.googleusercontent.com/A5oCd23orj8aZlRySPPyKSpN42nlZpM9cgwGVIzW66XoMTtCEhbBNgGQtSuBLremqaYHNt4xfPk=s900-c-k-c0x00ffffff-no-rj'
          }}
        />
        <p className="mt-3 text-xs text-gray-400 tracking-wide">
          Universidad Autónoma Gabriel René Moreno
        </p>
      </div>

      {/* ── PANTALLA 1: Selección de tipo de cuenta ── */}
      {pantalla === 'seleccion' && (
        <div className="w-full max-w-3xl fade-in text-center">
          <h1 className="text-2xl font-bold text-[#8B1A1A] mb-2">
            Bienvenido al Perfil
          </h1>
          <p className="text-[#1a3a6b] font-medium mb-10">
            Elige tu tipo de cuenta
          </p>

          {/* Iconos de roles */}
          <div className="flex flex-wrap items-end justify-center gap-4 md:gap-8 mb-8">
            {ROLES.map(rol => {
              const activo = rolActivo === rol.value
              const Icon = ICONOS[rol.value]
              return (
                <button
                  key={rol.value}
                  type="button"
                  onClick={() => elegirRol(rol.value)}
                  onMouseEnter={() => setHoverRol(rol.value)}
                  onMouseLeave={() => setHoverRol(null)}
                  className={`flex flex-col items-center transition-all duration-300 focus:outline-none
                    ${activo ? 'scale-110' : 'scale-90 opacity-60 hover:opacity-90 hover:scale-95'}`}
                  style={{ width: activo ? 120 : 90 }}
                >
                  <div className="h-24 w-full flex items-end justify-center mb-2">
                    <Icon activo={activo} />
                  </div>
                  {activo && (
                    <div className="w-full bg-[#1a3a6b] text-white text-xs font-bold py-2 px-1 tracking-wider animate-pulse">
                      {rol.label}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Nombre del rol seleccionado al pasar el mouse */}
          {rolActivo && pantalla === 'seleccion' && (
            <p className="text-sm text-gray-500 mb-6">
              Clic en el ícono para ingresar como{' '}
              <strong className="text-[#1a3a6b] capitalize">
                {ROLES.find(r => r.value === rolActivo)?.tituloLogin}
              </strong>
            </p>
          )}

          <p className="text-sm text-[#1a3a6b] hover:underline cursor-pointer">
            ¿Olvidaste tu contraseña?
          </p>
        </div>
      )}

      {/* ── PANTALLA 2: Login por rol ── */}
      {pantalla === 'login' && rolConfig && (
        <div className="w-full max-w-md fade-in">
          <div className="border border-gray-300 rounded-sm overflow-hidden shadow-sm bg-white">
            {/* Barra gris superior */}
            <div className="bg-[#e8e8e8] border-b border-gray-300 py-2.5 text-center">
              <span className="text-sm text-gray-600 font-medium">Inicio de sesión</span>
            </div>

            <div className="px-8 py-8">
              <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">
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
                  className="w-full bg-[#e8f4fc] border border-[#c5dce8] rounded px-4 py-3 text-sm
                    text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#1a3a6b]
                    transition-all duration-200"
                />

                <div className="relative">
                  <input
                    type={mostrarPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Contraseña"
                    required
                    className="w-full bg-[#e8f4fc] border border-[#c5dce8] rounded px-4 py-3 text-sm
                      text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#1a3a6b]
                      transition-all duration-200 pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setMostrarPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {mostrarPass ? '🙈' : '👁'}
                  </button>
                </div>

                {error && (
                  <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#4a4a4a] hover:bg-[#333] text-white font-medium py-3 rounded
                    transition-all duration-200 disabled:opacity-50 text-sm tracking-wide"
                >
                  {loading ? 'Verificando...' : 'Iniciar Sesión'}
                </button>
              </form>

              <p className="text-center mt-5">
                <button
                  type="button"
                  onClick={volverSeleccion}
                  className="text-sm text-[#1a3a6b] hover:underline"
                >
                  ← Elegir otro tipo de cuenta
                </button>
              </p>
            </div>
          </div>

          <p className="text-center mt-4 text-sm text-[#1a3a6b] hover:underline cursor-pointer">
            ¿Olvidaste tu contraseña?
          </p>
        </div>
      )}

      {/* ── 2FA: Código TOTP ── */}
      {pantalla === 'codigo_2fa' && (
        <div className="w-full max-w-md fade-in">
          <div className="border border-gray-300 rounded-sm overflow-hidden shadow-sm bg-white">
            <div className="bg-[#e8e8e8] border-b border-gray-300 py-2.5 text-center">
              <span className="text-sm text-gray-600 font-medium">Verificación en dos pasos</span>
            </div>

            <div className="px-8 py-8 space-y-5">
              <div className="text-center">
                <div className="text-4xl mb-2">🔐</div>
                <p className="text-sm text-gray-600">
                  Hola, <strong>{nombreUsuario}</strong>
                </p>
                <p className="text-xs text-gray-500 mt-2">
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
                className="w-full bg-[#e8f4fc] border border-[#c5dce8] rounded px-4 py-4 text-center
                  text-2xl font-mono tracking-[0.4em] focus:outline-none focus:border-[#1a3a6b]"
              />
              {error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                  ⚠️ {error}
                </div>
              )}
              <button
                type="button"
                onClick={handleVerificar}
                disabled={loading2FA}
                className="w-full bg-[#4a4a4a] hover:bg-[#333] text-white font-medium py-3 rounded
                  disabled:opacity-50 text-sm"
              >
                {loading2FA ? 'Verificando...' : 'Verificar código'}
              </button>

              <button
                type="button"
                onClick={volverSeleccion}
                className="w-full text-sm text-gray-400 hover:text-gray-600"
              >
                ← Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pie del sistema */}
      <p className="mt-8 text-xs text-gray-400 text-center">
        Sistema de Control Peatonal — UAGRM
      </p>
    </div>
  )
}
