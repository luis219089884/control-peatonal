import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Header from './Header'
import MenuLateral from './MenuLateral'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: string[]
  sinMenu?: boolean
}

export default function ProtectedRoute({ children, roles, sinMenu = false }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (roles && user && !roles.includes(user.rol)) {
    if (user.rol === 'admin')   return <Navigate to="/admin" replace />
    if (user.rol === 'guardia') return <Navigate to="/panel-guardia" replace />
    return <Navigate to="/perfil" replace />
  }

  const mostrarMenu = !sinMenu && user?.rol !== 'guardia'

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7fa]">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {mostrarMenu && <MenuLateral />}
        <main className={`flex-1 overflow-auto fade-in ${mostrarMenu ? 'p-6' : 'p-0'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
