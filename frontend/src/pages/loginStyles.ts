export const LOGO_LOCAL = '/images/logo-uagrm-horizontal.png'
export const LOGO_REMOTO = 'https://www.uagrm.edu.bo/img/logo-88x707-gray.png'

export const LOGIN_TEXT_SHADOW =
  '[text-shadow:0_1px_8px_rgba(0,0,0,0.95),0_2px_18px_rgba(0,0,0,0.75)]'
export const LOGIN_TITLE_SHADOW =
  '[text-shadow:0_2px_14px_rgba(0,0,0,1),0_0_32px_rgba(0,0,0,0.85)]'

export const FORM_SHELL = 'rounded-md overflow-hidden border border-white/30 bg-transparent'
export const FORM_HEADER = 'border-b border-white/25 py-2.5 text-center bg-transparent'
export const FORM_HEADER_TEXT = `text-sm text-white font-semibold ${LOGIN_TEXT_SHADOW}`
export const INPUT_CLASS =
  `w-full rounded px-4 py-3 text-sm font-medium text-white bg-transparent border border-white/35
  placeholder:text-gray-200 placeholder:font-normal ${LOGIN_TEXT_SHADOW}
  focus:outline-none focus:border-cyan-300/80 focus:ring-1 focus:ring-cyan-400/50 transition-all duration-200`
export const LINK_CLASS = `text-sm text-white font-medium hover:text-cyan-100 hover:underline ${LOGIN_TEXT_SHADOW}`

export const TIPOS_RECUPERACION = [
  { value: 'estudiante', label: 'Estudiante' },
  { value: 'docente', label: 'Docente' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'personal_externo', label: 'Personal externo' },
] as const

export type TipoRecuperacion = (typeof TIPOS_RECUPERACION)[number]['value']
