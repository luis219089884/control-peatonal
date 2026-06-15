import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import {
  LISTAR_SINCRONIZACIONES_DTIC_QUERY,
  ESTADO_DTIC_API_QUERY,
} from '../../graphql/queries'
import { SINCRONIZAR_DTIC_MUTATION } from '../../graphql/mutations'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface Sync {
  id_sync: number
  estado: string
  creados: number
  actualizados: number
  omitidos: number
  errores: number
  total: number
  simulado: boolean
  iniciado_en: string
  finalizado_en: string | null
  iniciado_por: string
  log: string[]
}

const ESTADO_COLOR: Record<string, string> = {
  exitoso:  'bg-green-100 text-green-700 border-green-200',
  parcial:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  fallido:  'bg-red-100 text-red-600 border-red-200',
  simulado: 'bg-blue-100 text-blue-700 border-blue-200',
}
const ESTADO_ICON: Record<string, string> = {
  exitoso: '✅', parcial: '⚠️', fallido: '❌', simulado: '🧪',
}

function LogPanel({ log }: { log: string[] }) {
  if (!log.length) return null
  return (
    <div className="mt-3 bg-gray-900 rounded-xl p-4 max-h-48 overflow-y-auto">
      {log.map((line, i) => {
        const color = line.startsWith('[CREADO]')     ? 'text-green-400'
                    : line.startsWith('[ACTUALIZADO]') ? 'text-blue-400'
                    : line.startsWith('[ERROR')        ? 'text-red-400'
                    : line.startsWith('[OMITIDO]')     ? 'text-yellow-400'
                    : 'text-gray-400'
        return (
          <p key={i} className={`font-mono text-xs leading-5 ${color}`}>{line}</p>
        )
      })}
    </div>
  )
}

