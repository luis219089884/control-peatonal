import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface MenuItem { to: string; label: string; icon: string; highlight?: boolean; end?: boolean }

const itemsAdmin: MenuItem[] = [
  { to: '/admin',                              label: 'Dashboard',          icon: '📊', end: true },
  { to: '/admin/accesos',                      label: 'Accesos',            icon: '📋' },
  { to: '/admin/guardias',                     label: 'Guardias',           icon: '👮' },
  { to: '/admin/portones',                     label: 'Portones',           icon: '🚪' },
  { to: '/admin/panel-guardia',                label: 'Panel Guardia',      icon: '👮' },
  { to: '/admin/usuarios/estudiantes',         label: 'Estudiantes',        icon: '🎓' },
  { to: '/admin/usuarios/docentes',            label: 'Docentes',           icon: '👨‍🏫' },
  { to: '/admin/usuarios/administrativos',     label: 'Administrativos',    icon: '🏢' },
  { to: '/admin/usuarios/personal-externo',    label: 'Personal Externo',   icon: '🔧' },
  { to: '/admin/empresas',                     label: 'Empresas',           icon: '🏭' },
  { to: '/admin/facultades',                   label: 'Facultades',         icon: '🏛️' },
  { to: '/admin/reportes',                     label: 'Informes',           icon: '📈' },
  { to: '/admin/dtic',                         label: 'Sync DTIC',          icon: '🔄' },
  { to: '/perfil',                             label: 'Mi Perfil',          icon: '👤' },
]

const itemsUsuario: MenuItem[] = [
  { to: '/perfil',               label: 'Datos Personales',   icon: '📋' },
  { to: '/generar-qr',           label: 'Generar QR',         icon: '🔑', highlight: true },
  { to: '/registrar-invitado',   label: 'Registrar Invitado', icon: '👥' },
  { to: '/cambiar-password',     label: 'Cambiar Contraseña', icon: '🔒' },
]

interface MenuLateralProps {
  onNavigate?: () => void
}

export default function MenuLateral({ onNavigate }: MenuLateralProps) {
  const { user, isAdmin } = useAuth()

  const items = isAdmin
    ? itemsAdmin
    : itemsUsuario.filter(item =>
        item.to !== '/registrar-invitado'
        || !!user?.puede_registrar_invitados
        || user?.tipo_usuario === 'docente'
      )

  return (
    <aside className="w-[220px] min-h-full bg-[#0f2347] flex flex-col py-5 flex-shrink-0">
      {/* Avatar usuario */}
      <div className="px-4 mb-5">
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center
            text-white font-bold text-sm mx-auto mb-2">
            {(user?.nombres?.[0] || '') + (user?.apellidos?.[0] || '')}
          </div>
          <p className="text-white text-xs font-semibold leading-tight truncate">
            {user?.nombres?.split(' ')[0]} {user?.apellidos?.split(' ')[0]}
          </p>
          <p className="text-blue-300 text-xs mt-0.5 capitalize">
            {user?.tipo_usuario?.replace('_', ' ')}
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {items.map(({ to, label, icon, highlight, end }) => (
          <NavLink key={to + label} to={to} end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
               transition-all duration-200
              ${isActive
                ? 'bg-[#2a5298] text-white shadow-sm'
                : highlight
                  ? 'text-yellow-300 hover:bg-[#1a3a6b] hover:text-yellow-200'
                  : 'text-blue-200 hover:bg-[#1a3a6b] hover:text-white'
              }`}
          >
            <span className="text-base">{icon}</span>
            <span className="leading-tight">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 pt-4 border-t border-white/10">
        <p className="text-xs text-blue-500 text-center">© {new Date().getFullYear()} UAGRM</p>
      </div>
    </aside>
  )
}
