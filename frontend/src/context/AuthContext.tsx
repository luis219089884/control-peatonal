import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export interface AuthUser {
  id_usuario: number
  tipo_usuario: 'estudiante' | 'docente' | 'administrativo' | 'guardia' | 'personal_externo'
  rol: 'admin' | 'guardia' | 'usuario'
  nombres: string
  apellidos: string
  token: string
  puede_registrar_invitados?: boolean
}

interface AuthContextType {
  user: AuthUser | null
  login: (token: string, userData: Omit<AuthUser, 'token'>) => void
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
  isGuardia: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('uagrm_token')
    if (!token) return
    const payload = decodeJwtPayload(token)
    if (!payload) { localStorage.removeItem('uagrm_token'); return }
    const exp = payload['exp'] as number
    if (exp && Date.now() / 1000 > exp) {
      localStorage.removeItem('uagrm_token')
      return
    }
    setUser({
      id_usuario:                payload['id_usuario'] as number,
      tipo_usuario:              payload['tipo_usuario'] as AuthUser['tipo_usuario'],
      rol:                       payload['rol'] as AuthUser['rol'],
      nombres:                   payload['nombres'] as string,
      apellidos:                 payload['apellidos'] as string,
      puede_registrar_invitados: payload['puede_registrar_invitados'] as boolean | undefined,
      token,
    })
  }, [])

  const login = (token: string, userData: Omit<AuthUser, 'token'>) => {
    localStorage.setItem('uagrm_token', token)
    const payload = decodeJwtPayload(token)
    setUser({
      ...userData,
      id_usuario: (payload?.['id_usuario'] as number) ?? userData.id_usuario,
      puede_registrar_invitados: payload?.['puede_registrar_invitados'] as boolean | undefined,
      token,
    })
  }

  const logout = () => {
    localStorage.removeItem('uagrm_token')
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isAdmin:   user?.rol === 'admin',
      isGuardia: user?.rol === 'guardia',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
