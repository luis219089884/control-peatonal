import { useState, useMemo } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { REGISTRAR_INVITADO_MUTATION, CANCELAR_INVITADO_MUTATION } from '../graphql/mutations'
import { LISTAR_FACULTADES_QUERY, MIS_INVITADOS_QUERY } from '../graphql/queries'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

interface Facultad { idFacultad: number; nombre: string; sede: { nombre: string } }
interface Invitado {
  idInvitado: number
  nombres: string; apellidos: string; ci: string
  email: string; celular?: string; motivoVisita: string
  fechaVisita: string; expiraEn: string; yaIngreso: boolean; activo: boolean; creadoEn: string
  facultadDestino: { idFacultad: number; nombre: string; sede: { nombre: string } }
}
interface ExitoReg { tokenQr: string; expiraEn: string; message: string; emailEnviado: boolean; emailDestino: string }

const hoy = new Date().toISOString().slice(0, 10)

function estadoInvitado(inv: Invitado): { label: string; color: string } {
  if (!inv.activo) return { label: 'Cancelado', color: 'bg-red-100 text-red-700' }
  if (inv.yaIngreso) return { label: 'Ya ingresó', color: 'bg-blue-100 text-blue-700' }
  if (new Date(inv.expiraEn) < new Date()) return { label: 'Expirado', color: 'bg-gray-100 text-gray-500' }
  return { label: 'Vigente', color: 'bg-green-100 text-green-700' }
}

