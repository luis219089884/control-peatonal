import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { REGISTRAR_INVITADO_MUTATION } from '../graphql/mutations'
import { LISTAR_FACULTADES_QUERY } from '../graphql/queries'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

interface Exito { tokenQr: string; expiraEn: string; message: string }
interface Facultad { idFacultad: number; nombre: string }

const hoy = new Date().toISOString().slice(0, 10)

export default function RegistrarInvitado() {
  const [form, setForm] = useState({
    nombres: '', apellidos: '', ci: '', celular: '', email: '',
    motivoVisita: '', fechaVisita: hoy, idFacultadDestino: '', horasValidez: 24,
  })
  const [exito, setExito] = useState<Exito | null>(null)
  const [error, setError]   = useState('')
  const [copiado, setCopiado] = useState(false)

  const { data: facData, loading: loadingFac } = useQuery(LISTAR_FACULTADES_QUERY)
  const facultades: Facultad[] = facData?.listarFacultades ?? []

  const [registrar, { loading }] = useMutation(REGISTRAR_INVITADO_MUTATION)

  const set = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.idFacultadDestino) { setError('Selecciona la facultad destino.'); return }
    try {
      const { data } = await registrar({
        variables: {
          nombres: form.nombres, apellidos: form.apellidos, ci: form.ci,
          celular: form.celular || null, email: form.email || null,
          motivoVisita: form.motivoVisita, fechaVisita: form.fechaVisita,
          idFacultadDestino: +form.idFacultadDestino,
          horasValidez: form.horasValidez,
        },
      })
      const res = data?.registrarInvitado
      if (!res?.success) { setError(res?.message || 'Error al registrar.'); return }
      setExito({ tokenQr: res.tokenQr, expiraEn: res.expiraEn, message: res.message })
    } catch (e: unknown) { setError((e as Error).message) }
  }

  const copiar = () => {
    if (!exito) return
    navigator.clipboard.writeText(exito.tokenQr)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const nuevo = () => {
    setExito(null)
    setError('')
    setForm({ nombres:'', apellidos:'', ci:'', celular:'', email:'',
      motivoVisita:'', fechaVisita: hoy, idFacultadDestino:'', horasValidez: 24 })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-[#1a3a6b]">👥 Registrar Invitado</h1>

      {exito ? (
        /* Pantalla de éxito */
        <div className="bg-white rounded-xl shadow-card p-6 space-y-5">
          <div className="flex items-center gap-3 text-green-700">
            <span className="text-4xl">✅</span>
            <div>
              <p className="font-bold text-lg">Invitado registrado correctamente</p>
              <p className="text-sm text-green-600">{exito.message}</p>
            </div>
          </div>

          <div className="bg-[#f0f4f8] border border-[#d0d7e0] rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-600">Token QR del invitado:</p>
            <div className="bg-white border border-gray-200 rounded-lg p-3 font-mono text-xs text-gray-700 break-all select-all">
              {exito.tokenQr}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span>⏰ Expira: {new Date(exito.expiraEn).toLocaleString('es-BO')}</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">📋 Instrucciones</p>
            <p>Comparte este código con tu invitado. Deberá mostrarlo al guardia al momento de ingresar. El token es de un solo uso.</p>
          </div>

          <div className="flex gap-3">
            <Button onClick={copiar} variant="secondary" className="flex-1">
              {copiado ? '✅ ¡Copiado!' : '📋 Copiar token'}
            </Button>
            <Button onClick={nuevo} className="flex-1">
              👥 Registrar otro invitado
            </Button>
          </div>
        </div>
      ) : (
        /* Formulario */
        <div className="bg-white rounded-xl shadow-card p-6">
          {loadingFac ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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

              <div><label className="label-field">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input-field" /></div>

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
                  <span>⚠️</span><span>{error}</span>
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg">
                👥 Registrar Invitado
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
