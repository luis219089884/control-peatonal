import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import {
  LISTAR_FACULTADES_QUERY,
  LISTAR_INGRESOS_QUERY,
  LISTAR_SEDES_QUERY,
} from '../../graphql/queries'
import {
  CREAR_FACULTAD_MUTATION,
  EDITAR_FACULTAD_MUTATION,
  DESACTIVAR_FACULTAD_MUTATION,
  ACTIVAR_FACULTAD_MUTATION,
  CREAR_INGRESO_MUTATION,
  EDITAR_INGRESO_MUTATION,
  DESACTIVAR_INGRESO_MUTATION,
  ACTIVAR_INGRESO_MUTATION,
} from '../../graphql/mutations'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Sede { idSede: number; nombre: string; ciudad: string; departamento: string }
interface Facultad {
  idFacultad: number; nombre: string; descripcion?: string; activo: boolean
  sede: { idSede: number; nombre: string; ciudad: string }
}
interface Ingreso {
  idIngreso: number; nombre: string; descripcion?: string; ubicacion?: string
  facultadNombre: string; sedeNombre: string; guardiaNombre?: string
  turno?: string; activo: boolean; idFacultad: number
}

// ─── Modal Facultad ───────────────────────────────────────────────────────────

function ModalFacultad({
  facultad, sedes, onClose, onGuardada,
}: {
  facultad: Facultad | null
  sedes: Sede[]
  onClose: () => void
  onGuardada: () => void
}) {
  const isEdit = facultad !== null
  const [nombre, setNombre] = useState(isEdit ? facultad.nombre : '')
  const [descripcion, setDescripcion] = useState(isEdit ? (facultad.descripcion || '') : '')
  const [idSede, setIdSede] = useState(
    isEdit ? facultad.sede.idSede : (sedes[0]?.idSede ?? 0)
  )
  const [error, setError] = useState('')

  const [crear, { loading: lCrear }] = useMutation(CREAR_FACULTAD_MUTATION)
  const [editar, { loading: lEditar }] = useMutation(EDITAR_FACULTAD_MUTATION)
  const loading = lCrear || lEditar

  const handleGuardar = async () => {
    setError('')
    if (!nombre.trim()) { setError('El nombre es requerido.'); return }
    if (!idSede) { setError('Selecciona una sede.'); return }
    try {
      if (isEdit) {
        const { data } = await editar({
          variables: { idFacultad: facultad.idFacultad, nombre: nombre.trim(), idSede, descripcion: descripcion || null },
        })
        if (!data?.editarFacultad?.success) { setError(data?.editarFacultad?.message || 'Error'); return }
      } else {
        const { data } = await crear({
          variables: { idSede, nombre: nombre.trim(), descripcion: descripcion || null },
        })
        if (!data?.crearFacultad?.success) { setError(data?.crearFacultad?.message || 'Error'); return }
      }
      onGuardada(); onClose()
    } catch (e: unknown) { setError((e as Error).message) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h3 className="font-bold text-lg">{isEdit ? '✏️ Editar Facultad' : '➕ Nueva Facultad'}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="label-field">Sede *</label>
            <select value={idSede} onChange={e => setIdSede(+e.target.value)} className="input-field">
              <option value={0} disabled>Seleccionar sede...</option>
              {sedes.map(s => (
                <option key={s.idSede} value={s.idSede}>
                  {s.nombre} — {s.ciudad}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="input-field"
              placeholder="Ej: Facultad de Ingeniería en Ciencias de la Computación y Telecomunicaciones" />
          </div>
          <div>
            <label className="label-field">Descripción</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
              className="input-field resize-none" placeholder="Descripción opcional..." />
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {error}</div>}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGuardar} loading={loading}>
            {isEdit ? '💾 Guardar cambios' : '✅ Crear Facultad'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Ingreso / Puerta ───────────────────────────────────────────────────

function ModalIngreso({
  ingreso, facultades, onClose, onGuardado,
}: {
  ingreso: Ingreso | null
  facultades: Facultad[]
  onClose: () => void
  onGuardado: () => void
}) {
  const isEdit = ingreso !== null
  const activasFacs = facultades.filter(f => f.activo)
  const [nombre, setNombre] = useState(isEdit ? ingreso.nombre : '')
  const [descripcion, setDescripcion] = useState(isEdit ? (ingreso.descripcion || '') : '')
  const [ubicacion, setUbicacion] = useState(isEdit ? (ingreso.ubicacion || '') : '')
  const [idFacultad, setIdFacultad] = useState(
    isEdit ? ingreso.idFacultad : (activasFacs[0]?.idFacultad ?? 0)
  )
  const [error, setError] = useState('')

  const [crear, { loading: lCrear }] = useMutation(CREAR_INGRESO_MUTATION)
  const [editar, { loading: lEditar }] = useMutation(EDITAR_INGRESO_MUTATION)
  const loading = lCrear || lEditar

  const handleGuardar = async () => {
    setError('')
    if (!nombre.trim()) { setError('El nombre es requerido.'); return }
    if (!idFacultad) { setError('Selecciona una facultad.'); return }
    try {
      if (isEdit) {
        const { data } = await editar({
          variables: { idIngreso: ingreso.idIngreso, nombre: nombre.trim(), idFacultad, descripcion: descripcion || null, ubicacion: ubicacion || null },
        })
        if (!data?.editarIngreso?.success) { setError(data?.editarIngreso?.message || 'Error'); return }
      } else {
        const { data } = await crear({
          variables: { idFacultad, nombre: nombre.trim(), descripcion: descripcion || null, ubicacion: ubicacion || null },
        })
        if (!data?.crearIngreso?.success) { setError(data?.crearIngreso?.message || 'Error'); return }
      }
      onGuardado(); onClose()
    } catch (e: unknown) { setError((e as Error).message) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h3 className="font-bold text-lg">{isEdit ? '✏️ Editar Puerta' : '➕ Nueva Puerta de Ingreso'}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="label-field">Facultad *</label>
            <select value={idFacultad} onChange={e => setIdFacultad(+e.target.value)} className="input-field">
              <option value={0} disabled>Seleccionar facultad...</option>
              {activasFacs.map(f => (
                <option key={f.idFacultad} value={f.idFacultad}>
                  {f.nombre} ({f.sede.nombre})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="input-field"
              placeholder="Ej: Puerta Principal FICCT" />
          </div>
          <div>
            <label className="label-field">Descripción</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)} className="input-field"
              placeholder="Descripción opcional" />
          </div>
          <div>
            <label className="label-field">Ubicación</label>
            <input value={ubicacion} onChange={e => setUbicacion(e.target.value)} className="input-field"
              placeholder="Ej: Campus Central - Av. del Ejército" />
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {error}</div>}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGuardar} loading={loading}>
            {isEdit ? '💾 Guardar cambios' : '✅ Crear Puerta'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Confirm = { tipo: 'facultad' | 'ingreso'; id: number; nombre: string; activo: boolean }

export default function Facultades() {
  const [tab, setTab] = useState<'facultades' | 'ingresos'>('facultades')
  const [modalFac, setModalFac] = useState<{ facultad: Facultad | null } | null>(null)
  const [modalIng, setModalIng] = useState<{ ingreso: Ingreso | null } | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [msg, setMsg] = useState('')
  const [filtroEstadoFac, setFiltroEstadoFac] = useState('activa')
  const [filtroEstadoIng, setFiltroEstadoIng] = useState('activa')

  const { data: sedesData } = useQuery(LISTAR_SEDES_QUERY)
  const { data: facData, loading: loadingFac, refetch: refetchFac } = useQuery(LISTAR_FACULTADES_QUERY, {
    variables: { soloActivas: false },
  })
  const { data: ingData, loading: loadingIng, refetch: refetchIng } = useQuery(LISTAR_INGRESOS_QUERY, {
    variables: { soloActivos: false },
  })

  const sedes: Sede[] = sedesData?.listarSedes ?? []
  const todasFacultades: Facultad[] = facData?.listarFacultades ?? []
  const todosIngresos: Ingreso[] = ingData?.listarIngresos ?? []

  const facultades = todasFacultades.filter(f => {
    if (filtroEstadoFac === 'activa') return f.activo
    if (filtroEstadoFac === 'inactiva') return !f.activo
    return true
  })

  const ingresos = todosIngresos.filter(i => {
    if (filtroEstadoIng === 'activa') return i.activo
    if (filtroEstadoIng === 'inactiva') return !i.activo
    return true
  })

  // Mutations de toggle
  const [desactivarFac, { loading: ldFac }] = useMutation(DESACTIVAR_FACULTAD_MUTATION)
  const [activarFac,    { loading: laFac }] = useMutation(ACTIVAR_FACULTAD_MUTATION)
  const [desactivarIng, { loading: ldIng }] = useMutation(DESACTIVAR_INGRESO_MUTATION)
  const [activarIng,    { loading: laIng }] = useMutation(ACTIVAR_INGRESO_MUTATION)
  const loadingConfirm = ldFac || laFac || ldIng || laIng

  const handleToggle = async () => {
    if (!confirm) return
    try {
      if (confirm.tipo === 'facultad') {
        const mut = confirm.activo ? desactivarFac : activarFac
        const key = confirm.activo ? 'desactivarFacultad' : 'activarFacultad'
        const { data } = await mut({ variables: { idFacultad: confirm.id } })
        setMsg(data?.[key]?.message || 'Listo.')
        refetchFac()
      } else {
        const mut = confirm.activo ? desactivarIng : activarIng
        const key = confirm.activo ? 'desactivarIngreso' : 'activarIngreso'
        const { data } = await mut({ variables: { idIngreso: confirm.id } })
        setMsg(data?.[key]?.message || 'Listo.')
        refetchIng()
      }
      setConfirm(null)
    } catch (e: unknown) { setMsg((e as Error).message) }
  }

  const porSede: Record<string, Facultad[]> = {}
  facultades.forEach(f => {
    const s = f.sede.nombre
    if (!porSede[s]) porSede[s] = []
    porSede[s].push(f)
  })

  const HORARIOS_GUARDIA: Record<string, string> = {
    jornada: '07:00 - 22:00',
    manana: 'Mañana',
    tarde: 'Tarde',
    noche: 'Noche',
  }

  return (
    <div className="space-y-5">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a6b]">🏛️ Facultades e Ingresos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestiona facultades y puertas de acceso</p>
      </div>

      {/* Mensaje */}
      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex justify-between">
          <span>✅ {msg}</span>
          <button onClick={() => setMsg('')} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['facultades', '🏛️ Facultades'], ['ingresos', '🚪 Ingresos / Puertas']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px
              ${tab === id ? 'border-[#1a3a6b] text-[#1a3a6b]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB FACULTADES ── */}
      {tab === 'facultades' && (
        <div className="space-y-4">
          {/* Barra herramientas */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={filtroEstadoFac} onChange={e => setFiltroEstadoFac(e.target.value)} className="input-field w-40">
              <option value="activa">Activas</option>
              <option value="inactiva">Inactivas</option>
              <option value="">Todas</option>
            </select>
            <span className="text-xs text-gray-400 flex-1">
              {facultades.length} facultad{facultades.length !== 1 ? 'es' : ''}
            </span>
            <Button onClick={() => setModalFac({ facultad: null })}>+ Nueva Facultad</Button>
          </div>

          {loadingFac ? (
            <div className="flex justify-center mt-12"><LoadingSpinner text="Cargando facultades..." /></div>
          ) : facultades.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl shadow-card">
              <p className="text-4xl mb-3">🏛️</p>
              <p>No hay facultades {filtroEstadoFac === 'activa' ? 'activas' : filtroEstadoFac === 'inactiva' ? 'inactivas' : ''} registradas.</p>
              {filtroEstadoFac !== 'inactiva' && (
                <button onClick={() => setModalFac({ facultad: null })} className="mt-3 text-sm text-[#1a3a6b] hover:underline">
                  + Crear primera facultad
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(porSede).map(([sede, facs]) => (
                <div key={sede} className="bg-white rounded-xl shadow-card overflow-hidden">
                  <div className="bg-[#1a3a6b] text-white px-5 py-3 flex items-center gap-2">
                    <span className="font-semibold text-sm">📍 {sede}</span>
                    <span className="text-blue-200 text-xs ml-auto">{facs.length} facultad{facs.length !== 1 ? 'es' : ''}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {facs.map(f => (
                      <div key={f.idFacultad} className="px-5 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800">{f.nombre}</p>
                            {!f.activo && (
                              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Inactiva</span>
                            )}
                          </div>
                          {f.descripcion && <p className="text-xs text-gray-400 mt-0.5">{f.descripcion}</p>}
                          <p className="text-xs text-gray-400">{f.sede.ciudad}, {f.sede.departamento ?? ''}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {f.activo && (
                            <button
                              onClick={() => setModalFac({ facultad: f })}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-[#1a3a6b] hover:bg-blue-100 font-medium transition-colors"
                            >
                              ✏️ Editar
                            </button>
                          )}
                          <button
                            onClick={() => setConfirm({ tipo: 'facultad', id: f.idFacultad, nombre: f.nombre, activo: f.activo })}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                              f.activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {f.activo ? '🚫 Desactivar' : '✅ Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB INGRESOS ── */}
      {tab === 'ingresos' && (
        <div className="space-y-4">
          {/* Barra herramientas */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={filtroEstadoIng} onChange={e => setFiltroEstadoIng(e.target.value)} className="input-field w-40">
              <option value="activa">Activas</option>
              <option value="inactiva">Inactivas</option>
              <option value="">Todas</option>
            </select>
            <span className="text-xs text-gray-400 flex-1">
              {ingresos.length} puerta{ingresos.length !== 1 ? 's' : ''}
            </span>
            <Button onClick={() => setModalIng({ ingreso: null })}>+ Nueva Puerta</Button>
          </div>

          {loadingIng ? (
            <div className="flex justify-center mt-12"><LoadingSpinner text="Cargando puertas..." /></div>
          ) : ingresos.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl shadow-card">
              <p className="text-4xl mb-3">🚪</p>
              <p>No hay puertas registradas.</p>
              <button onClick={() => setModalIng({ ingreso: null })} className="mt-3 text-sm text-[#1a3a6b] hover:underline">
                + Crear primera puerta
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Puerta', 'Facultad', 'Sede', 'Ubicación', 'Guardia asignado', 'Turno', 'Estado', 'Acciones'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ingresos.map(i => (
                      <tr key={i.idIngreso} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-800 whitespace-nowrap">{i.nombre}</td>
                        <td className="py-3 px-4 text-gray-600 text-xs max-w-[180px] truncate">{i.facultadNombre}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{i.sedeNombre}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs max-w-[140px] truncate">{i.ubicacion || '—'}</td>
                        <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">
                          {i.guardiaNombre || <span className="text-gray-300 italic">Sin asignar</span>}
                        </td>
                        <td className="py-3 px-4">
                          {i.turno ? (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                              {HORARIOS_GUARDIA[i.turno] ?? i.turno}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            i.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {i.activo ? '● Activa' : '● Inactiva'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 flex-wrap">
                            {i.activo && (
                              <button
                                onClick={() => setModalIng({ ingreso: i })}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-[#1a3a6b] hover:bg-blue-100 font-medium transition-colors"
                              >
                                ✏️ Editar
                              </button>
                            )}
                            <button
                              onClick={() => setConfirm({ tipo: 'ingreso', id: i.idIngreso, nombre: i.nombre, activo: i.activo })}
                              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                                i.activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'
                              }`}
                            >
                              {i.activo ? '🚫 Desactivar' : '✅ Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {modalFac !== null && (
        <ModalFacultad
          facultad={modalFac.facultad}
          sedes={sedes}
          onClose={() => setModalFac(null)}
          onGuardada={() => {
            refetchFac()
            setMsg(modalFac.facultad ? 'Facultad actualizada.' : 'Facultad creada correctamente.')
          }}
        />
      )}

      {modalIng !== null && (
        <ModalIngreso
          ingreso={modalIng.ingreso}
          facultades={todasFacultades}
          onClose={() => setModalIng(null)}
          onGuardado={() => {
            refetchIng()
            setMsg(modalIng.ingreso ? 'Puerta actualizada.' : 'Puerta creada correctamente.')
          }}
        />
      )}

      {/* Confirmar activar / desactivar */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">
              {confirm.activo
                ? `⚠️ Desactivar ${confirm.tipo === 'facultad' ? 'facultad' : 'puerta'}`
                : `✅ Activar ${confirm.tipo === 'facultad' ? 'facultad' : 'puerta'}`}
            </h3>
            <p className="text-sm text-gray-600">
              {confirm.activo ? (
                <>
                  ¿Desactivar <strong>"{confirm.nombre}"</strong>?
                  {confirm.tipo === 'facultad' && (
                    <><br /><span className="text-amber-600 text-xs">También se desactivarán sus carreras asociadas.</span></>
                  )}
                </>
              ) : (
                <>¿Reactivar <strong>"{confirm.nombre}"</strong>?</>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button
                variant={confirm.activo ? 'danger' : 'primary'}
                onClick={handleToggle}
                loading={loadingConfirm}
              >
                {confirm.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
