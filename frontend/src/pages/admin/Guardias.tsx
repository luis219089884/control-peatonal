import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { LISTAR_GUARDIAS_QUERY, LISTAR_INGRESOS_QUERY } from '../../graphql/queries'
import { ASIGNAR_GUARDIA_MUTATION, DESASIGNAR_GUARDIA_MUTATION } from '../../graphql/mutations'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const TURNOS = [
  { value: 'jornada', label: 'Jornada completa (07:00 - 22:00)' },
  { value: 'manana',  label: 'Mañana' },
  { value: 'tarde',   label: 'Tarde' },
  { value: 'noche',   label: 'Noche' },
]

interface Guardia {
  idUsuario: number
  nombres: string
  apellidos: string
  ci: string
  activo: boolean
  idGuardia: number | null
  idIngreso: number | null
  ingresoNombre: string | null
  sedeNombre: string | null
  turno: string | null
  horario: string | null
  fechaAsignacion: string | null
}

interface Ingreso {
  idIngreso: number
  nombre: string
  sedeNombre: string
  facultadNombre: string
  activo: boolean
}

function ModalAsignar({
  guardia,
  ingresos,
  onClose,
  onSave,
}: {
  guardia: Guardia
  ingresos: Ingreso[]
  onClose: () => void
  onSave: () => void
}) {
  const [idIngreso, setIdIngreso] = useState<number>(guardia.idIngreso ?? 0)
  const [turno, setTurno]         = useState(guardia.turno ?? 'jornada')
  const [msg, setMsg]             = useState('')
  const [asignar, { loading }]    = useMutation(ASIGNAR_GUARDIA_MUTATION)

  const handleSave = async () => {
    if (!idIngreso) { setMsg('Selecciona un portón.'); return }
    try {
      const { data } = await asignar({
        variables: { idUsuario: guardia.idUsuario, idIngreso, turno },
      })
      if (data?.asignarGuardia?.success) { onSave(); onClose() }
      else setMsg(data?.asignarGuardia?.message ?? 'Error')
    } catch (e: unknown) { setMsg((e as Error).message) }
  }

  const ingresosPorSede: Record<string, Ingreso[]> = {}
  ingresos.filter(i => i.activo).forEach(i => {
    const s = i.sedeNombre || 'Sin sede'
    if (!ingresosPorSede[s]) ingresosPorSede[s] = []
    ingresosPorSede[s].push(i)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1a3a6b] text-lg">
            Asignar Portón — {guardia.apellidos} {guardia.nombres}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Portón / Punto de acceso</label>
            <select
              value={idIngreso}
              onChange={e => setIdIngreso(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                text-gray-800 focus:outline-none focus:border-[#2a5298] bg-white"
            >
              <option value={0}>— Seleccionar portón —</option>
              {Object.entries(ingresosPorSede).map(([sede, ings]) => (
                <optgroup key={sede} label={`📍 ${sede}`}>
                  {ings.map(i => (
                    <option key={i.idIngreso} value={i.idIngreso}>
                      {i.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Turno</label>
            <div className="grid grid-cols-2 gap-2">
              {TURNOS.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTurno(t.value)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all text-left
                    ${turno === t.value
                      ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#2a5298]'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {msg && <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">{msg}</p>}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#1a3a6b] hover:bg-[#2a5298] text-white
              font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar Asignación'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Guardias() {
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<Guardia | null>(null)
  const [toast, setToast]         = useState('')

  const { data, loading, refetch } = useQuery(LISTAR_GUARDIAS_QUERY, { fetchPolicy: 'network-only' })
  const { data: ingresoData }      = useQuery(LISTAR_INGRESOS_QUERY, { variables: { soloActivos: true } })
  const [desasignar, { loading: loadingDes }] = useMutation(DESASIGNAR_GUARDIA_MUTATION)

  const guardias: Guardia[] = data?.listarGuardias ?? []
  const ingresos: Ingreso[] = ingresoData?.listarIngresos ?? []

  const filtrados = guardias.filter(g =>
    `${g.apellidos} ${g.nombres} ${g.ci}`.toLowerCase().includes(search.toLowerCase())
  )

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleDesasignar = async (g: Guardia) => {
    if (!confirm(`¿Quitar asignación de ${g.apellidos} ${g.nombres}?`)) return
    const { data } = await desasignar({ variables: { idUsuario: g.idUsuario } })
    if (data?.desasignarGuardia?.success) {
      showToast('Asignación eliminada.')
      refetch()
    }
  }

  const asignados   = guardias.filter(g => g.idIngreso).length
  const sinAsignar  = guardias.length - asignados

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">👮 Gestión de Guardias</h1>
        <div className="flex gap-3 items-center">
          <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-semibold">
            ✅ {asignados} asignados
          </span>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full font-semibold">
            ⚠️ {sinAsignar} sin portón
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar guardia por nombre o CI..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm
            focus:outline-none focus:border-[#2a5298] transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner text="Cargando guardias..." /></div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-10 text-center text-gray-400">
          <p className="text-3xl mb-2">👮</p>
          <p>No hay guardias registrados aún.</p>
          <p className="text-xs mt-1">Crea usuarios con rol "guardia" en el módulo de Usuarios.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Guardia', 'CI', 'Portón asignado', 'Sede', 'Turno', 'Desde', 'Estado', 'Acción'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(g => (
                <tr key={g.idUsuario} className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-800">
                    {g.apellidos} {g.nombres}
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-xs">{g.ci}</td>
                  <td className="py-3 px-4">
                    {g.ingresoNombre
                      ? <span className="text-gray-700">{g.ingresoNombre}</span>
                      : <span className="text-yellow-600 text-xs bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">Sin asignar</span>
                    }
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{g.sedeNombre || '—'}</td>
                  <td className="py-3 px-4">
                    {g.horario
                      ? <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">{g.horario}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {g.fechaAsignacion ?? '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                      ${g.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {g.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelected(g)}
                        className="text-xs bg-[#1a3a6b] hover:bg-[#2a5298] text-white
                          px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {g.idIngreso ? '✏️ Cambiar' : '➕ Asignar'}
                      </button>
                      {g.idIngreso && (
                        <button
                          onClick={() => handleDesasignar(g)}
                          disabled={loadingDes}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-600
                            border border-red-200 px-3 py-1.5 rounded-lg transition-colors
                            disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ModalAsignar
          guardia={selected}
          ingresos={ingresos}
          onClose={() => setSelected(null)}
          onSave={() => { refetch(); showToast('Asignación guardada correctamente.') }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl
          shadow-lg text-sm font-medium animate-fadeIn z-50">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
