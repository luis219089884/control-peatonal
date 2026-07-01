import { useRef, useState } from 'react'
import { useMutation } from '@apollo/client'
import { ACTUALIZAR_FOTO_PERFIL_MUTATION } from '../../graphql/mutations'
import { MI_PERFIL_QUERY } from '../../graphql/queries'
import AvatarUsuario from '../ui/AvatarUsuario'
import { leerImagenComoDataUrl, validarArchivoImagen } from '../../utils/imageFile'

interface SubirFotoPerfilProps {
  nombres?: string | null
  apellidos?: string | null
  fotoUrl?: string | null
  size?: 'md' | 'lg'
}

export default function SubirFotoPerfil({
  nombres,
  apellidos,
  fotoUrl,
  size = 'md',
}: SubirFotoPerfilProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  const [actualizar, { loading }] = useMutation(ACTUALIZAR_FOTO_PERFIL_MUTATION, {
    refetchQueries: [{ query: MI_PERFIL_QUERY }],
  })

  const handleFile = async (file: File) => {
    setError('')
    const err = validarArchivoImagen(file)
    if (err) {
      setError(err)
      return
    }
    try {
      const dataUrl = await leerImagenComoDataUrl(file)
      setPreview(dataUrl)
      const { data } = await actualizar({ variables: { imagenBase64: dataUrl } })
      const res = data?.actualizarFotoPerfil
      if (!res?.ok) {
        setError(res?.message || 'No se pudo guardar la foto.')
        setPreview(null)
        return
      }
      setPreview(null)
    } catch (e: unknown) {
      setError((e as Error).message)
      setPreview(null)
    }
  }

  return (
    <div className="flex flex-col items-center sm:items-start gap-2">
      <div className="relative group">
        <AvatarUsuario
          nombres={nombres}
          apellidos={apellidos}
          fotoUrl={preview || fotoUrl}
          size={size}
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45
            text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity
            disabled:cursor-wait"
          aria-label="Cambiar foto de perfil"
        >
          {loading ? 'Guardando...' : '📷 Cambiar'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void handleFile(file)
          }}
        />
      </div>
      <p className="text-xs text-gray-400">JPG o PNG, máx. 2 MB</p>
      {error && (
        <p className="text-xs text-red-600 max-w-[220px]">{error}</p>
      )}
    </div>
  )
}
