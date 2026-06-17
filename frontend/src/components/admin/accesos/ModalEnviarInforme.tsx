import { useState } from 'react'
import { useMutation } from '@apollo/client'
import { ENVIAR_INFORME_ACCESOS_MUTATION } from '../../../graphql/mutations'
import { generarPdfAccesosBase64, type OpcionesPdfAccesos } from '../../../utils/exportAccesosPdf'
import { formatearFechaBo } from '../../../utils/fechaBolivia'
import Button from '../../ui/Button'

interface Props {
  opcionesPdf: OpcionesPdfAccesos
  tipoInforme: 'consulta' | 'informe'
  onClose: () => void
  onEnviado: (mensaje: string, ok: boolean) => void
}

export default function ModalEnviarInforme({
  opcionesPdf,
  tipoInforme,
  onClose,
  onEnviado,
}: Props) {
  const periodoTxt = `${formatearFechaBo(opcionesPdf.fechaInicio)} — ${formatearFechaBo(opcionesPdf.fechaFin)}`
  const [emails, setEmails] = useState('')
  const [asunto, setAsunto] = useState(
    tipoInforme === 'informe'
      ? `Informe de accesos UAGRM — ${periodoTxt}`
      : `Bitácora de accesos UAGRM — ${periodoTxt}`,
  )
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enviar, { loading }] = useMutation(ENVIAR_INFORME_ACCESOS_MUTATION)

  const handleEnviar = async () => {
    setError('')
    const lista = emails.split(',').map(e => e.trim()).filter(Boolean)
    if (lista.length === 0) {
      setError('Indica al menos un correo destinatario.')
      return
    }
    const invalido = lista.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    if (invalido) {
      setError(`Correo inválido: ${invalido}`)
      return
    }
    try {
      const { base64, nombreArchivo } = await generarPdfAccesosBase64(opcionesPdf)
      const { data } = await enviar({
        variables: {
          emails: lista.join(', '),
          pdfBase64: base64,
          nombreArchivo,
          periodoInicio: formatearFechaBo(opcionesPdf.fechaInicio),
          periodoFin: formatearFechaBo(opcionesPdf.fechaFin),
          asunto: asunto.trim() || null,
          mensaje: mensaje.trim() || null,
          tipoInforme,
        },
      })
      const res = data?.enviarInformeAccesos
      if (res?.success) {
        onEnviado(res.message, true)
        onClose()
      } else {
        setError(res?.message || 'No se pudo enviar el correo.')
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
          <h3 className="font-bold text-lg">Enviar informe por correo</h3>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Se adjuntará el PDF institucional del periodo <strong>{periodoTxt}</strong>.
          </p>
          <div>
            <label className="label-field">Destinatario(s) *</label>
            <input
              value={emails}
              onChange={e => setEmails(e.target.value)}
              className="input-field"
              placeholder="correo1@uagrm.edu.bo, correo2@uagrm.edu.bo"
            />
            <p className="text-xs text-gray-400 mt-1">Separa varios correos con coma.</p>
          </div>
          <div>
            <label className="label-field">Asunto</label>
            <input value={asunto} onChange={e => setAsunto(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-field">Mensaje (opcional)</label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={3}
              className="input-field resize-none"
              placeholder="Ej: Adjunto informe de accesos del periodo solicitado."
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleEnviar} loading={loading}>
            Enviar PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
