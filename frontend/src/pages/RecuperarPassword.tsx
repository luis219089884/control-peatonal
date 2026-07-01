import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { RESTABLECER_PASSWORD_MUTATION } from '../graphql/mutations'
import LoginBackground from '../components/LoginBackground'
import PasswordInput from '../components/ui/PasswordInput'
import { PASSWORD_POLICY_HINT, validarPassword } from '../utils/passwordPolicy'
import {
  FORM_HEADER,
  FORM_HEADER_TEXT,
  FORM_SHELL,
  LINK_CLASS,
  LOGIN_TEXT_SHADOW,
  LOGIN_TITLE_SHADOW,
  LOGO_LOCAL,
  LOGO_REMOTO,
} from './loginStyles'

export default function RecuperarPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const [restablecer, { loading }] = useMutation(RESTABLECER_PASSWORD_MUTATION)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('El enlace no es válido. Solicite uno nuevo desde el inicio de sesión.')
      return
    }

    const errPass = validarPassword(nueva)
    if (errPass) {
      setError(errPass)
      return
    }
    if (nueva !== confirmar) {
      setError('La confirmación no coincide con la nueva contraseña.')
      return
    }

    try {
      const { data } = await restablecer({
        variables: { token, passwordNuevo: nueva },
      })
      const res = data?.restablecerPassword
      if (!res?.ok) {
        setError(res?.message || 'No se pudo restablecer la contraseña.')
        return
      }
      setOk(true)
      window.setTimeout(() => {
        navigate('/login', { state: { mensajeRecuperacion: res.message } })
      }, 2500)
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
            <span className={FORM_HEADER_TEXT}>Nueva contraseña</span>
          </div>

          <div className="px-8 py-8">
            <h1 className={`text-xl md:text-2xl font-bold text-white text-center mb-2 ${LOGIN_TITLE_SHADOW}`}>
              Restablecer contraseña
            </h1>
            <p className={`text-xs text-center text-gray-300 mb-6 ${LOGIN_TEXT_SHADOW}`}>
              {PASSWORD_POLICY_HINT}
            </p>

            {!token ? (
              <div className="space-y-4">
                <div className={`text-sm text-amber-100 bg-amber-950/30 border border-amber-400/40 rounded-lg px-4 py-3 ${LOGIN_TEXT_SHADOW}`}>
                  Enlace inválido o incompleto. Solicite uno nuevo desde el inicio de sesión.
                </div>
                <Link
                  to="/olvide-password"
                  className={`block text-center w-full py-3 rounded bg-[#8B1A1A]/75 text-white text-sm font-semibold border border-white/25 ${LOGIN_TEXT_SHADOW}`}
                >
                  Solicitar nuevo enlace
                </Link>
              </div>
            ) : ok ? (
              <div className={`text-sm text-green-100 bg-green-950/30 border border-green-400/40 rounded-lg px-4 py-3 text-center ${LOGIN_TEXT_SHADOW}`}>
                ✅ Contraseña actualizada. Redirigiendo al login...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-xs text-gray-200 mb-1.5 ${LOGIN_TEXT_SHADOW}`}>
                    Nueva contraseña
                  </label>
                  <div className="[&_input]:bg-transparent [&_input]:border-white/35 [&_input]:text-white [&_input]:placeholder:text-gray-200">
                    <PasswordInput value={nueva} onChange={setNueva} placeholder="Nueva contraseña" />
                  </div>
                </div>
                <div>
                  <label className={`block text-xs text-gray-200 mb-1.5 ${LOGIN_TEXT_SHADOW}`}>
                    Confirmar contraseña
                  </label>
                  <div className="[&_input]:bg-transparent [&_input]:border-white/35 [&_input]:text-white [&_input]:placeholder:text-gray-200">
                    <PasswordInput value={confirmar} onChange={setConfirmar} placeholder="Repita la contraseña" />
                  </div>
                </div>

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
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>
            )}

            <p className="text-center mt-5">
              <Link to="/login" className={LINK_CLASS}>← Volver al inicio de sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
