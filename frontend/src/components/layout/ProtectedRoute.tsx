import { useState } from 'react'
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
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (roles && user && !roles.includes(user.rol)) {
    if (user.rol === 'admin')   return <Navigate to="/admin" replace />
    if (user.rol === 'guardia') return <Navigate to="/panel-guardia" replace />
    return <Navigate to="/perfil" replace />
  }

  const mostrarMenu = !sinMenu && user?.rol !== 'guardia'

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7fa]">
      {/* Header — con botón ☰ en móvil */}
      <div className="relative">
        <Header />
        {mostrarMenu && (
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setDrawerOpen(true)}
            className="md:hidden absolute left-4 top-1/2 -translate-y-1/2
              text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Menú lateral — visible solo en md+ */}
        {mostrarMenu && (
          <div className="hidden md:block flex-shrink-0">
            <MenuLateral />
          </div>
        )}

        {/* Drawer overlay en móvil */}
        {mostrarMenu && drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Drawer deslizable en móvil */}
        {mostrarMenu && (
          <div className={`fixed top-0 left-0 h-full z-50 md:hidden transition-transform duration-300 ease-in-out
            ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="relative h-full">
              {/* Botón cerrar */}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute top-3 right-3 z-10 text-white/60 hover:text-white
                  bg-white/10 rounded-lg p-1.5 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <MenuLateral onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <main className={`flex-1 overflow-auto fade-in ${mostrarMenu ? 'p-4 md:p-6' : 'p-0'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
