import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { MIS_FOTOS_ROSTRO_QUERY } from '../../graphql/queries'
import { REGISTRAR_FOTOS_ROSTRO_MUTATION } from '../../graphql/mutations'
import FaceCaptureCamera from './FaceCaptureCamera'
import LoadingSpinner from '../ui/LoadingSpinner'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { averageDescriptors, computeFaceDescriptor, ensureFaceModels } from '../../utils/faceApi'

type Angulo = 'frente' | 'izquierda' | 'derecha'

const PASOS: { angulo: Angulo; titulo: string; instruccion: string }[] = [
  {
    angulo: 'frente',
    titulo: 'Paso 1 — Frente',
    instruccion: 'Mira directo a la cámara. Centra tu rostro en el óvalo.',
  },
  {
    angulo: 'izquierda',
    titulo: 'Paso 2 — Perfil izquierdo',
    instruccion: 'Gira suavemente la cabeza hacia tu izquierda (unos 20°).',
  },
  {
    angulo: 'derecha',
    titulo: 'Paso 3 — Perfil derecho',
    instruccion: 'Gira suavemente la cabeza hacia tu derecha (unos 20°).',
  },
]

const ANGULO_LABEL: Record<Angulo, string> = {
  frente: 'Frente',
  izquierda: 'Izquierda',
  derecha: 'Derecha',
}

type Fase = 'inicio' | 'captura' | 'revision'

export default function RegistroRostro() {
  const { data, loading, refetch } = useQuery(MIS_FOTOS_ROSTRO_QUERY)
  const [registrar, { loading: guardando }] = useMutation(REGISTRAR_FOTOS_ROSTRO_MUTATION)

  const [fase, setFase] = useState<Fase>('inicio')
  const [pasoIdx, setPasoIdx] = useState(0)
  const [capturas, setCapturas] = useState<Partial<Record<Angulo, string>>>({})
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const fotosGuardadas = data?.misFotosRostro ?? []
  const registroCompleto = fotosGuardadas.length >= 3

  const pasoActual = PASOS[pasoIdx]

  const iniciarCaptura = () => {
    setCapturas({})
    setPasoIdx(0)
    setError('')
    setOkMsg('')
    setFase('captura')
  }

  const onFotoCapturada = (dataUrl: string) => {
    const angulo = pasoActual.angulo
    setCapturas(prev => ({ ...prev, [angulo]: dataUrl }))
    if (pasoIdx < PASOS.length - 1) {
      setPasoIdx(pasoIdx + 1)
    } else {
      setFase('revision')
    }
  }

  const repetirPaso = (idx: number) => {
    setPasoIdx(idx)
    setFase('captura')
  }

  const guardar = async () => {
    setError('')
    const faltantes = PASOS.filter(p => !capturas[p.angulo])
    if (faltantes.length > 0) {
      setError('Faltan fotos por capturar.')
      return
    }
    try {
      await ensureFaceModels()
      const descriptores: number[][] = []
      for (const p of PASOS) {
        const desc = await computeFaceDescriptor(capturas[p.angulo]!)
        if (!desc) {
          setError(`No se detectó rostro en la foto «${ANGULO_LABEL[p.angulo]}». Repita ese paso.`)
          return
        }
        descriptores.push(desc)
      }
      const descriptorPromedio = averageDescriptors(descriptores)

      const { data: res } = await registrar({
        variables: {
          fotos: PASOS.map(p => ({
            angulo: p.angulo,
            imagenBase64: capturas[p.angulo]!,
          })),
          descriptorPromedio,
        },
      })
      const r = res?.registrarFotosRostro
      if (!r?.ok) {
        setError(r?.message || 'No se pudo guardar el registro.')
        return
      }
      setOkMsg(r.message)
      setFase('inicio')
      await refetch()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-10"><LoadingSpinner text="Cargando registro facial..." /></div>
  }

  return (
    <div className="bg-white rounded-xl shadow-card p-6 space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-bold text-[#1a3a6b]">Registro de rostro</h2>
        <p className="text-sm text-gray-500 mt-1">
          Captura 3 fotos de referencia para acceso facial en portones (fase 1).
        </p>
      </div>

      {okMsg && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          {okMsg}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {fase === 'inicio' && (
        <div className="space-y-4">
          {registroCompleto ? (
            <>
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                <span>✅</span> Registro facial completo
              </div>
              <div className="grid grid-cols-3 gap-3">
                {fotosGuardadas.map((f: { angulo: string; url: string }) => (
                  <div key={f.angulo} className="text-center">
                    <img
                      src={resolveMediaUrl(f.url)}
                      alt={f.angulo}
                      className="w-full aspect-[3/4] object-cover rounded-xl border border-gray-200"
                    />
                    <p className="text-xs text-gray-500 mt-1 capitalize">{ANGULO_LABEL[f.angulo as Angulo] ?? f.angulo}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Última actualización:{' '}
                {new Date(fotosGuardadas[0]?.actualizadoEn).toLocaleString('es-BO')}
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Aún no tienes fotos de rostro registradas. Completa los 3 pasos para habilitar el acceso facial en el futuro.
            </div>
          )}

          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Buena iluminación en el rostro</li>
            <li>Sin gorra ni lentes oscuros</li>
            <li>Fondo neutro si es posible</li>
          </ul>

          <button
            type="button"
            onClick={iniciarCaptura}
            className="w-full py-3 rounded-xl bg-[#1a3a6b] hover:bg-[#2a5298] text-white font-semibold text-sm"
          >
            {registroCompleto ? 'Actualizar fotos de rostro' : 'Comenzar registro'}
          </button>
        </div>
      )}

      {fase === 'captura' && pasoActual && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-[#1a3a6b]">{pasoActual.titulo}</h3>
            <span className="text-xs text-gray-400">{pasoIdx + 1} / {PASOS.length}</span>
          </div>

          <div className="flex gap-1">
            {PASOS.map((p, i) => (
              <div
                key={p.angulo}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < pasoIdx ? 'bg-green-500' : i === pasoIdx ? 'bg-[#2a5298]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <FaceCaptureCamera
            active
            instruccion={pasoActual.instruccion}
            onCapture={onFotoCapturada}
          />

          <button
            type="button"
            onClick={() => (pasoIdx > 0 ? setPasoIdx(pasoIdx - 1) : setFase('inicio'))}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            ← {pasoIdx > 0 ? 'Paso anterior' : 'Cancelar'}
          </button>
        </div>
      )}

      {fase === 'revision' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-[#1a3a6b]">Revisión final</h3>
          <p className="text-sm text-gray-500">Confirma que las 3 fotos se ven claras. Puedes repetir cualquiera.</p>

          <div className="grid grid-cols-3 gap-3">
            {PASOS.map((p, i) => (
              <div key={p.angulo} className="space-y-2">
                <img
                  src={capturas[p.angulo]}
                  alt={p.angulo}
                  className="w-full aspect-[3/4] object-cover rounded-xl border border-gray-200"
                />
                <p className="text-xs text-center text-gray-500">{ANGULO_LABEL[p.angulo]}</p>
                <button
                  type="button"
                  onClick={() => repetirPaso(i)}
                  className="w-full text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Repetir
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-50"
          >
            {guardando ? 'Analizando rostros y guardando...' : 'Confirmar y guardar'}
          </button>

          <button
            type="button"
            onClick={() => setFase('captura')}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            ← Volver a capturar
          </button>
        </div>
      )}
    </div>
  )
}
