import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { LISTAR_EMPRESAS_QUERY } from '../../graphql/queries'
import {
  CREAR_EMPRESA_MUTATION,
  EDITAR_EMPRESA_MUTATION,
  DESACTIVAR_EMPRESA_MUTATION,
  ACTIVAR_EMPRESA_MUTATION,
} from '../../graphql/mutations'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface Empresa {
  id_empresa: number
  nombre: string
  tipo: string
  nit: string
  contacto_nombre: string
  contrato_vigente: boolean
  contrato_desde: string
  contrato_hasta: string
  activo: boolean
  trabajadores_activos: number
}

const TIPO_INFO: Record<string, { label: string; color: string; icon: string }> = {
  externa:   { label: 'Empresa Externa',    color: 'bg-blue-100 text-blue-700',   icon: '🏢' },
  seguridad: { label: 'Empresa de Seguridad', color: 'bg-purple-100 text-purple-700', icon: '🛡️' },
}

const TIPO_OPTS = [
  { value: 'externa',   label: '🏢 Empresa Externa',      desc: 'Contratistas, proveedores, visitantes frecuentes' },
  { value: 'seguridad', label: '🛡️ Empresa de Seguridad', desc: 'Personal de vigilancia y guardias' },
]

interface EmpresaFormData {
  nombre: string
  tipo: string
  nit: string
  contactoNombre: string
  contratoVigente: boolean
  contratoDesde: string
  contratoHasta: string
}

const FORM_VACIO: EmpresaFormData = {
  nombre: '', tipo: 'externa', nit: '', contactoNombre: '',
  contratoVigente: true, contratoDesde: '', contratoHasta: '',
}

