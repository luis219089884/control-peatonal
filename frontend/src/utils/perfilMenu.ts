import type { AuthUser } from '../context/AuthContext'

export type SeccionPerfil = 'datos' | 'rostro' | 'facultad' | 'ingresos' | 'seguridad'

export interface PerfilMenuItem {
  to: string
  label: string
  icon: string
  seccion: SeccionPerfil
}

const SECCIONES: Record<Exclude<SeccionPerfil, 'datos'>, PerfilMenuItem> = {
  rostro:    { to: '/perfil/rostro',    label: 'Registro de Rostro',  icon: '🙂', seccion: 'rostro' },
  facultad:  { to: '/perfil/facultad',  label: 'Mi Facultad/Carrera', icon: '🏛️', seccion: 'facultad' },
  ingresos:  { to: '/perfil/ingresos',  label: 'Mis Ingresos',        icon: '📅', seccion: 'ingresos' },
  seguridad: { to: '/perfil/seguridad', label: 'Seguridad',           icon: '🔐', seccion: 'seguridad' },
}

/** Secciones de perfil visibles en el menú azul (debajo de Cambiar contraseña). */
export function seccionesPerfilParaMenu(user: AuthUser | null): PerfilMenuItem[] {
  if (!user) return []

  if (user.rol === 'admin') {
    return [SECCIONES.seguridad]
  }

  const items: PerfilMenuItem[] = []

  if (user.tipo_usuario !== 'guardia') {
    items.push(SECCIONES.rostro)
  }

  if (user.tipo_usuario === 'estudiante' || user.tipo_usuario === 'docente') {
    items.push(SECCIONES.facultad)
  }

  if (
    user.tipo_usuario === 'estudiante'
    || user.tipo_usuario === 'docente'
    || user.tipo_usuario === 'administrativo'
    || user.tipo_usuario === 'personal_externo'
  ) {
    items.push(SECCIONES.ingresos)
  }

  items.push(SECCIONES.seguridad)
  return items
}

export function seccionPerfilPermitida(seccion: SeccionPerfil, user: AuthUser | null): boolean {
  if (!user) return false
  if (seccion === 'datos') return true
  return seccionesPerfilParaMenu(user).some(s => s.seccion === seccion)
}
