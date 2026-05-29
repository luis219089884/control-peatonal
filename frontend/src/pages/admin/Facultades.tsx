import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { LISTAR_FACULTADES_QUERY, LISTAR_INGRESOS_QUERY } from '../../graphql/queries'
import { CREAR_INGRESO_MUTATION } from '../../graphql/mutations'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface Facultad { idFacultad: number; nombre: string; descripcion?: string; sede: { nombre: string; ciudad: string } }
interface IngresoConGuardia { idIngreso: number; nombre: string; descripcion?: string; ubicacion?: string; facultadNombre: string; sedeNombre: string; guardiaNombre?: string; turno?: string }

function ModalNuevaPuerta({ facultades, onClose, onCreada }: { facultades: Facultad[]; onClose: () => void; onCreada: () => void }) {
  const [form, setForm] = useState({ idFacultad: facultades[0]?.idFacultad || 0, nombre: '', descripcion: '', ubicacion: '' })
  const [error, setError] = useState('')
  const [crearIngreso, { loading }] = useMutation(CREAR_INGRESO_MUTATION)

  const handleSubmit = async () => {
    setError('')
    if (!form.nombre.trim()) { setError('El nombre es requerido.'); return }
    try {
      const { data } = await crearIngreso({ variables: { idFacultad: form.idFacultad, nombre: form.nombre, descripcion: form.descripcion, ubicacion: form.ubicacion } })
      if (!data?.crearIngreso?.success) { setError(data?.crearIngreso?.message || 'Error'); return }
      onCreada(); onClose()
    } catch (e: unknown) { setError((e as Error).message) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h3 className="font-bold text-lg">Nueva Puerta de Ingreso</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div><label className="label-field">Facultad *</label>
            <select value={form.idFacultad} onChange={e => setForm(p => ({ ...p, idFacultad: +e.target.value }))} className="input-field">
              {facultades.map(f => <option key={f.idFacultad} value={f.idFacultad}>{f.nombre}</option>)}
            </select>
          </div>
          <div><label className="label-field">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="input-field" placeholder="Ej: Puerta Principal FICCT" /></div>
          <div><label className="label-field">Descripción</label>
            <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className="input-field" /></div>
          <div><label className="label-field">Ubicación</label>
            <input value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} className="input-field" placeholder="Ej: Campus Central - Edificio A" /></div>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {error}</div>}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>✅ Crear Puerta</Button>
        </div>
      </div>
    </div>
  )
}

export default function Facultades() {
  const [tab, setTab] = useState<'facultades' | 'ingresos'>('facultades')
  const [showModal, setShowModal] = useState(false)

  const { data: facData, loading: loadingFac } = useQuery(LISTAR_FACULTADES_QUERY)
  const { data: ingData, loading: loadingIng, refetch: refetchIngresos } = useQuery(LISTAR_INGRESOS_QUERY)

  const facultades: Facultad[] = facData?.listarFacultades ?? []
  const ingresos: IngresoConGuardia[] = ingData?.listarIngresos ?? []

  // Agrupar facultades por sede
  const porSede: Record<string, Facultad[]> = {}
  facultades.forEach(f => {
    const sede = f.sede.nombre
    if (!porSede[sede]) porSede[sede] = []
    porSede[sede].push(f)
  })

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-[#1a3a6b]">🏛️ Facultades e Ingresos</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {([['facultades', '🏛️ Facultades'], ['ingresos', '🚪 Ingresos / Puertas']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-px
              ${tab === id ? 'border-[#1a3a6b] text-[#1a3a6b]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab Facultades */}
      {tab === 'facultades' && (
        loadingFac ? <div className="flex justify-center mt-12"><LoadingSpinner /></div> :
        <div className="space-y-6">
          {Object.entries(porSede).map(([sede, facs]) => (
            <div key={sede} className="bg-white rounded-xl shadow-card overflow-hidden">
              <div className="bg-[#1a3a6b] text-white px-5 py-3">
                <p className="font-semibold text-sm">📍 {sede}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {facs.map(f => (
                  <div key={f.idFacultad} className="px-5 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{f.nombre}</p>
                      {f.descripcion && <p className="text-xs text-gray-400 mt-0.5">{f.descripcion}</p>}
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {f.sede.ciudad}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Ingresos */}
      {tab === 'ingresos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowModal(true)}>+ Nueva Puerta</Button>
          </div>

          {loadingIng ? <div className="flex justify-center mt-12"><LoadingSpinner /></div> :
            ingresos.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl shadow-card">
                <p className="text-4xl mb-3">🚪</p><p>No hay puertas registradas.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Nombre', 'Facultad', 'Sede', 'Guardia asignado', 'Turno'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ingresos.map(i => (
                      <tr key={i.idIngreso} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-800">{i.nombre}</td>
                        <td className="py-3 px-4 text-gray-600 text-xs max-w-[200px] truncate">{i.facultadNombre}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{i.sedeNombre}</td>
                        <td className="py-3 px-4 text-gray-600">{i.guardiaNombre || <span className="text-gray-300 italic text-xs">Sin asignar</span>}</td>
                        <td className="py-3 px-4">
                          {i.turno ? (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium capitalize">{i.turno}</span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {showModal && (
        <ModalNuevaPuerta
          facultades={facultades}
          onClose={() => setShowModal(false)}
          onCreada={refetchIngresos}
        />
      )}
    </div>
  )
}
