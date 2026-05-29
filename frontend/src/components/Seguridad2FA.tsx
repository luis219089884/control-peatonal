import { useState } from 'react'
import { useMutation } from '@apollo/client'
import { QRCodeSVG } from 'qrcode.react'
import {
  ACTIVAR_2FA_MUTATION,
  CONFIRMAR_2FA_MUTATION,
  DESACTIVAR_2FA_MUTATION,
} from '../graphql/mutations'
import Button from './ui/Button'

export default function Seguridad2FA() {
  const [qr2fa, setQr2fa] = useState<{ qrUrl: string; secret: string } | null>(null)
  const [codigo2fa, setCodigo2fa] = useState('')
  const [msg2fa, setMsg2fa] = useState('')
  const [err2fa, setErr2fa] = useState('')
  const [codigoDesact, setCodigoDesact] = useState('')
  const [activar2fa, { loading: loadingActivar }] = useMutation(ACTIVAR_2FA_MUTATION)
  const [confirmar2fa, { loading: loadingConfirmar }] = useMutation(CONFIRMAR_2FA_MUTATION)
  const [desactivar2fa, { loading: loadingDesact }] = useMutation(DESACTIVAR_2FA_MUTATION)

  const handleActivar2FA = async () => {
    setErr2fa(''); setMsg2fa('')
    const { data } = await activar2fa()
    const res = data?.activar2fa
    if (!res?.qrUrl) { setErr2fa(res?.message || 'Error'); return }
    setQr2fa({ qrUrl: res.qrUrl, secret: res.secret })
  }

  const handleConfirmar2FA = async () => {
    setErr2fa(''); setMsg2fa('')
    if (codigo2fa.length !== 6) { setErr2fa('El código debe tener 6 dígitos.'); return }
    const { data } = await confirmar2fa({ variables: { codigo: codigo2fa } })
    const res = data?.confirmar2fa
    if (!res?.success) { setErr2fa(res?.message || 'Código incorrecto'); return }
    setMsg2fa(res.message)
    setQr2fa(null); setCodigo2fa('')
  }

  const handleDesactivar2FA = async () => {
    setErr2fa(''); setMsg2fa('')
    if (codigoDesact.length !== 6) { setErr2fa('El código debe tener 6 dígitos.'); return }
    const { data } = await desactivar2fa({ variables: { codigo: codigoDesact } })
    const res = data?.desactivar2fa
    if (!res?.success) { setErr2fa(res?.message || 'Error'); return }
    setMsg2fa(res.message); setCodigoDesact('')
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Verificación en dos pasos (opcional)</p>
        <p>
          Puedes activar Google Authenticator para proteger tu cuenta.
          Si no la activas, iniciarás sesión solo con CI y contraseña.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-card p-5">
        <h2 className="text-base font-semibold text-[#1a3a6b] mb-4">🔐 Activar 2FA</h2>

        {msg2fa && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
            ✅ {msg2fa}
          </div>
        )}
        {err2fa && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            ⚠️ {err2fa}
          </div>
        )}

        {!qr2fa ? (
          <div className="space-y-3">
            <Button onClick={handleActivar2FA} loading={loadingActivar} className="w-full">
              📷 Generar QR para activar 2FA
            </Button>
            <p className="text-xs text-gray-400 text-center">
              Necesitarás la app <strong>Google Authenticator</strong> en tu celular.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#f0f4f8] rounded-xl p-4 space-y-3 text-center">
              <p className="text-sm font-medium text-gray-700">
                1. Abre <strong>Google Authenticator</strong> → toca <strong>+</strong> → <strong>Escanear QR</strong>
              </p>
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl border-2 border-[#1a3a6b] shadow-md inline-block">
                  <QRCodeSVG value={qr2fa.qrUrl} size={180} level="H" />
                </div>
              </div>
              <p className="text-sm text-gray-600">
                2. Ingresa el código de <strong>6 dígitos</strong> que aparece en la app
              </p>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={codigo2fa} onChange={e => setCodigo2fa(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" autoFocus
                className="input-field text-center text-2xl font-mono tracking-[0.5em] py-4 max-w-xs mx-auto"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleConfirmar2FA} loading={loadingConfirmar} className="flex-1">
                ✅ Confirmar y activar
              </Button>
              <Button variant="secondary" onClick={() => { setQr2fa(null); setCodigo2fa(''); setErr2fa('') }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-card p-5 space-y-3">
        <h2 className="text-base font-semibold text-red-600">⚠️ Desactivar 2FA</h2>
        <p className="text-sm text-gray-500">
          Para desactivar ingresa el código actual de Google Authenticator.
        </p>
        <div className="flex gap-3">
          <input
            type="text" inputMode="numeric" maxLength={6}
            value={codigoDesact} onChange={e => setCodigoDesact(e.target.value.replace(/\D/g, ''))}
            placeholder="Código de 6 dígitos"
            className="input-field flex-1 font-mono text-center tracking-widest"
          />
          <Button variant="danger" onClick={handleDesactivar2FA} loading={loadingDesact}>
            Desactivar
          </Button>
        </div>
      </div>
    </div>
  )
}