function ModalEmpresa({
  empresa,
  onClose,
  onGuardada,
}: {
  empresa: Empresa | null   // null = crear, objeto = editar
  onClose: () => void
  onGuardada: () => void
}) {
  const isEdit = empresa !== null

  const [form, setForm] = useState<EmpresaFormData>(
    isEdit
      ? {
          nombre: empresa.nombre,
          tipo: empresa.tipo || 'externa',
          nit: empresa.nit || '',
          contactoNombre: empresa.contacto_nombre || '',
          contratoVigente: empresa.contrato_vigente,
          contratoDesde: empresa.contrato_desde || '',
          contratoHasta: empresa.contrato_hasta || '',
        }
      : { ...FORM_VACIO },
  )
  const [error, setError] = useState('')

  const [crearEmpresa, { loading: loadingCrear }] = useMutation(CREAR_EMPRESA_MUTATION)
  const [editarEmpresa, { loading: loadingEditar }] = useMutation(EDITAR_EMPRESA_MUTATION)
  const loading = loadingCrear || loadingEditar

  const set = <K extends keyof EmpresaFormData>(k: K, v: EmpresaFormData[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const handleGuardar = async () => {
    setError('')
    if (!form.nombre.trim()) { setError('El nombre es requerido.'); return }

    try {
      if (isEdit) {
        const { data } = await editarEmpresa({
          variables: {
            idEmpresa: empresa.id_empresa,
            nombre: form.nombre.trim(),
            tipo: form.tipo,
            nit: form.nit || null,
            contactoNombre: form.contactoNombre || null,
            contratoVigente: form.contratoVigente,
            contratoDesde: form.contratoDesde || null,
            contratoHasta: form.contratoHasta || null,
          },
        })
        if (!data?.editarEmpresa?.success) {
          setError(data?.editarEmpresa?.message || 'Error al editar.')
          return
        }
      } else {
        const { data } = await crearEmpresa({
          variables: {
            nombre: form.nombre.trim(),
            tipo: form.tipo,
            nit: form.nit || null,
            contactoNombre: form.contactoNombre || null,
            contratoDesde: form.contratoDesde || null,
            contratoHasta: form.contratoHasta || null,
          },
        })
        if (!data?.crearEmpresa?.success) {
          setError(data?.crearEmpresa?.message || 'Error al crear.')
          return
        }
      }
      onGuardada()
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Cabecera */}
        <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h3 className="font-bold text-lg">
            {isEdit ? '✏️ Editar Empresa' : '➕ Nueva Empresa'}
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="label-field">Tipo de empresa *</label>
            <div className="flex gap-3 mt-1">
              {TIPO_OPTS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('tipo', opt.value)}
                  className={`flex-1 border-2 rounded-lg p-3 text-left transition-all ${
                    form.tipo === opt.value
                      ? 'border-[#1a3a6b] bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-semibold">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="label-field">Nombre *</label>
            <input
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              className="input-field"
              placeholder={form.tipo === 'seguridad' ? 'Ej: Seguridad UAGRM' : 'Ej: TecnoBolivia SRL'}
            />
          </div>

          {/* NIT */}
          <div>
            <label className="label-field">NIT</label>
            <input
              value={form.nit}
              onChange={e => set('nit', e.target.value)}
              className="input-field"
              placeholder="Ej: 123456789"
            />
          </div>

          {/* Contacto */}
          <div>
            <label className="label-field">Nombre del Contacto</label>
            <input
              value={form.contactoNombre}
              onChange={e => set('contactoNombre', e.target.value)}
              className="input-field"
              placeholder="Responsable o coordinador"
            />
          </div>

          {/* Contrato vigente (solo en edición) */}
          {isEdit && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <input
                id="contrato-vigente"
                type="checkbox"
                checked={form.contratoVigente}
                onChange={e => set('contratoVigente', e.target.checked)}
                className="w-4 h-4 accent-[#1a3a6b]"
              />
              <label htmlFor="contrato-vigente" className="text-sm font-medium text-gray-700 cursor-pointer">
                Contrato vigente
              </label>
              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                form.contratoVigente ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {form.contratoVigente ? '✅ Vigente' : 'Vencido'}
              </span>
            </div>
          )}

          {/* Fechas contrato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Contrato Desde</label>
              <input
                type="date"
                value={form.contratoDesde}
                onChange={e => set('contratoDesde', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Contrato Hasta</label>
              <input
                type="date"
                value={form.contratoHasta}
                onChange={e => set('contratoHasta', e.target.value)}
                className="input-field"
              />
            </div>
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
            {isEdit ? '💾 Guardar cambios' : '✅ Crear Empresa'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function Empresas() {
  const [modal, setModal] = useState<{ empresa: Empresa | null } | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Empresa | null>(null)
  const [msg, setMsg] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const { data, loading, refetch } = useQuery(LISTAR_EMPRESAS_QUERY)
  const [desactivar, { loading: loadingDesact }] = useMutation(DESACTIVAR_EMPRESA_MUTATION)
  const [activar,   { loading: loadingAct }]   = useMutation(ACTIVAR_EMPRESA_MUTATION)

  const todasEmpresas: Empresa[] = data?.listarEmpresas ? JSON.parse(data.listarEmpresas) : []

  const empresas = todasEmpresas.filter(e => {
    if (filtroTipo && e.tipo !== filtroTipo) return false
    if (filtroEstado === 'activa' && !e.activo) return false
    if (filtroEstado === 'inactiva' && e.activo) return false
    return true
  })

  const handleToggle = async () => {
    if (!confirmToggle) return
    try {
      if (confirmToggle.activo) {
        const { data: res } = await desactivar({ variables: { idEmpresa: confirmToggle.id_empresa } })
        setMsg(res?.desactivarEmpresa?.message || 'Empresa desactivada.')
      } else {
        const { data: res } = await activar({ variables: { idEmpresa: confirmToggle.id_empresa } })
        setMsg(res?.activarEmpresa?.message || 'Empresa reactivada.')
      }
      setConfirmToggle(null)
      refetch()
    } catch (e: unknown) {
      setMsg((e as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      {/* Título + botón crear */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a6b]">🏢 Empresas Externas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestiona empresas contratistas y de seguridad
          </p>
        </div>
        <Button onClick={() => setModal({ empresa: null })}>+ Nueva Empresa</Button>
      </div>

      {/* Mensaje de operación */}
      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex justify-between">
          <span>✅ {msg}</span>
          <button onClick={() => setMsg('')} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-gray-500">Filtrar:</span>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="input-field w-48"
        >
          <option value="">Todos los tipos</option>
          <option value="externa">🏢 Empresa Externa</option>
          <option value="seguridad">🛡️ Empresa de Seguridad</option>
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="input-field w-36"
        >
          <option value="">Todos los estados</option>
          <option value="activa">Activas</option>
          <option value="inactiva">Inactivas</option>
        </select>
        <span className="ml-auto text-xs text-gray-400">
          {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} encontrada{empresas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner text="Cargando empresas..." />
          </div>
        ) : empresas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏢</p>
            <p>No hay empresas registradas.</p>
            <button
              onClick={() => setModal({ empresa: null })}
              className="mt-3 text-sm text-[#1a3a6b] hover:underline"
            >
              + Crear primera empresa
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Empresa', 'Tipo', 'NIT', 'Contacto', 'Contrato', 'Personal activo', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empresas.map(e => {
                  const tipoInfo = TIPO_INFO[e.tipo] ?? { label: e.tipo, color: 'bg-gray-100 text-gray-600', icon: '🏢' }
                  return (
                    <tr key={e.id_empresa} className="border-b border-gray-50 hover:bg-blue-50 transition-colors duration-150">
                      <td className="py-3 px-4 font-semibold text-gray-800 whitespace-nowrap">
                        {e.nombre}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${tipoInfo.color}`}>
                          {tipoInfo.icon} {tipoInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-xs">{e.nit || '—'}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-[140px] truncate">{e.contacto_nombre || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            e.contrato_vigente ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {e.contrato_vigente ? '✅ Vigente' : '⚠ Vencido'}
                          </span>
                          {e.contrato_hasta && (
                            <div className="text-xs text-gray-400 pl-1">hasta {e.contrato_hasta}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#1a3a6b]">
                        {e.trabajadores_activos}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          e.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {e.activo ? '● Activa' : '● Inactiva'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {e.activo && (
                            <button
                              onClick={() => setModal({ empresa: e })}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-[#1a3a6b] hover:bg-blue-100 font-medium transition-colors whitespace-nowrap"
                            >
                              ✏️ Editar
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmToggle(e)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                              e.activo
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {e.activo ? '🚫 Desactivar' : '✅ Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear / editar */}
      {modal !== null && (
        <ModalEmpresa
          empresa={modal.empresa}
          onClose={() => setModal(null)}
          onGuardada={() => {
            refetch()
            setMsg(modal.empresa ? 'Empresa actualizada correctamente.' : 'Empresa creada correctamente.')
          }}
        />
      )}

      {/* Modal confirmar activar / desactivar */}
      {confirmToggle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">
              {confirmToggle.activo ? '⚠️ Desactivar empresa' : '✅ Activar empresa'}
            </h3>
            <p className="text-sm text-gray-600">
              {confirmToggle.activo ? (
                <>
                  ¿Desactivar <strong>"{confirmToggle.nombre}"</strong>?<br />
                  <span className="text-red-500 text-xs">
                    Esto desactivará a todos sus trabajadores activos.
                  </span>
                </>
              ) : (
                <>¿Reactivar la empresa <strong>"{confirmToggle.nombre}"</strong>?</>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setConfirmToggle(null)}>Cancelar</Button>
              <Button
                variant={confirmToggle.activo ? 'danger' : 'primary'}
                onClick={handleToggle}
                loading={loadingDesact || loadingAct}
              >
                {confirmToggle.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
