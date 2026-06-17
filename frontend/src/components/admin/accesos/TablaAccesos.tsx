import Badge from '../../ui/Badge'
import LoadingSpinner from '../../ui/LoadingSpinner'
import {
  ETIQUETAS_METODO,
  RegistroAcceso,
} from './accesosShared'

function MovBadge({ tipo }: { tipo?: string }) {
  if (tipo === 'entrada') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
        Entrada
      </span>
    )
  }
  if (tipo === 'salida') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-semibold">
        Salida
      </span>
    )
  }
  return <span className="text-xs text-gray-300">—</span>
}

function MetodoBadge({ metodo }: { metodo?: string }) {
  const map: Record<string, string> = {
    qr: 'bg-blue-50 text-blue-700',
    manual: 'bg-violet-50 text-violet-700',
    logistico: 'bg-amber-50 text-amber-700',
  }
  const cls = map[metodo ?? ''] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {ETIQUETAS_METODO[metodo ?? ''] ?? metodo ?? '—'}
    </span>
  )
}

interface Props {
  registros: RegistroAcceso[]
  loading: boolean
  pagina: RegistroAcceso[]
  paginaActual: number
  totalPaginas: number
  totalFiltrados: number
  porPagina: number
  onPaginaChange: (p: number) => void
  vacioMensaje?: string
}

export default function TablaAccesos({
  registros,
  loading,
  pagina,
  paginaActual,
  totalPaginas,
  totalFiltrados,
  porPagina,
  onPaginaChange,
  vacioMensaje = 'Sin registros para los filtros seleccionados.',
}: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner text="Cargando registros..." />
      </div>
    )
  }

  if (registros.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-card p-12 text-center text-gray-400">
        <p className="text-4xl mb-3">📋</p>
        <p>{vacioMensaje}</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-card overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a3a6b] text-white">
              <tr>
                {['Fecha/Hora', 'Nombre', 'Tipo', 'Movimiento', 'Método', 'Sede', 'Facultad', 'Portón', 'Resultado'].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagina.map(r => (
                <tr
                  key={r.idRegistro}
                  className={`border-b border-gray-50 hover:bg-blue-50/40 transition-colors ${!r.accesoPermitido ? 'bg-red-50/40' : ''}`}
                >
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {new Date(r.fechaHora).toLocaleTimeString('es-BO', {
                      timeZone: 'America/La_Paz',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    <span className="block text-gray-400">
                      {new Date(r.fechaHora).toLocaleDateString('es-BO', {
                        timeZone: 'America/La_Paz',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-gray-800 max-w-[160px]">
                    <span className="truncate block">{r.nombreCompleto}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge tipo={r.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />
                  </td>
                  <td className="py-2.5 px-3"><MovBadge tipo={r.tipoMovimiento} /></td>
                  <td className="py-2.5 px-3"><MetodoBadge metodo={r.metodo} /></td>
                  <td className="py-2.5 px-3 text-xs text-gray-500 max-w-[120px]">
                    <span className="truncate block">{r.sedePertenece || '—'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500 max-w-[140px]">
                    <span className="truncate block">{r.facultadPertenece || '—'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                    {r.ingreso?.nombre || '—'}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {r.accesoPermitido ? (
                      <span className="text-xs font-semibold text-green-600">Permitido</span>
                    ) : (
                      <span className="text-xs font-semibold text-red-500" title={r.motivoRechazo ?? ''}>
                        Rechazado
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500 text-xs">
            Mostrando {(paginaActual - 1) * porPagina + 1}–{Math.min(paginaActual * porPagina, totalFiltrados)} de {totalFiltrados}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPaginaChange(Math.max(1, paginaActual - 1))}
              disabled={paginaActual === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="px-3 py-1.5 text-xs text-gray-500">{paginaActual} / {totalPaginas}</span>
            <button
              type="button"
              onClick={() => onPaginaChange(Math.min(totalPaginas, paginaActual + 1))}
              disabled={paginaActual === totalPaginas}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </>
  )
}
