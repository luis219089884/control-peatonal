type TipoUsuario =
  | 'estudiante'
  | 'docente'
  | 'administrativo'
  | 'guardia'
  | 'personal_externo'
  | 'invitado'

const colores: Record<TipoUsuario, string> = {
  estudiante:       'bg-blue-100 text-blue-800',
  docente:          'bg-green-100 text-green-800',
  administrativo:   'bg-purple-100 text-purple-800',
  guardia:          'bg-orange-100 text-orange-800',
  personal_externo: 'bg-gray-200 text-gray-700',
  invitado:         'bg-yellow-100 text-yellow-800',
}

const etiquetas: Record<TipoUsuario, string> = {
  estudiante:       'Estudiante',
  docente:          'Docente',
  administrativo:   'Administrativo',
  guardia:          'Guardia',
  personal_externo: 'Personal Externo',
  invitado:         'Invitado',
}

interface BadgeProps {
  tipo: TipoUsuario
  className?: string
}

export default function Badge({ tipo, className = '' }: BadgeProps) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${colores[tipo]} ${className}`}>
      {etiquetas[tipo]}
    </span>
  )
}
