import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { LISTAR_REGISTROS_COMPLETO_QUERY, LISTAR_SEDES_QUERY, LISTAR_FACULTADES_QUERY } from '../../graphql/queries'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Badge from '../../components/ui/Badge'

const TIPOS_PERSONA = ['estudiante', 'docente', 'administrativo', 'personal_externo', 'invitado', 'logistico']
const METODOS = ['qr', 'manual', 'logistico']

interface Registro {
  idRegistro: number
  nombreCompleto: string
  tipoPersona: string
  tipoMovimiento: string
  metodo: string
  sedePertenece: string | null
  facultadPertenece: string | null
  accesoPermitido: boolean
  motivoRechazo: string | null
  fechaHora: string
  ingreso: { nombre: string }
  guardia: { turno: string; usuario: { nombres: string; apellidos: string } } | null
}

function MovBadge({ tipo }: { tipo: string }) {
  if (tipo === 'entrada') return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
      🚪 Entrada
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-semibold">
      🏃 Salida
    </span>
  )
}

function MetodoBadge({ metodo }: { metodo: string }) {
  const map: Record<string, string> = { qr: 'bg-blue-50 text-blue-700', manual: 'bg-violet-50 text-violet-700', logistico: 'bg-amber-50 text-amber-700' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[metodo] ?? 'bg-gray-100 text-gray-500'}`}>
      {metodo}
    </span>
  )
}

const hoy = new Date().toISOString().split('T')[0]

export default function Accesos() {
  const [fechaInicio, setFechaInicio] = useState(hoy)
  const [fechaFin, setFechaFin]       = useState(hoy)
  const [tipoPersona, setTipoPersona] = useState('')
  const [tipoMovimiento, setTipoMov]  = useState('')
  const [metodo, setMetodo]           = useState('')
  const [idSede, setIdSede]           = useState(0)
  const [buscar, setBuscar]           = useState('')
  const [paginaActual, setPagina]     = useState(1)
  const POR_PAGINA = 50

  const { data, loading, refetch } = useQuery(LISTAR_REGISTROS_COMPLETO_QUERY, {
    variables: {
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      tipoPersona: tipoPersona || null,
      tipoMovimiento: tipoMovimiento || null,
      metodo: metodo || null,
      idSede: idSede || null,
    },
    fetchPolicy: 'network-only',
  })

  const { data: sedeData }  = useQuery(LISTAR_SEDES_QUERY)
  const sedes               = sedeData?.listarSedes ?? []

  const registros: Registro[] = data?.listarRegistros ?? []

  const filtrados = registros.filter(r =>
    buscar === '' ||
    r.nombreCompleto.toLowerCase().includes(buscar.toLowerCase()) ||
    (r.facultadPertenece ?? '').toLowerCase().includes(buscar.toLowerCase())
  )

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const pagina = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  const entradas  = filtrados.filter(r => r.tipoMovimiento === 'entrada' && r.accesoPermitido).length
  const salidas   = filtrados.filter(r => r.tipoMovimiento === 'salida'  && r.accesoPermitido).length
  const rechazados = filtrados.filter(r => !r.accesoPermitido).length

  const exportCSV = () => {
    const cols = ['Hora','Nombre','Tipo','Movimiento','Método','Sede','Facultad','Portón','Guardia','Resultado']
    const rows = filtrados.map(r => [
      new Date(r.fechaHora).toLocaleString('es-BO'),
      r.nombreCompleto,
      r.tipoPersona,
      r.tipoMovimiento,
      r.metodo,
      r.sedePertenece ?? '',
      r.facultadPertenece ?? '',
      r.ingreso?.nombre ?? '',
      r.guardia ? `${r.guardia.usuario.apellidos} ${r.guardia.usuario.nombres}` : '',
      r.accesoPermitido ? 'Permitido' : 'Rechazado',
    ])
    const csv = [cols, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `accesos_${fechaInicio}_${fechaFin}.csv`; a.click()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">📋 Registro de Accesos</h1>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white
            text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          ⬇️ Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-card p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
            <input type="date" value={fechaInicio} onChange={e => { setFechaInicio(e.target.value); setPagina(1) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a5298]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha fin</label>
            <input type="date" value={fechaFin} onChange={e => { setFechaFin(e.target.value); setPagina(1) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a5298]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sede</label>
            <select value={idSede} onChange={e => { setIdSede(Number(e.target.value)); setPagina(1) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a5298] bg-white">
              <option value={0}>Todas las sedes</option>
              {sedes.map((s: { idSede: number; nombre: string }) => (
                <option key={s.idSede} value={s.idSede}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo persona</label>
            <select value={tipoPersona} onChange={e => { setTipoPersona(e.target.value); setPagina(1) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a5298] bg-white">
              <option value="">Todos</option>
              {TIPOS_PERSONA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Movimiento</label>
            <select value={tipoMovimiento} onChange={e => { setTipoMov(e.target.value); setPagina(1) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a5298] bg-white">
              <option value="">Entrada y salida</option>
              <option value="entrada">🚪 Entrada</option>
              <option value="salida">🏃 Salida</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Método</label>
            <select value={metodo} onChange={e => { setMetodo(e.target.value); setPagina(1) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a5298] bg-white">
              <option value="">Todos los métodos</option>
              {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Buscar persona / facultad</label>
            <input value={buscar} onChange={e => { setBuscar(e.target.value); setPagina(1) }}
              placeholder="Nombre o facultad..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a5298]" />
          </div>
        </div>
        <button onClick={() => refetch()}
          className="text-xs text-[#1a3a6b] hover:underline font-medium">
          🔄 Actualizar resultados
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',     val: filtrados.length, color: 'text-[#1a3a6b]', bg: 'bg-blue-50'  },
          { label: 'Entradas',  val: entradas,          color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Salidas',   val: salidas,           color: 'text-orange-700',bg: 'bg-orange-50'},
          { label: 'Rechazados',val: rechazados,        color: 'text-red-700',   bg: 'bg-red-50'   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner text="Cargando registros..." /></div>
      ) : pagina.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-10 text-center text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p>Sin registros para los filtros seleccionados.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Hora', 'Nombre', 'Tipo', 'Movimiento', 'Método', 'Facultad', 'Portón', 'Resultado'].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagina.map(r => (
                    <tr key={r.idRegistro}
                      className={`border-b border-gray-50 hover:bg-blue-50/40 transition-colors
                        ${!r.accesoPermitido ? 'bg-red-50/30' : ''}`}>
                      <td className="py-2.5 px-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {new Date(r.fechaHora).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                        <span className="block text-gray-400">
                          {new Date(r.fechaHora).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-800 max-w-[160px]">
                        <span className="truncate block">{r.nombreCompleto}</span>
                        {r.sedePertenece && <span className="text-xs text-gray-400">{r.sedePertenece}</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge tipo={r.tipoPersona as Parameters<typeof Badge>[0]['tipo']} />
                      </td>
                      <td className="py-2.5 px-3">
                        <MovBadge tipo={r.tipoMovimiento} />
                      </td>
                      <td className="py-2.5 px-3">
                        <MetodoBadge metodo={r.metodo} />
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 max-w-[140px]">
                        <span className="truncate block">{r.facultadPertenece || '—'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                        {r.ingreso?.nombre || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.accesoPermitido
                          ? <span className="text-xs font-semibold text-green-600">✅ OK</span>
                          : <span className="text-xs font-semibold text-red-500">❌ Neg.</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-gray-500 text-xs">
                Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-40">
                  ← Anterior
                </button>
                <span className="px-3 py-1.5 text-xs text-gray-500">{paginaActual} / {totalPaginas}</span>
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-40">
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
