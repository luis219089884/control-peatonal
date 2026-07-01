export const MIN_PASSWORD_LENGTH = 8

export const PASSWORD_POLICY_HINT =
  'Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial.'

export function validarPassword(password: string): string | null {
  if (!password) return 'La contraseña es requerida.'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (password.length > 128) return 'La contraseña es demasiado larga.'
  if (!/[A-Z]/.test(password)) return 'Debe incluir al menos una letra mayúscula.'
  if (!/[a-z]/.test(password)) return 'Debe incluir al menos una letra minúscula.'
  if (!/\d/.test(password)) return 'Debe incluir al menos un número.'
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return 'Debe incluir al menos un carácter especial.'
  }
  return null
}

export function passwordCumplePolitica(password: string): boolean {
  return validarPassword(password) === null
}