// ── Modal de registro ──────────────────────────────────────────────────────────
function ModalRegistrar({
  onClose, onRegistrado,
}: { onClose: () => void; onRegistrado: (exito: ExitoReg) => void }) {
  const [form, setForm] = useState({
    nombres: '', apellidos: '', ci: '', celular: '', email: '',
    motivoVisita: '', fechaVisita: hoy, idFacultadDestino: '', horasValidez: 24,
  })
  const [error, setError] = useState('')
  const { data: facData } = useQuery(LISTAR_FACULTADES_QUERY)
  const facultades: Facultad[] = facData?.listarFacultades ?? []
  const [registrar, { loading }] = useMutation(REGISTRAR_INVITADO_MUTATION)
  const set = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.idFacultadDestino) { setError('Selecciona la facultad destino.'); return }
    if (!form.email.trim()) { setError('El email del invitado es obligatorio.'); return }
    try {
      const { data } = await registrar({
        variables: {
          nombres: form.nombres, apellidos: form.apellidos, ci: form.ci,
          email: form.email, celular: form.celular || null,
          motivoVisita: form.motivoVisita, fechaVisita: form.fechaVisita,
          idFacultadDestino: +form.idFacultadDestino,
          horasValidez: form.horasValidez,
        },
      })
      const res = data?.registrarInvitado
      if (!res?.success) { setError(res?.message || 'Error al registrar.'); return }
      onRegistrado({ tokenQr: res.tokenQr, expiraEn: res.expiraEn, message: res.message, emailEnviado: res.emailEnviado, emailDestino: res.emailDestino })
    } catch (e: unknown) { setError((e as Error).message) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex justify-between items-center sticky top-0">
          <h3 className="font-bold text-lg">👥 Registrar Invitado</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-field">Nombres *</label>
              <input value={form.nombres} onChange={e => set('nombres', e.target.value)} className="input-field" required /></div>
            <div><label className="label-field">Apellidos *</label>
              <input value={form.apellidos} onChange={e => set('apellidos', e.target.value)} className="input-field" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-field">Carnet de Identidad *</label>
              <input value={form.ci} onChange={e => set('ci', e.target.value)} className="input-field" required /></div>
            <div><label className="label-field">Celular</label>
              <input value={form.celular} onChange={e => set('celular', e.target.value)} className="input-field" /></div>
          </div>
          <div>
            <label className="label-field">Email * <span className="text-xs font-normal text-gray-400">(se enviará el QR aquí)</span></label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input-field" required placeholder="correo@ejemplo.com" />
          </div>
          <div><label className="label-field">Motivo de la visita *</label>
            <input value={form.motivoVisita} onChange={e => set('motivoVisita', e.target.value)} className="input-field" required placeholder="Ej: Reunión con docente" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-field">Fecha de visita *</label>
              <input type="date" value={form.fechaVisita} onChange={e => set('fechaVisita', e.target.value)} className="input-field" required /></div>
            <div><label className="label-field">Horas de validez</label>
              <input type="number" value={form.horasValidez} onChange={e => set('horasValidez', +e.target.value)} className="input-field" min={1} max={72} /></div>
          </div>
          <div><label className="label-field">Facultad destino *</label>
            <select value={form.idFacultadDestino} onChange={e => set('idFacultadDestino', e.target.value)} className="input-field" required>
              <option value="">Seleccionar facultad...</option>
              {facultades.map(f => <option key={f.idFacultad} value={f.idFacultad}>{f.nombre}</option>)}
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              ⚠️ {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={onClose} type="button" className="flex-1">Cancelar</Button>
            <Button type="submit" loading={loading} className="flex-1">✅ Registrar y enviar QR</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de confirmación de cancelación ──────────────────────────────────────
function ModalConfirmCancelar({
  invitado, onClose, onConfirm, loading,
}: { invitado: Invitado; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-gray-800 text-lg">🚫 Cancelar invitación</h3>
        <p className="text-sm text-gray-600">
          ¿Cancelar la invitación de <strong>{invitado.apellidos} {invitado.nombres}</strong>?
          <br /><span className="text-red-600 text-xs">El código QR quedará inválido inmediatamente.</span>
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">No, conservar</Button>
          <Button onClick={onConfirm} loading={loading} className="flex-1 bg-red-600 hover:bg-red-700">Sí, cancelar</Button>
        </div>
      </div>
    </div>
  )
}

// ── Pantalla de éxito del registro ────────────────────────────────────────────
function PantallaExito({ exito, onNuevo }: { exito: ExitoReg; onNuevo: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    navigator.clipboard.writeText(exito.tokenQr)
    setCopiado(true); setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">✅</span>
          <div>
            <p className="font-bold text-lg text-green-700">Invitado registrado</p>
            <p className="text-sm text-gray-500">⏰ Válido hasta: {new Date(exito.expiraEn).toLocaleString('es-BO')}</p>
          </div>
        </div>
        {exito.emailEnviado ? (
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <span className="text-2xl mt-0.5">📧</span>
            <div>
              <p className="font-semibold text-green-800 text-sm">Email enviado correctamente</p>
              <p className="text-green-700 text-sm mt-0.5">
                El QR fue enviado a <strong>{exito.emailDestino}</strong>. El invitado puede verlo y descargarlo desde su correo.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <span className="text-2xl mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold text-yellow-800 text-sm">No se pudo enviar el email</p>
              <p className="text-yellow-700 text-sm mt-0.5">
                La invitación fue registrada correctamente. Comparte el token de respaldo manualmente con el invitado.
              </p>
            </div>
          </div>
        )}
        <details className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          <summary className="px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none">
            🔑 Ver token de respaldo
          </summary>
          <div className="px-4 pb-4 pt-2 space-y-2">
            <div className="bg-white border border-gray-200 rounded-lg p-3 font-mono text-xs text-gray-700 break-all select-all">{exito.tokenQr}</div>
            <Button onClick={copiar} variant="secondary" size="sm">{copiado ? '✅ ¡Copiado!' : '📋 Copiar'}</Button>
          </div>
        </details>
        <Button onClick={onNuevo} className="w-full">Cerrar</Button>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function RegistrarInvitado() {
  const [mostrarModal, setMostrarModal] = useState(false)
  const [exito, setExito] = useState<ExitoReg | null>(null)
  const [cancelando, setCancelando] = useState<Invitado | null>(null)
  const [msgExito, setMsgExito] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroFecha, setFiltroFecha] = useState('')

  const { data, loading, refetch } = useQuery(MIS_INVITADOS_QUERY, { fetchPolicy: 'network-only' })
  const invitados: Invitado[] = data?.misInvitados ?? []

  const [cancelarMut, { loading: loadingCancelar }] = useMutation(CANCELAR_INVITADO_MUTATION)

  const handleCancelar = async () => {
    if (!cancelando) return
    try {
      const { data } = await cancelarMut({ variables: { idInvitado: cancelando.idInvitado } })
      if (data?.cancelarInvitado?.success) {
        setMsgExito(data.cancelarInvitado.message)
        refetch()
      }
    } catch (e) { console.error(e) }
    setCancelando(null)
  }

  const lista = useMemo(() => {
    return invitados.filter(inv => {
      const estado = estadoInvitado(inv)
      if (filtroEstado !== 'todos' && estado.label.toLowerCase() !== filtroEstado) return false
      if (filtroFecha && inv.fechaVisita !== filtroFecha) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        if (
          !inv.nombres.toLowerCase().includes(q) &&
          !inv.apellidos.toLowerCase().includes(q) &&
          !inv.ci.toLowerCase().includes(q) &&
          !(inv.email?.toLowerCase().includes(q))
        ) return false
      }
      return true
    })
  }, [invitados, busqueda, filtroEstado, filtroFecha])

  return (
    <div className="space-y-5">
      {/* Título + botón registrar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a6b]">👥 Invitados</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona tus invitaciones de acceso</p>
        </div>
        <Button onClick={() => setMostrarModal(true)} size="lg">
          + Registrar Invitado
        </Button>
      </div>

      {/* Mensaje de éxito de cancelación */}
      {msgExito && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex justify-between">
          <span>✅ {msgExito}</span>
          <button onClick={() => setMsgExito('')} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar por nombre, CI o email..."
          className="input-field flex-1 min-w-[200px]"
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="input-field w-36">
          <option value="todos">Todos</option>
          <option value="vigente">Vigente</option>
          <option value="ya ingresó">Ya ingresó</option>
          <option value="expirado">Expirado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <input
          type="date"
          value={filtroFecha}
          onChange={e => setFiltroFecha(e.target.value)}
          className="input-field w-44"
          title="Filtrar por fecha de visita"
        />
        {(busqueda || filtroEstado !== 'todos' || filtroFecha) && (
          <button
            onClick={() => { setBusqueda(''); setFiltroEstado('todos'); setFiltroFecha('') }}
            className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
          >
            ✕ Limpiar filtros
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
          {lista.length} resultado{lista.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla de invitados */}
      {loading ? (
        <div className="flex justify-center mt-12"><LoadingSpinner text="Cargando invitados..." /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl shadow-card">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-base">
            {invitados.length === 0
              ? 'Aún no has registrado ningún invitado.'
              : 'No hay invitados con los filtros aplicados.'}
          </p>
          {invitados.length === 0 && (
            <button onClick={() => setMostrarModal(true)} className="mt-3 text-sm text-[#1a3a6b] hover:underline">
              + Registrar primer invitado
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Invitado', 'CI', 'Email', 'Facultad destino', 'Fecha visita', 'Registrado', 'Estado', 'Acción'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(inv => {
                  const est = estadoInvitado(inv)
                  const puedeCanc = inv.activo && !inv.yaIngreso && new Date(inv.expiraEn) > new Date()
                  return (
                    <tr key={inv.idInvitado} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-800 whitespace-nowrap">{inv.apellidos} {inv.nombres}</p>
                        {inv.celular && <p className="text-xs text-gray-400">{inv.celular}</p>}
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-xs whitespace-nowrap">{inv.ci}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs max-w-[160px] truncate">{inv.email || '—'}</td>
                      <td className="py-3 px-4 text-gray-600 text-xs max-w-[180px] truncate">{inv.facultadDestino.nombre}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{inv.fechaVisita}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(inv.creadoEn).toLocaleDateString('es-BO')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${est.color}`}>
                          ● {est.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {puedeCanc ? (
                          <button
                            onClick={() => setCancelando(inv)}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors whitespace-nowrap"
                          >
                            🚫 Cancelar
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300 italic">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {mostrarModal && (
        <ModalRegistrar
          onClose={() => setMostrarModal(false)}
          onRegistrado={e => { setMostrarModal(false); setExito(e); refetch() }}
        />
      )}

      {exito && (
        <PantallaExito exito={exito} onNuevo={() => setExito(null)} />
      )}

      {cancelando && (
        <ModalConfirmCancelar
          invitado={cancelando}
          onClose={() => setCancelando(null)}
          onConfirm={handleCancelar}
          loading={loadingCancelar}
        />
      )}
    </div>
  )
}
