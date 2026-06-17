export const TZ_BO = 'America/La_Paz'

export function fechaHoyBolivia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ_BO })
}

export function formatearFechaHoraBo(iso: string): string {
  return new Date(iso).toLocaleString('es-BO', {
    timeZone: TZ_BO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatearFechaBo(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  if (!y || !m || !d) return fecha
  return `${d}/${m}/${y}`
}

export function fechaHoraGeneracionBo(): string {
  return new Date().toLocaleString('es-BO', {
    timeZone: TZ_BO,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
