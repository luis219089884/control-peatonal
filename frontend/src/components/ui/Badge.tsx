type TipoUsuario =
  | 'estudiante'
  | 'docente'
  | 'administrativo'
  | 'guardia'
  | 'personal_externo'
  | 'invitado'
  | 'logistico'

const colores: Record<TipoUsuario, string> = {
  estudiante:       'bg-blue-100 text-blue-800',
  docente:          'bg-green-100 text-green-800',
  administrativo:   'bg-purple-100 text-purple-800',
  guardia:          'bg-orange-100 text-orange-800',
  personal_externo: 'bg-gray-200 text-gray-700',
  invitado:         'bg-yellow-100 text-yellow-800',
  logistico:        'bg-amber-100 text-amber-900',
}

const etiquetas: Record<TipoUsuario, string> = {
  estudiante:       'Estudiante',
  docente:          'Docente',
  administrativo:   'Administrativo',
  guardia:          'Guardia',
  personal_externo: 'Personal Externo',
  invitado:         'Invitado',
  logistico:        'Logístico',
}

interface BadgeProps {
  tipo: TipoUsuario
  className?: string
}

export default function Badge({ tipo, className = '' }: BadgeProps) {
  const key = (tipo in colores ? tipo : 'personal_externo') as TipoUsuario
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${colores[key]} ${className}`}>
      {etiquetas[key]}
    </span>
  )
}
