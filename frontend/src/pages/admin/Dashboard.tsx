import { useQuery } from '@apollo/client'
import { ESTADISTICAS_HOY_QUERY, LISTAR_REGISTROS_QUERY } from '../../graphql/queries'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Badge from '../../components/ui/Badge'

const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function StatCard({ icono, label, valor, color }: { icono: string; label: string; valor: number; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5">
      <div className="flex items-center gap-3">
        <div className={`text-3xl p-2 rounded-lg ${color}`}>{icono}</div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{valor}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: statsData, loading: loadingStats } = useQuery(ESTADISTICAS_HOY_QUERY)
  const { data: registrosData, loading: loadingRegistros } = useQuery(LISTAR_REGISTROS_QUERY, {
    variables: {},
  })

  const stats = statsData?.estadisticasHoy ? JSON.parse(statsData.estadisticasHoy) : null
  const registros = registrosData?.listarRegistros ?? []
  const ultimos = [...registros].reverse().slice(0, 10)

  const now = new Date()
  const fechaHoy = `${DIAS[now.getDay()]} ${now.getDate()} de ${MESES[now.getMonth()]} ${now.getFullYear()}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">📊 Dashboard</h1>
        <p className="text-sm text-gray-500">📅 {fechaHoy}</p>
      </div>

      {loadingStats ? (
        <div className="flex justify-center mt-12"><LoadingSpinner text="Cargando estadísticas..." /></div>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icono="📥" label="Total ingresos hoy"   valor={stats?.total_ingresos ?? 0}  color="bg-blue-50" />
            <StatCard icono="✅" label="Accesos permitidos"   valor={stats?.permitidos ?? 0}       color="bg-green-50" />
            <StatCard icono="❌" label="Accesos rechazados"   valor={stats?.rechazados ?? 0}       color="bg-red-50" />
            <StatCard icono="👥" label="Usuarios en sistema"  valor={0}                            color="bg-purple-50" />
          </div>

          {/* Tablas por tipo y facultad */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl shadow-card p-5">
                <h2 className="text-sm font-semibold text-[#1a3a6b] mb-3 uppercase tracking-wide">
                  Ingresos por Tipo de Persona
                </h2>
                <div className="space-y-2">
                  {Object.entries(stats.por_tipo_persona as Record<string, number>).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Sin datos hoy</p>
                  ) : (
                    Object.entries(stats.por_tipo_persona as Record<string, number>)
                      .sort(([, a], [, b]) => b - a)
                      .map(([tipo, count]) => (
                        <div key={tipo} className="flex items-center justify-between py-1.5">
                          <Badge tipo={tipo as Parameters<typeof Badge>[0]['tipo']} />
                          <span className="font-semibold text-[#1a3a6b] text-sm">{count}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-card p-5">
                <h2 className="text-sm font-semibold text-[#1a3a6b] mb-3 uppercase tracking-wide">
                  Ingresos por Facultad
                </h2>
                <div className="space-y-2">
                  {Object.entries(stats.por_facultad as Record<string, number>).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Sin datos hoy</p>
                  ) : (
                    Object.entries(stats.por_facultad as Record<string, number>)
                      .sort(([, a], [, b]) => b - a)
                      .map(([fac, count]) => (
                        <div key={fac} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                          <span className="text-xs text-gray-600 truncate max-w-[80%]">{fac}</span>
                          <span className="font-semibold text-[#1a3a6b] text-sm ml-2">{count}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tabla últimos registros */}
      <div className="bg-white rounded-xl shadow-card p-5">
        <h2 className="text-sm font-semibold text-[#1a3a6b] mb-4 uppercase tracking-wide">
          Últimos 10 Registros del Día
        </h2>
        {loadingRegistros ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : ultimos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin registros hoy</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Hora', 'Nombre', 'Tipo', 'Facultad', 'Puerta', 'Resultado'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ultimos.map((r: {
                  idRegistro: number;
                  fechaHora: string;
                  nombreCompleto: string;
                  tipoPersona: string;
                  facultadPertenece?: string;
                  accesoPermitido: boolean;
                  ingreso: { nombre: string };
                }) => (
                  <tr key={r.idRegistro} className="border-b border-gray-50 hover:bg-blue-50 transition-colors duration-150">
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">
                      {new Date(r.fechaHora).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-800">{r.nombreCompleto}</td>
                    <td className="py-2.5 px-3">
                      <Badge tipo={r.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs max-w-[180px] truncate">
                      {r.facultadPertenece || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{r.ingreso?.nombre || '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-semibold ${r.accesoPermitido ? 'text-green-600' : 'text-red-500'}`}>
                        {r.accesoPermitido ? '✅ Permitido' : '❌ Rechazado'}
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
