import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { LISTAR_INGRESOS_QUERY, LISTAR_FACULTADES_QUERY, LISTAR_SEDES_QUERY } from '../../graphql/queries'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { gql } from '@apollo/client'

const CREAR_INGRESO_MUTATION = gql`
  mutation CrearIngreso($idFacultad: Int!, $nombre: String!, $descripcion: String, $ubicacion: String) {
    crearIngreso(idFacultad: $idFacultad, nombre: $nombre, descripcion: $descripcion, ubicacion: $ubicacion) {
      success message
    }
  }
`

interface Ingreso {
  idIngreso: number
  nombre: string
  descripcion: string | null
  ubicacion: string | null
  sedeNombre: string
  facultadNombre: string
  guardiaNombre: string | null
  turno: string | null
  activo: boolean
  idFacultad: number
  idSede: number
}

interface Facultad {
  idFacultad: number
  nombre: string
  sede: { nombre: string }
}

function ModalCrear({
  facultades,
  onClose,
  onSave,
}: {
  facultades: Facultad[]
  onClose: () => void
  onSave: () => void
}) {
  const [nombre, setNombre]       = useState('')
  const [idFacultad, setIdFacultad] = useState(0)
  const [descripcion, setDescripcion] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [msg, setMsg]             = useState('')
  const [crear, { loading }]      = useMutation(CREAR_INGRESO_MUTATION)

  const facPorSede: Record<string, Facultad[]> = {}
  facultades.forEach(f => {
    const s = f.sede?.nombre || 'Sin sede'
    if (!facPorSede[s]) facPorSede[s] = []
    facPorSede[s].push(f)
  })

  const handleSave = async () => {
    if (!nombre.trim()) { setMsg('El nombre es requerido.'); return }
    if (!idFacultad) { setMsg('Selecciona una facultad.'); return }
    try {
      const { data } = await crear({
        variables: { idFacultad, nombre: nombre.trim(), descripcion: descripcion || null, ubicacion: ubicacion || null },
      })
      if (data?.crearIngreso?.success) { onSave(); onClose() }
      else setMsg(data?.crearIngreso?.message ?? 'Error')
    } catch (e: unknown) { setMsg((e as Error).message) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1a3a6b] text-lg">Nuevo Portón</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Nombre del portón *</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Portón Principal Norte"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2a5298]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Facultad / Sede *</label>
            <select
              value={idFacultad}
              onChange={e => setIdFacultad(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2a5298] bg-white"
            >
              <option value={0}>— Seleccionar —</option>
              {Object.entries(facPorSede).map(([sede, facs]) => (
                <optgroup key={sede} label={`📍 ${sede}`}>
                  {facs.map(f => <option key={f.idFacultad} value={f.idFacultad}>{f.nombre}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Descripción</label>
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción opcional"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2a5298]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Ubicación</label>
            <input
              value={ubicacion}
              onChange={e => setUbicacion(e.target.value)}
              placeholder="Ej: Calle Seoane esquina Murillo"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2a5298]"
            />
          </div>
          {msg && <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">{msg}</p>}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#1a3a6b] hover:bg-[#2a5298] text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear Portón'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Portones() {
  const [search, setSearch]     = useState('')
  const [filtroSede, setFiltroSede] = useState('todas')
  const [showCrear, setShowCrear] = useState(false)
  const [toast, setToast]       = useState('')

  const { data, loading, refetch } = useQuery(LISTAR_INGRESOS_QUERY, { variables: {}, fetchPolicy: 'network-only' })
  const { data: facData }          = useQuery(LISTAR_FACULTADES_QUERY, { variables: { soloActivas: true } })
  const { data: sedeData }         = useQuery(LISTAR_SEDES_QUERY)

  const ingresos: Ingreso[] = data?.listarIngresos ?? []
  const facultades: Facultad[] = facData?.listarFacultades ?? []
  const sedes = sedeData?.listarSedes ?? []

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const filtrados = ingresos.filter(i => {
    const matchSearch = `${i.nombre} ${i.sedeNombre} ${i.facultadNombre}`.toLowerCase().includes(search.toLowerCase())
    const matchSede = filtroSede === 'todas' || i.sedeNombre === filtroSede
    return matchSearch && matchSede
  })

  const conGuardia  = ingresos.filter(i => i.guardiaNombre).length
  const sinGuardia  = ingresos.length - conGuardia

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">🚪 Portones / Puntos de Acceso</h1>
        <button
          onClick={() => setShowCrear(true)}
          className="flex items-center gap-2 bg-[#1a3a6b] hover:bg-[#2a5298] text-white
            text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          + Nuevo Portón
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <span className="text-2xl">🚪</span>
          <div><p className="text-2xl font-bold text-[#1a3a6b]">{ingresos.length}</p><p className="text-xs text-gray-500">Total portones</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div><p className="text-2xl font-bold text-green-600">{conGuardia}</p><p className="text-xs text-gray-500">Con guardia</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div><p className="text-2xl font-bold text-yellow-600">{sinGuardia}</p><p className="text-xs text-gray-500">Sin guardia</p></div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar portón..."
          className="flex-1 min-w-[200px] border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2a5298]"
        />
        <select
          value={filtroSede}
          onChange={e => setFiltroSede(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2a5298] bg-white"
        >
          <option value="todas">Todas las sedes</option>
          {sedes.map((s: { idSede: number; nombre: string }) => (
            <option key={s.idSede} value={s.nombre}>{s.nombre}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner text="Cargando portones..." /></div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-10 text-center text-gray-400">
          <p className="text-3xl mb-2">🚪</p>
          <p>No hay portones registrados aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map(i => (
            <div key={i.idIngreso} className="bg-white rounded-xl shadow-card p-5 space-y-3 border border-gray-50 hover:border-blue-200 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[#1a3a6b] text-base leading-tight">{i.nombre}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{i.descripcion || 'Sin descripción'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0
                  ${i.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {i.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <span>🏙️</span>
                  <span className="text-xs">{i.sedeNombre}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span>🏛️</span>
                  <span className="text-xs truncate">{i.facultadNombre}</span>
                </div>
                {i.ubicacion && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <span>📍</span>
                    <span className="text-xs">{i.ubicacion}</span>
                  </div>
                )}
              </div>

              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                ${i.guardiaNombre
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                }`}>
                <span>👮</span>
                {i.guardiaNombre
                  ? <span>{i.guardiaNombre} · {i.turno}</span>
                  : <span>Sin guardia asignado</span>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {showCrear && (
        <ModalCrear
          facultades={facultades}
          onClose={() => setShowCrear(false)}
          onSave={() => { refetch(); showToast('Portón creado correctamente.') }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-fadeIn z-50">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
