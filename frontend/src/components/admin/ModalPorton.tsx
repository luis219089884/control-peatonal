import { useMemo, useState } from 'react'
import { useMutation } from '@apollo/client'
import { CREAR_INGRESO_MUTATION, EDITAR_INGRESO_MUTATION } from '../../graphql/mutations'
import Button from '../ui/Button'

export interface FacultadPorton {
  idFacultad: number
  nombre: string
  activo?: boolean
  sede: { nombre: string }
}

export interface IngresoPorton {
  idIngreso: number
  nombre: string
  descripcion?: string | null
  ubicacion?: string | null
  idFacultad: number
}

interface ModalPortonProps {
  ingreso: IngresoPorton | null
  facultades: FacultadPorton[]
  onClose: () => void
  onGuardado: () => void | Promise<void>
}

function agruparPorSede(facs: FacultadPorton[]): Record<string, FacultadPorton[]> {
  const grupos: Record<string, FacultadPorton[]> = {}
  facs.forEach(f => {
    const sede = f.sede?.nombre || 'Sin sede'
    if (!grupos[sede]) grupos[sede] = []
    grupos[sede].push(f)
  })
  return grupos
}

export default function ModalPorton({
  ingreso,
  facultades,
  onClose,
  onGuardado,
}: ModalPortonProps) {
  const isEdit = ingreso !== null

  const opcionesFacultad = useMemo(() => {
    const activas = facultades.filter(f => f.activo !== false)
    if (!isEdit) return activas
    const actual = facultades.find(f => f.idFacultad === ingreso.idFacultad)
    if (actual && !activas.some(f => f.idFacultad === actual.idFacultad)) {
      return [actual, ...activas]
    }
    return activas
  }, [facultades, isEdit, ingreso])

  const defaultFacultad = isEdit
    ? ingreso.idFacultad
    : (opcionesFacultad[0]?.idFacultad ?? 0)

  const [nombre, setNombre] = useState(isEdit ? ingreso.nombre : '')
  const [descripcion, setDescripcion] = useState(isEdit ? (ingreso.descripcion || '') : '')
  const [ubicacion, setUbicacion] = useState(isEdit ? (ingreso.ubicacion || '') : '')
  const [idFacultad, setIdFacultad] = useState(defaultFacultad)
  const [error, setError] = useState('')

  const [crear, { loading: lCrear }] = useMutation(CREAR_INGRESO_MUTATION)
  const [editar, { loading: lEditar }] = useMutation(EDITAR_INGRESO_MUTATION)
  const loading = lCrear || lEditar

  const facPorSede = agruparPorSede(opcionesFacultad)

  const handleGuardar = async () => {
    setError('')
    if (!nombre.trim()) { setError('El nombre del portón es requerido.'); return }
    if (!idFacultad) { setError('Selecciona una facultad / sede.'); return }
    try {
      if (isEdit) {
        const { data } = await editar({
          variables: {
            idIngreso: ingreso.idIngreso,
            nombre: nombre.trim(),
            idFacultad,
            descripcion: descripcion || null,
            ubicacion: ubicacion || null,
          },
        })
        if (!data?.editarIngreso?.success) {
          setError(data?.editarIngreso?.message || 'Error al actualizar.')
          return
        }
      } else {
        const { data } = await crear({
          variables: {
            idFacultad,
            nombre: nombre.trim(),
            descripcion: descripcion || null,
            ubicacion: ubicacion || null,
          },
        })
        if (!data?.crearIngreso?.success) {
          setError(data?.crearIngreso?.message || 'Error al crear.')
          return
        }
      }
      await onGuardado()
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h3 className="font-bold text-lg">
            {isEdit ? '✏️ Editar Portón' : '➕ Nuevo Portón'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="label-field">Facultad / Sede *</label>
            <select
              value={idFacultad}
              onChange={e => setIdFacultad(Number(e.target.value))}
              className="input-field"
            >
              <option value={0} disabled>— Seleccionar —</option>
              {Object.entries(facPorSede).map(([sede, facs]) => (
                <optgroup key={sede} label={sede}>
                  {facs.map(f => (
                    <option key={f.idFacultad} value={f.idFacultad}>
                      {f.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field">Nombre del portón *</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="input-field"
              placeholder="Ej: Portón Principal FICCT"
              autoFocus={!isEdit}
            />
          </div>

          <div>
            <label className="label-field">Descripción</label>
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              className="input-field"
              placeholder="Descripción opcional"
            />
          </div>

          <div>
            <label className="label-field">Ubicación</label>
            <input
              value={ubicacion}
              onChange={e => setUbicacion(e.target.value)}
              className="input-field"
              placeholder="Ej: Campus Central - Av. del Ejército"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGuardar} loading={loading}>
            {isEdit ? '💾 Guardar cambios' : '✅ Crear Portón'}
          </Button>
        </div>
      </div>
    </div>
  )
}
