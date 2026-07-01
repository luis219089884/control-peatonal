import { useEffect, useState } from 'react'

const TEXT_SHADOW =
  '[text-shadow:0_1px_8px_rgba(0,0,0,0.95),0_2px_18px_rgba(0,0,0,0.75)]'

export interface LoginSecurityState {
  cuentaBloqueada: boolean
  segundosBloqueo: number | null
  intentosRestantes: number | null
  maxIntentos: number
  message: string
}

export const LOGIN_SECURITY_EMPTY: LoginSecurityState = {
  cuentaBloqueada: false,
  segundosBloqueo: null,
  intentosRestantes: null,
  maxIntentos: 5,
  message: '',
}

interface Props extends LoginSecurityState {
  onBloqueoTerminado?: () => void
  onSegundosTick?: (segundos: number) => void
}

export default function LoginSecurityAlert({
  cuentaBloqueada,
  segundosBloqueo,
  intentosRestantes,
  maxIntentos,
  message,
  onBloqueoTerminado,
  onSegundosTick,
}: Props) {
  const [segundos, setSegundos] = useState(segundosBloqueo ?? 0)

  useEffect(() => {
    const inicial = segundosBloqueo ?? 0
    setSegundos(inicial)
    onSegundosTick?.(inicial)
  }, [segundosBloqueo, onSegundosTick])

  useEffect(() => {
    if (!cuentaBloqueada || (segundosBloqueo ?? 0) <= 0) return
    const id = window.setInterval(() => {
      setSegundos(prev => {
        const next = prev - 1
        onSegundosTick?.(Math.max(0, next))
        if (next <= 0) {
          window.clearInterval(id)
          onBloqueoTerminado?.()
          return 0
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [cuentaBloqueada, segundosBloqueo, onBloqueoTerminado, onSegundosTick])

  if (!message && intentosRestantes === null && !cuentaBloqueada) return null

  const usados =
    intentosRestantes !== null
      ? Math.max(0, maxIntentos - intentosRestantes)
      : cuentaBloqueada
        ? maxIntentos
        : 0

  const bloqueoActivo = cuentaBloqueada && segundos > 0
  const bloqueoRecienTerminado = cuentaBloqueada && segundos === 0

  return (
    <div className="space-y-3">
      {bloqueoActivo && (
        <div
          className={`rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-950/50 to-orange-950/40
            px-4 py-4 backdrop-blur-sm ${TEXT_SHADOW}`}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/25 text-xl ring-2 ring-amber-300/40">
              🔒
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-100">Cuenta bloqueada temporalmente</p>
              <p className="mt-1 text-xs text-amber-50/90 leading-relaxed">
                Superaste los {maxIntentos} intentos permitidos. Por seguridad, debes esperar antes de volver a intentar.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/30 ring-2 ring-amber-200/50">
                  <span className="text-2xl font-mono font-bold tabular-nums text-white">
                    {segundos}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {segundos === 1 ? '1 segundo restante' : `${segundos} segundos restantes`}
                  </p>
                  <p className="text-xs text-amber-100/80">El formulario se habilitará automáticamente</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {bloqueoRecienTerminado && (
        <div
          className={`rounded-lg border border-emerald-300/50 bg-emerald-950/30 px-3 py-2.5 text-sm text-emerald-100 ${TEXT_SHADOW}`}
          role="status"
        >
          ✅ El bloqueo terminó. Ya puedes intentar iniciar sesión de nuevo.
        </div>
      )}

      {!bloqueoActivo && message && (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm font-medium
            ${cuentaBloqueada || (intentosRestantes !== null && intentosRestantes <= 1)
              ? 'border-red-400/50 bg-red-950/30 text-red-100'
              : 'border-orange-400/45 bg-orange-950/25 text-orange-50'
            } ${TEXT_SHADOW}`}
          role="alert"
        >
          {message}
        </div>
      )}

      {intentosRestantes !== null && !bloqueoActivo && (
        <div className={`rounded-lg border border-white/20 bg-black/20 px-3 py-3 ${TEXT_SHADOW}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              Intentos de acceso
            </p>
            <p className="text-xs text-white/90">
              <span className="font-bold text-white">{intentosRestantes}</span>
              {' '}de{' '}
              <span className="font-bold text-white">{maxIntentos}</span>
              {' '}restantes
            </p>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: maxIntentos }, (_, i) => {
              const fallido = i < usados
              return (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-all duration-300
                    ${fallido
                      ? 'bg-gradient-to-r from-red-500 to-orange-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]'
                      : 'bg-white/20 ring-1 ring-white/25'
                    }`}
                />
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-white/70 leading-snug">
            {intentosRestantes <= 1
              ? '⚠️ El próximo intento fallido bloqueará tu cuenta unos segundos.'
              : 'Si olvidaste tu contraseña, contacta al administrador del sistema.'}
          </p>
        </div>
      )}
    </div>
  )
}
