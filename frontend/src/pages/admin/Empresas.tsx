import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { LISTAR_EMPRESAS_QUERY } from '../../graphql/queries'
import { CREAR_EMPRESA_MUTATION, DESACTIVAR_EMPRESA_MUTATION } from '../../graphql/mutations'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface Empresa {
  id_empresa: number; nombre: string; nit: string; contacto_nombre: string;
  contrato_vigente: boolean; contrato_desde: string; contrato_hasta: string;
  activo: boolean; trabajadores_activos: number;
}

function ModalNuevaEmpresa({ onClose, onCreada }: { onClose: () => void; onCreada: () => void }) {
  const [form, setForm] = useState({ nombre: '', nit: '', contactoNombre: '', contratoDesde: '', contratoHasta: '' })
  const [error, setError] = useState('')
  const [crearEmpresa, { loading }] = useMutation(CREAR_EMPRESA_MUTATION)

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    setError('')
    if (!form.nombre.trim()) { setError('El nombre es requerido.'); return }
    try {
      const { data } = await crearEmpresa({ variables: form })
      if (!data?.crearEmpresa?.success) { setError(data?.crearEmpresa?.message || 'Error'); return }
      onCreada(); onClose()
    } catch (e: unknown) { setError((e as Error).message) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h3 className="font-bold text-lg">Nueva Empresa Externa</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div><label className="label-field">Nombre *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} className="input-field" placeholder="Ej: TecnoBolivia SRL" /></div>
          <div><label className="label-field">NIT</label>
            <input value={form.nit} onChange={e => set('nit', e.target.value)} className="input-field" placeholder="Ej: 123456789" /></div>
          <div><label className="label-field">Nombre del Contacto</label>
            <input value={form.contactoNombre} onChange={e => set('contactoNombre', e.target.value)} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-field">Contrato Desde</label>
              <input type="date" value={form.contratoDesde} onChange={e => set('contratoDesde', e.target.value)} className="input-field" /></div>
            <div><label className="label-field">Contrato Hasta</label>
              <input type="date" value={form.contratoHasta} onChange={e => set('contratoHasta', e.target.value)} className="input-field" /></div>
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {error}</div>}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>✅ Crear Empresa</Button>
        </div>
      </div>
    </div>
  )
}

export default function Empresas() {
  const [showModal, setShowModal] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [confirmNombre, setConfirmNombre] = useState('')
  const [msg, setMsg] = useState('')

  const { data, loading, refetch } = useQuery(LISTAR_EMPRESAS_QUERY)
  const [desactivar, { loading: loadingDesact }] = useMutation(DESACTIVAR_EMPRESA_MUTATION)

  const empresas: Empresa[] = data?.listarEmpresas ? JSON.parse(data.listarEmpresas) : []

  const handleDesactivar = async () => {
    if (!confirmId) return
    try {
      const { data } = await desactivar({ variables: { idEmpresa: confirmId } })
      setMsg(data?.desactivarEmpresa?.message || 'Listo.')
      setConfirmId(null)
      refetch()
    } catch (e: unknown) { setMsg((e as Error).message) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">🏢 Empresas Externas</h1>
        <Button onClick={() => setShowModal(true)}>+ Nueva Empresa</Button>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex justify-between">
          <span>✅ {msg}</span>
          <button onClick={() => setMsg('')} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner text="Cargando empresas..." /></div>
        ) : empresas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏢</p>
            <p>No hay empresas registradas.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Empresa', 'NIT', 'Contacto', 'Contrato vigente', 'Trabajadores', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empresas.map(e => (
                <tr key={e.id_empresa} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-800">{e.nombre}</td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-xs">{e.nit || '—'}</td>
                  <td className="py-3 px-4 text-gray-600">{e.contacto_nombre || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.contrato_vigente ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {e.contrato_vigente ? '✅ Vigente' : 'Vencido'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-[#1a3a6b]">{e.trabajadores_activos}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {e.activo ? '● Activa' : '● Inactiva'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {e.activo && (
                      <button
                        onClick={() => { setConfirmId(e.id_empresa); setConfirmNombre(e.nombre) }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal confirmación desactivar */}
      {confirmId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">⚠️ Confirmar desactivación</h3>
            <p className="text-sm text-gray-600">
              ¿Desactivar la empresa <strong>"{confirmNombre}"</strong>?<br />
              Esto desactivará a todos sus trabajadores.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setConfirmId(null)}>Cancelar</Button>
              <Button variant="danger" onClick={handleDesactivar} loading={loadingDesact}>Desactivar</Button>
            </div>
          </div>
        </div>
      )}

      {showModal && <ModalNuevaEmpresa onClose={() => setShowModal(false)} onCreada={refetch} />}
    </div>
  )
}
