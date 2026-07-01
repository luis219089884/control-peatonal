import { useState } from 'react'
import { useMutation } from '@apollo/client'
import { CAMBIAR_PASSWORD_MUTATION } from '../graphql/mutations'
import PasswordInput from '../components/ui/PasswordInput'
import Button from '../components/ui/Button'
import { PASSWORD_POLICY_HINT, validarPassword } from '../utils/passwordPolicy'

export default function CambiarPassword() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const [cambiar, { loading }] = useMutation(CAMBIAR_PASSWORD_MUTATION)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setOk('')

    const errNueva = validarPassword(nueva)
    if (errNueva) {
      setError(errNueva)
      return
    }
    if (nueva !== confirmar) {
      setError('La confirmación no coincide con la nueva contraseña.')
      return
    }
    if (actual === nueva) {
      setError('La nueva contraseña debe ser diferente a la actual.')
      return
    }

    try {
      const { data } = await cambiar({
        variables: { passwordActual: actual, passwordNuevo: nueva },
      })
      const res = data?.cambiarPassword
      if (!res?.success) {
        setError(res?.message || 'No se pudo actualizar la contraseña.')
        return
      }
      setOk(res.message)
      setActual('')
      setNueva('')
      setConfirmar('')
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a6b]">🔒 Cambiar contraseña</h1>
        <p className="text-sm text-gray-500 mt-1">{PASSWORD_POLICY_HINT}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-card p-6 space-y-4">
        <div>
          <label className="label-field">Contraseña actual</label>
          <PasswordInput value={actual} onChange={setActual} placeholder="Contraseña actual" />
        </div>
        <div>
          <label className="label-field">Nueva contraseña</label>
          <PasswordInput value={nueva} onChange={setNueva} placeholder="Nueva contraseña" />
        </div>
        <div>
          <label className="label-field">Confirmar nueva contraseña</label>
          <PasswordInput value={confirmar} onChange={setConfirmar} placeholder="Repita la nueva contraseña" />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
        {ok && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{ok}</p>
        )}

        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Actualizar contraseña'}
        </Button>
      </form>
    </div>
  )
}
