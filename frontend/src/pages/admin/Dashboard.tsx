import { useQuery } from '@apollo/client'
import { ESTADISTICAS_HOY_QUERY, LISTAR_REGISTROS_QUERY } from '../../graphql/queries'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Badge from '../../components/ui/Badge'

const TZ_BO = 'America/La_Paz'

function fechaHoyBolivia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ_BO })
}

function fechaLegibleBolivia(): string {
  const partes = new Intl.DateTimeFormat('es-BO', {
    timeZone: TZ_BO,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(new Date())
  const get = (type: string) => partes.find(p => p.type === type)?.value ?? ''
  const dia = get('weekday')
  const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1)
  return `${diaCap} ${get('day')} de ${get('month')} ${get('year')}`
}

function StatCard({
  icono, label, valor, color, subvalor, sublabel,
}: {
  icono: string; label: string; valor: number | string; color: string
  subvalor?: number; sublabel?: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5 flex items-start gap-3">
      <div className={`text-3xl p-2.5 rounded-xl ${color} flex-shrink-0`}>{icono}</div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-800 leading-tight">{valor}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
        {subvalor !== undefined && (
          <p className="text-xs text-gray-400 mt-1">{sublabel}: <span className="font-semibold">{subvalor}</span></p>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const hoy = fechaHoyBolivia()
  const { data: statsData, loading: loadingStats } = useQuery(ESTADISTICAS_HOY_QUERY, {
    fetchPolicy: 'cache-and-network',
  })
  const { data: registrosData, loading: loadingReg } = useQuery(LISTAR_REGISTROS_QUERY, {
    variables: { fechaInicio: hoy, fechaFin: hoy },
    fetchPolicy: 'cache-and-network',
  })

  const stats    = statsData?.estadisticasHoy ? JSON.parse(statsData.estadisticasHoy) : null
  const registros = registrosData?.listarRegistros ?? []
  const ultimos  = registros.slice(0, 15)

  const fechaHoy = fechaLegibleBolivia()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">📊 Dashboard</h1>
        <p className="text-sm text-gray-500">📅 {fechaHoy}</p>
      </div>

      {loadingStats ? (
        <div className="flex justify-center mt-12"><LoadingSpinner text="Cargando estadísticas..." /></div>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icono="📥" label="Total accesos hoy"    valor={stats?.total_ingresos ?? 0}  color="bg-blue-50" />
            <StatCard icono="🚪" label="Entradas permitidas"  valor={stats?.entradas ?? 0}         color="bg-green-50" />
            <StatCard icono="🏃" label="Salidas registradas"  valor={stats?.salidas ?? 0}          color="bg-orange-50" />
            <StatCard icono="❌" label="Accesos rechazados"   valor={stats?.rechazados ?? 0}       color="bg-red-50" />
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Por tipo de persona */}
              <div className="bg-white rounded-xl shadow-card p-5">
                <h2 className="text-xs font-semibold text-[#1a3a6b] mb-3 uppercase tracking-wide">
                  Por Tipo de Persona
                </h2>
                <div className="space-y-2">
                  {Object.entries(stats.por_tipo_persona as Record<string, number>).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Sin datos hoy</p>
                  ) : (
                    Object.entries(stats.por_tipo_persona as Record<string, number>)
                      .sort(([, a], [, b]) => b - a)
                      .map(([tipo, count]) => (
                        <div key={tipo} className="flex items-center justify-between py-1">
                          <Badge tipo={tipo as Parameters<typeof Badge>[0]['tipo']} />
                          <span className="font-bold text-[#1a3a6b] text-sm">{count}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Por sede */}
              <div className="bg-white rounded-xl shadow-card p-5">
                <h2 className="text-xs font-semibold text-[#1a3a6b] mb-3 uppercase tracking-wide">
                  Por Sede
                </h2>
                <div className="space-y-2">
                  {Object.entries((stats.por_sede ?? {}) as Record<string, number>).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Sin datos hoy</p>
                  ) : (
                    Object.entries((stats.por_sede ?? {}) as Record<string, number>)
                      .sort(([, a], [, b]) => b - a)
                      .map(([sede, count]) => {
                        const total = stats.total_ingresos || 1
                        const pct   = Math.round((count / total) * 100)
                        return (
                          <div key={sede} className="space-y-0.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600 truncate max-w-[70%]">{sede}</span>
                              <span className="font-bold text-[#1a3a6b]">{count}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#2a5298] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>
              </div>

              {/* Por método */}
              <div className="bg-white rounded-xl shadow-card p-5">
                <h2 className="text-xs font-semibold text-[#1a3a6b] mb-3 uppercase tracking-wide">
                  Por Método de Registro
                </h2>
                <div className="space-y-3">
                  {[
                    { key: 'qr',        label: 'QR Digital',         icon: '📱', color: 'bg-blue-100 text-blue-700'   },
                    { key: 'manual',    label: 'Registro Manual',    icon: '⌨️', color: 'bg-violet-100 text-violet-700' },
                    { key: 'logistico', label: 'Acceso Logístico',   icon: '🚚', color: 'bg-amber-100 text-amber-700'  },
                  ].map(m => (
                    <div key={m.key} className="flex items-center justify-between">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${m.color}`}>
                        {m.icon} {m.label}
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {(stats.por_metodo?.[m.key] ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Barra entrada vs salida */}
                <div className="mt-5 pt-4 border-t border-gray-50">
                  <p className="text-xs text-gray-500 mb-2">Entradas vs. Salidas</p>
                  {(() => {
                    const total = (stats.entradas ?? 0) + (stats.salidas ?? 0) || 1
                    const pctE  = Math.round(((stats.entradas ?? 0) / total) * 100)
                    return (
                      <>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-green-500 transition-all" style={{ width: `${pctE}%` }} />
                          <div className="h-full bg-orange-400 flex-1" />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>🚪 {stats.entradas ?? 0} entradas ({pctE}%)</span>
                          <span>{100 - pctE}% 🏃 {stats.salidas ?? 0} salidas</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Últimos registros */}
      <div className="bg-white rounded-xl shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-[#1a3a6b] uppercase tracking-wide">
            Últimos 15 Registros del Día
          </h2>
          <a href="/admin/accesos" className="text-xs text-[#2a5298] hover:underline font-medium">
            Ver todos →
          </a>
        </div>

        {loadingReg ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : ultimos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin registros hoy</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Hora', 'Nombre', 'Tipo', 'Movimiento', 'Facultad', 'Portón', 'Resultado'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ultimos.map((r: {
                  idRegistro: number; fechaHora: string; nombreCompleto: string;
                  tipoPersona: string; tipoMovimiento?: string; facultadPertenece?: string;
                  accesoPermitido: boolean; ingreso: { nombre: string };
                }) => (
                  <tr key={r.idRegistro}
                    className={`border-b border-gray-50 hover:bg-blue-50/40 transition-colors
                      ${!r.accesoPermitido ? 'bg-red-50/30' : ''}`}>
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {new Date(r.fechaHora).toLocaleTimeString('es-BO', {
                        timeZone: TZ_BO, hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-800 max-w-[160px]">
                      <span className="truncate block">{r.nombreCompleto}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge tipo={r.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.tipoMovimiento === 'entrada'
                        ? <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">🚪 Entrada</span>
                        : r.tipoMovimiento === 'salida'
                          ? <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">🏃 Salida</span>
                          : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs max-w-[140px]">
                      <span className="truncate block">{r.facultadPertenece || '—'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap">
                      {r.ingreso?.nombre || '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold ${r.accesoPermitido ? 'text-green-600' : 'text-red-500'}`}>
                        {r.accesoPermitido ? '✅ OK' : '❌ Neg.'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