export default function Sincronizacion() {
  const [resultado, setResultado] = useState<Sync | null>(null)
  const [expandido, setExpandido] = useState<number | null>(null)
  const [error, setError]         = useState('')

  const { data: syncData, loading: loadingSync, refetch } = useQuery(
    LISTAR_SINCRONIZACIONES_DTIC_QUERY, { fetchPolicy: 'network-only' }
  )
  const { data: estadoData } = useQuery(ESTADO_DTIC_API_QUERY)

  const [sincronizar, { loading: loadingSync2 }] = useMutation(SINCRONIZAR_DTIC_MUTATION)

  const syncs: Sync[]    = syncData?.listarSincronizacionesDtic
    ? JSON.parse(syncData.listarSincronizacionesDtic) : []
  const estadoApi        = estadoData?.estadoDticApi
    ? JSON.parse(estadoData.estadoDticApi) : null
  const apiConfigurada   = estadoApi?.configurada ?? false

  const handleSync = async (simulado: boolean) => {
    setError('')
    setResultado(null)
    try {
      const { data } = await sincronizar({ variables: { simulado } })
      const r = JSON.parse(data?.sincronizarDtic ?? '{}')
      if (r.error) { setError(r.error); return }
      setResultado(r)
      refetch()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  const duracion = (s: Sync) => {
    if (!s.finalizado_en) return '—'
    const ms = new Date(s.finalizado_en).getTime() - new Date(s.iniciado_en).getTime()
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">🔄 Sincronización DTIC</h1>
      </div>

      {/* Estado de la API */}
      <div className={`rounded-xl border p-5 flex items-start gap-4
        ${apiConfigurada
          ? 'bg-green-50 border-green-200'
          : 'bg-blue-50 border-blue-200'}`}>
        <span className="text-3xl">{apiConfigurada ? '🟢' : '🔵'}</span>
        <div className="flex-1">
          <p className={`font-bold text-base ${apiConfigurada ? 'text-green-800' : 'text-blue-800'}`}>
            {apiConfigurada ? 'API DTIC conectada' : 'API DTIC no configurada — Modo simulado disponible'}
          </p>
          {apiConfigurada ? (
            <p className="text-sm text-green-700 mt-0.5">URL: <code className="font-mono">{estadoApi?.url}</code></p>
          ) : (
            <div className="mt-2 space-y-1 text-sm text-blue-700">
              <p>Cuando la DTIC entregue el acceso, agrega estas variables en <code className="bg-blue-100 px-1 rounded">.env</code>:</p>
              <pre className="bg-blue-100 rounded-lg px-3 py-2 text-xs font-mono mt-1 text-blue-900">
{`DTIC_API_URL=https://api.dtic.uagrm.edu.bo/v1
DTIC_API_KEY=<clave_provista_por_dtic>`}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Botones de acción */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => handleSync(false)}
          disabled={loadingSync2 || !apiConfigurada}
          className="flex items-center justify-center gap-3 py-5 px-6 rounded-2xl
            bg-gradient-to-br from-[#1a3a6b] to-[#2a5298] text-white font-bold text-base
            shadow-lg hover:brightness-110 active:scale-95 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingSync2 ? <LoadingSpinner /> : <span className="text-2xl">🔄</span>}
          <span>Sincronizar con DTIC<br /><span className="font-normal text-sm opacity-80">Datos reales</span></span>
        </button>

        <button
          onClick={() => handleSync(true)}
          disabled={loadingSync2}
          className="flex items-center justify-center gap-3 py-5 px-6 rounded-2xl
            bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold text-base
            shadow-lg hover:brightness-110 active:scale-95 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingSync2 ? <LoadingSpinner /> : <span className="text-2xl">🧪</span>}
          <span>Ejecutar Simulación<br /><span className="font-normal text-sm opacity-80">Datos de prueba</span></span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Resultado de la última sincronización */}
      {resultado && (
        <div className={`rounded-xl border p-5 animate-fadeIn
          ${resultado.estado === 'fallido' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{ESTADO_ICON[resultado.estado] ?? '✅'}</span>
            <div>
              <p className="font-bold text-lg text-gray-800">
                Sincronización {resultado.simulado ? 'simulada' : 'real'} completada
              </p>
              <p className="text-xs text-gray-500">
                {new Date(resultado.iniciado_en).toLocaleString('es-BO')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Creados',     val: resultado.creados,     color: 'text-green-700 bg-green-100' },
              { label: 'Actualizados',val: resultado.actualizados,color: 'text-blue-700 bg-blue-100'   },
              { label: 'Omitidos',    val: resultado.omitidos,    color: 'text-yellow-700 bg-yellow-100'},
              { label: 'Errores',     val: resultado.errores,     color: 'text-red-700 bg-red-100'     },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                <p className="text-2xl font-extrabold">{s.val}</p>
                <p className="text-xs font-medium">{s.label}</p>
              </div>
            ))}
          </div>
          <LogPanel log={resultado.log} />
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-xl shadow-card p-5">
        <h2 className="text-xs font-semibold text-[#1a3a6b] uppercase tracking-wide mb-4">
          Historial de sincronizaciones
        </h2>

        {loadingSync ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : syncs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Sin sincronizaciones aún. Ejecuta una para comenzar.
          </p>
        ) : (
          <div className="space-y-2">
            {syncs.map(s => (
              <div key={s.id_sync}
                className="border border-gray-100 rounded-xl overflow-hidden hover:border-blue-200 transition-colors">
                <button
                  type="button"
                  onClick={() => setExpandido(expandido === s.id_sync ? null : s.id_sync)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg">{ESTADO_ICON[s.estado] ?? '✅'}</span>

                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ESTADO_COLOR[s.estado] ?? ''}`}>
                    {s.estado}
                  </span>

                  {s.simulado && (
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
                      simulado
                    </span>
                  )}

                  <div className="flex-1 grid grid-cols-4 gap-2 text-xs text-center">
                    <span className="text-green-600 font-bold">{s.creados} creados</span>
                    <span className="text-blue-600 font-bold">{s.actualizados} act.</span>
                    <span className="text-yellow-600 font-bold">{s.omitidos} omit.</span>
                    <span className="text-red-600 font-bold">{s.errores} err.</span>
                  </div>

                  <div className="text-right text-xs text-gray-400 hidden sm:block">
                    <p>{new Date(s.iniciado_en).toLocaleDateString('es-BO')}</p>
                    <p>{new Date(s.iniciado_en).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  <span className="text-gray-400 text-xs ml-2">{expandido === s.id_sync ? '▲' : '▼'}</span>
                </button>

                {expandido === s.id_sync && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2 mb-1">
                      <span>👤 {s.iniciado_por}</span>
                      <span>⏱ {duracion(s)}</span>
                      <span>📊 {s.total} procesados en total</span>
                    </div>
                    <LogPanel log={s.log} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
