import { resolveMediaUrl } from '../../utils/mediaUrl'

type AvatarSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: 'w-10 h-10 text-sm rounded-full',
  md: 'w-20 h-20 text-2xl rounded-xl',
  lg: 'w-24 h-24 text-3xl rounded-xl',
}

interface AvatarUsuarioProps {
  nombres?: string | null
  apellidos?: string | null
  fotoUrl?: string | null
  size?: AvatarSize
  className?: string
}

export default function AvatarUsuario({
  nombres,
  apellidos,
  fotoUrl,
  size = 'sm',
  className = '',
}: AvatarUsuarioProps) {
  const iniciales = `${nombres?.[0] || ''}${apellidos?.[0] || ''}`.toUpperCase() || '?'
  const src = resolveMediaUrl(fotoUrl)
  const base = `${SIZE_CLASS[size]} flex items-center justify-center flex-shrink-0 overflow-hidden font-bold`

  if (src) {
    return (
      <img
        src={src}
        alt={`${nombres || ''} ${apellidos || ''}`.trim() || 'Foto de perfil'}
        className={`${base} object-cover bg-[#1a3a6b] ${className}`}
      />
    )
  }

  return (
    <div className={`${base} bg-[#1a3a6b] text-white shadow-md ${className}`}>
      {iniciales}
    </div>
  )
}
