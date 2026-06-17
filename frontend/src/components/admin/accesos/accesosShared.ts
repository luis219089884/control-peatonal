export const TIPOS_PERSONA = [
  'estudiante',
  'docente',
  'administrativo',
  'personal_externo',
  'invitado',
  'logistico',
] as const

export const METODOS = ['qr', 'manual', 'logistico'] as const

export const ETIQUETAS_TIPO: Record<string, string> = {
  estudiante: 'Estudiante',
  docente: 'Docente',
  administrativo: 'Administrativo',
  personal_externo: 'Personal externo',
  invitado: 'Invitado',
  logistico: 'Logístico',
}

export const ETIQUETAS_METODO: Record<string, string> = {
  qr: 'QR digital',
  manual: 'Registro manual',
  logistico: 'Acceso logístico',
}

export interface RegistroAcceso {
  idRegistro: number
  nombreCompleto: string
  tipoPersona: string
  tipoMovimiento?: string
  metodo?: string
  sedePertenece?: string | null
  facultadPertenece?: string | null
  carreraPertenece?: string | null
  accesoPermitido: boolean
  motivoRechazo?: string | null
  fechaHora: string
  ingreso: { nombre: string; facultad?: { nombre: string } }
  guardia?: { turno: string; usuario: { nombres: string; apellidos: string } } | null
}

export interface FiltrosAccesosState {
  fechaInicio: string
  fechaFin: string
  idSede: number
  idFacultad: number
  tipoPersona: string
  tipoMovimiento: string
  metodo: string
  buscar: string
}

export function calcularResumen(registros: RegistroAcceso[]) {
  const entradas = registros.filter(r => r.tipoMovimiento === 'entrada' && r.accesoPermitido).length
  const salidas = registros.filter(r => r.tipoMovimiento === 'salida' && r.accesoPermitido).length
  const rechazados = registros.filter(r => !r.accesoPermitido).length
  const permitidos = registros.filter(r => r.accesoPermitido).length
  return {
    total: registros.length,
    entradas,
    salidas,
    rechazados,
    permitidos,
    porcPermitido: registros.length > 0 ? Math.round((permitidos / registros.length) * 100) : 0,
  }
}

export function agruparConteo(
  registros: RegistroAcceso[],
  selector: (r: RegistroAcceso) => string,
): [string, number][] {
  const mapa: Record<string, number> = {}
  registros.forEach(r => {
    const clave = selector(r) || 'Sin dato'
    mapa[clave] = (mapa[clave] || 0) + 1
  })
  return Object.entries(mapa).sort(([, a], [, b]) => b - a)
}

export function filtrarBusqueda(registros: RegistroAcceso[], buscar: string): RegistroAcceso[] {
  const q = buscar.trim().toLowerCase()
  if (!q) return registros
  return registros.filter(r =>
    r.nombreCompleto.toLowerCase().includes(q) ||
    (r.facultadPertenece ?? '').toLowerCase().includes(q) ||
    (r.sedePertenece ?? '').toLowerCase().includes(q),
  )
}

export function registroAFilaPdf(r: RegistroAcceso) {
  return {
    fechaHora: new Date(r.fechaHora).toLocaleString('es-BO', {
      timeZone: 'America/La_Paz',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    nombre: r.nombreCompleto,
    tipo: ETIQUETAS_TIPO[r.tipoPersona] ?? r.tipoPersona,
    movimiento: r.tipoMovimiento === 'entrada' ? 'Entrada' : r.tipoMovimiento === 'salida' ? 'Salida' : '—',
    metodo: ETIQUETAS_METODO[r.metodo ?? ''] ?? (r.metodo ?? '—'),
    sede: r.sedePertenece ?? '—',
    facultad: r.facultadPertenece ?? '—',
    porton: r.ingreso?.nombre ?? '—',
    guardia: r.guardia
      ? `${r.guardia.usuario.apellidos} ${r.guardia.usuario.nombres}`
      : '—',
    resultado: r.accesoPermitido ? 'Permitido' : `Rechazado${r.motivoRechazo ? `: ${r.motivoRechazo}` : ''}`,
  }
}
