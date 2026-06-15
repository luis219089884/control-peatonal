import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ApolloProvider } from '@apollo/client'
import { client } from './lib/apolloClient'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import Perfil from './pages/Perfil'
import GenerarQR from './pages/GenerarQR'
import PanelGuardia from './pages/PanelGuardia'
import RegistrarInvitado from './pages/RegistrarInvitado'
import Dashboard from './pages/admin/Dashboard'
import { UsuariosLayout, UsuariosRedirect, UsuariosSeccion } from './pages/admin/Usuarios'
import Empresas from './pages/admin/Empresas'
import Facultades from './pages/admin/Facultades'
import Reportes from './pages/admin/Reportes'
import Guardias from './pages/admin/Guardias'
import Portones from './pages/admin/Portones'
import Accesos from './pages/admin/Accesos'
import Sincronizacion from './pages/admin/Sincronizacion'

function RootRedirect() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.rol === 'admin')   return <Navigate to="/admin" replace />
  if (user?.rol === 'guardia') return <Navigate to="/panel-guardia" replace />
  return <Navigate to="/perfil" replace />
}

export default function App() {
  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/"      element={<RootRedirect />} />

            {/* Rutas usuario */}
            <Route path="/perfil" element={
              <ProtectedRoute roles={['usuario','admin']}>
                <Perfil />
              </ProtectedRoute>
            } />
            <Route path="/generar-qr" element={
              <ProtectedRoute roles={['usuario']}>
                <GenerarQR />
              </ProtectedRoute>
            } />
            <Route path="/registrar-invitado" element={
              <ProtectedRoute roles={['usuario']}>
                <RegistrarInvitado />
              </ProtectedRoute>
            } />

            {/* Guardia */}
            <Route path="/panel-guardia" element={
              <ProtectedRoute roles={['guardia']}>
                <PanelGuardia />
              </ProtectedRoute>
            } />

            {/* Admin */}
            <Route path="/admin" element={
              <ProtectedRoute roles={['admin']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/usuarios" element={
              <ProtectedRoute roles={['admin']}>
                <UsuariosLayout />
              </ProtectedRoute>
            }>
              <Route index element={<UsuariosRedirect />} />
              <Route path=":seccion" element={<UsuariosSeccion />} />
            </Route>
            <Route path="/admin/empresas" element={
              <ProtectedRoute roles={['admin']}>
                <Empresas />
              </ProtectedRoute>
            } />
            <Route path="/admin/facultades" element={
              <ProtectedRoute roles={['admin']}>
                <Facultades />
              </ProtectedRoute>
            } />
            <Route path="/admin/reportes" element={
              <ProtectedRoute roles={['admin']}>
                <Reportes />
              </ProtectedRoute>
            } />
            <Route path="/admin/guardias" element={
              <ProtectedRoute roles={['admin']}>
                <Guardias />
              </ProtectedRoute>
            } />
            <Route path="/admin/portones" element={
              <ProtectedRoute roles={['admin']}>
                <Portones />
              </ProtectedRoute>
            } />
            <Route path="/admin/accesos" element={
              <ProtectedRoute roles={['admin']}>
                <Accesos />
              </ProtectedRoute>
            } />

            <Route path="/admin/dtic" element={
              <ProtectedRoute roles={['admin']}>
                <Sincronizacion />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ApolloProvider>
  )
}
