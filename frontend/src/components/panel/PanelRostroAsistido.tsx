import { useEffect, useState } from 'react'
import { useMutation } from '@apollo/client'
import {
  BUSCAR_CANDIDATOS_ROSTRO_MUTATION,
  CONFIRMAR_ACCESO_ROSTRO_MUTATION,
} from '../../graphql/mutations'
import FaceCaptureCamera from '../rostro/FaceCaptureCamera'
import LoadingSpinner from '../ui/LoadingSpinner'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { computeFaceDescriptor, ensureFaceModels } from '../../utils/faceApi'
import type { ValidarQRResponse } from '../../types'

export interface CandidatoRostro {
  idUsuario: number
  nombres: string
  apellidos: string
  ci: string
  tipoUsuario: string
  fotoUrl?: string | null
  confianza: number
  distancia: number
}

interface PanelRostroAsistidoProps {
  idIngreso: number
  esAdmin: boolean
  disabled?: boolean
  onResult: (r: ValidarQRResponse & { tipoPersona?: string; tipoMovimiento?: string }) => void
}

export default function PanelRostroAsistido({
  idIngreso,
  esAdmin,
  disabled,
  onResult,
}: PanelRostroAsistidoProps) {
  const [modelsReady, setModelsReady] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [error, setError] = useState('')
  const [candidatos, setCandidatos] = useState<CandidatoRostro[]>([])
  const [buscandoLocal, setBuscandoLocal] = useState(false)

  const [buscar, { loading: buscando }] = useMutation(BUSCAR_CANDIDATOS_ROSTRO_MUTATION)
  const [confirmar, { loading: confirmando }] = useMutation(CONFIRMAR_ACCESO_ROSTRO_MUTATION)

  useEffect(() => {
    ensureFaceModels()
      .then(() => setModelsReady(true))
      .catch(() => setModelsError('No se pudieron cargar los modelos de reconocimiento facial.'))
  }, [])

  const ocupado = disabled || buscando || buscandoLocal || confirmando

  const handleCapture = async (dataUrl: string) => {
    setError('')
    setCandidatos([])
    setBuscandoLocal(true)
    try {
      const descriptor = await computeFaceDescriptor(dataUrl)
      if (!descriptor) {
        setError('No se detectó un rostro claro. Mejore la iluminación e intente de nuevo.')
        return
      }
      const { data } = await buscar({
        variables: { descriptor, idIngreso },
      })
      const res = data?.buscarCandidatosRostro
      if (!res?.ok) {
        setError(res?.message || 'Error al buscar coincidencias.')
        return
      }
      const lista: CandidatoRostro[] = res.candidatos ?? []
      setCandidatos(lista)
      if (lista.length === 0) {
        setError(res.message || 'Sin coincidencias.')
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setBuscandoLocal(false)
    }
  }

  const confirmarCandidato = async (c: CandidatoRostro) => {
    setError('')
    try {
      const { data } = await confirmar({
        variables: { idUsuario: c.idUsuario, idIngreso },
      })
      const r = data?.confirmarAccesoRostro
      if (r?.resultado !== 'PERMITIDO') {
        setError(r?.mensaje || 'Acceso rechazado.')
        return
      }
      setCandidatos([])
      onResult({
        resultado: 'PERMITIDO',
        mensaje: r.mensaje,
        nombre: r.nombre,
        sede: r.sede,
        facultad: r.facultad,
        tipoPersona: r.tipoPersona,
        tipoMovimiento: r.tipoMovimiento,
      })
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4 w-full">
      {!modelsReady && !modelsError && (
        <div className="flex justify-center py-8">
          <LoadingSpinner text="Cargando IA facial..." />
        </div>
      )}

      {modelsError && (
        <div className={`text-sm rounded-lg px-3 py-2 border ${esAdmin ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/40 border-red-400/40 text-red-100'}`}>
          {modelsError}
        </div>
      )}

      {modelsReady && (
        <>
          <FaceCaptureCamera
            active={!ocupado}
            facingMode="environment"
            instruccion="Centra el rostro de la persona y captura para buscar coincidencias."
            onCapture={handleCapture}
          />

          {ocupado && (
            <div className="flex justify-center py-2">
              <LoadingSpinner text={confirmando ? 'Registrando acceso...' : 'Analizando rostro...'} />
            </div>
          )}

          {error && (
            <div className={`text-sm rounded-lg px-3 py-2 border ${esAdmin ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/40 border-amber-400/40 text-amber-100'}`}>
              {error}
            </div>
          )}

          {candidatos.length > 0 && (
            <div className={`rounded-xl border p-4 space-y-3 ${esAdmin ? 'border-[#2a5298]/20 bg-blue-50/50' : 'border-white/15 bg-black/30'}`}>
              <p className={`text-sm font-semibold ${esAdmin ? 'text-[#1a3a6b]' : 'text-white'}`}>
                ¿Es alguna de estas personas?
              </p>
              <p className={`text-xs ${esAdmin ? 'text-gray-500' : 'text-white/50'}`}>
                Modo asistido: el guardia debe confirmar antes de registrar el acceso.
              </p>
              <div className="space-y-2">
                {candidatos.map(c => (
                  <div
                    key={c.idUsuario}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      esAdmin ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                      {c.fotoUrl ? (
                        <img
                          src={resolveMediaUrl(c.fotoUrl)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">👤</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate ${esAdmin ? 'text-gray-900' : 'text-white'}`}>
                        {c.apellidos} {c.nombres}
                      </p>
                      <p className={`text-xs ${esAdmin ? 'text-gray-500' : 'text-white/60'}`}>
                        CI: {c.ci} · {c.tipoUsuario.replace('_', ' ')}
                      </p>
                      <p className={`text-xs font-medium mt-0.5 ${c.confianza >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                        Coincidencia: {c.confianza}%
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={confirmando}
                      onClick={() => confirmarCandidato(c)}
                      className="flex-shrink-0 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setCandidatos([]); setError('') }}
                className={`w-full text-xs py-2 ${esAdmin ? 'text-gray-500 hover:text-gray-700' : 'text-white/50 hover:text-white/80'}`}
              >
                Ninguno coincide — capturar de nuevo
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
