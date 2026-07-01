import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { SOLICITAR_RECUPERACION_PASSWORD_MUTATION } from '../graphql/mutations'
import LoginBackground from '../components/LoginBackground'
import {
  FORM_HEADER,
  FORM_HEADER_TEXT,
  FORM_SHELL,
  INPUT_CLASS,
  LINK_CLASS,
  LOGIN_TEXT_SHADOW,
  LOGIN_TITLE_SHADOW,
  LOGO_LOCAL,
  LOGO_REMOTO,
  TIPOS_RECUPERACION,
  type TipoRecuperacion,
} from './loginStyles'

function tipoInicial(param: string | null): TipoRecuperacion {
  const valid = TIPOS_RECUPERACION.map(t => t.value)
  if (param && valid.includes(param as TipoRecuperacion)) {
    return param as TipoRecuperacion
  }
  return 'estudiante'
}

export default function OlvidePassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tipoUsuario, setTipoUsuario] = useState<TipoRecuperacion>(
    tipoInicial(searchParams.get('tipo')),
  )
  const [ci, setCi] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const [solicitar, { loading }] = useMutation(SOLICITAR_RECUPERACION_PASSWORD_MUTATION)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const { data } = await solicitar({
        variables: { ci: ci.trim(), email: email.trim(), tipoUsuario },
      })
      const res = data?.solicitarRecuperacionPassword
      if (!res?.ok) {
        setError(res?.message || 'No se pudo procesar la solicitud.')
        return
      }
      setMensaje(res.message)
      setEnviado(true)
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-4 py-10">
      <LoginBackground />

      <div className="relative z-10 w-full flex flex-col items-center max-w-md">
        <header className="text-center mb-8 w-full">
          <img
            src={LOGO_LOCAL}
            alt="Universidad Autónoma Gabriel René Moreno"
            className="w-full max-w-sm mx-auto h-auto object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
            onError={e => { (e.target as HTMLImageElement).src = LOGO_REMOTO }}
          />
        </header>

        <div className={`w-full fade-in ${FORM_SHELL}`}>
          <div className={FORM_HEADER}>
            <span className={FORM_HEADER_TEXT}>Recuperar contraseña</span>
          </div>

          <div className="px-8 py-8">
            <h1 className={`text-xl md:text-2xl font-bold text-white text-center mb-2 ${LOGIN_TITLE_SHADOW}`}>
              ¿Olvidaste tu contraseña?
            </h1>
            <p className={`text-sm text-center text-gray-200 mb-6 ${LOGIN_TEXT_SHADOW}`}>
              Ingresa tus datos y te enviaremos un enlace a tu correo institucional.
            </p>

            {enviado ? (
              <div className="space-y-5">
                <div className={`text-sm text-green-100 bg-green-950/30 border border-green-400/40 rounded-lg px-4 py-3 ${LOGIN_TEXT_SHADOW}`}>
                  <p className="font-semibold mb-1">✉️ Revisa tu correo</p>
                  <p>{mensaje}</p>
                </div>
                <p className={`text-xs text-center text-gray-300 ${LOGIN_TEXT_SHADOW}`}>
                  El enlace expira en 30 minutos. Revisa también la carpeta de spam.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className={`w-full bg-[#8B1A1A]/75 hover:bg-[#8B1A1A]/90 text-white font-semibold py-3 rounded
                    border border-white/25 text-sm ${LOGIN_TEXT_SHADOW}`}
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-xs text-gray-200 mb-1.5 ${LOGIN_TEXT_SHADOW}`}>
                    Tipo de cuenta
                  </label>
                  <select
                    value={tipoUsuario}
                    onChange={e => setTipoUsuario(e.target.value as TipoRecuperacion)}
                    className={`${INPUT_CLASS} cursor-pointer`}
                  >
                    {TIPOS_RECUPERACION.map(t => (
                      <option key={t.value} value={t.value} className="text-gray-900">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  value={ci}
                  onChange={e => setCi(e.target.value)}
                  placeholder="Carnet de identidad"
                  required
                  autoFocus
                  className={INPUT_CLASS}
                />

                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Correo electrónico registrado"
                  required
                  className={INPUT_CLASS}
                />

                {error && (
                  <div className={`text-red-100 text-sm rounded px-3 py-2 border border-red-400/50 bg-red-950/25 ${LOGIN_TEXT_SHADOW}`}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-[#8B1A1A]/75 hover:bg-[#8B1A1A]/90 text-white font-semibold py-3 rounded
                    border border-white/25 disabled:opacity-50 text-sm ${LOGIN_TEXT_SHADOW}`}
                >
                  {loading ? 'Enviando...' : 'Enviar instrucciones'}
                </button>
              </form>
            )}

            {!enviado && (
              <p className="text-center mt-5">
                <Link to="/login" className={LINK_CLASS}>← Volver al inicio de sesión</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
