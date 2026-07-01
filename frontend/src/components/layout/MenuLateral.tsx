import { NavLink } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { useAuth } from '../../context/AuthContext'
import { MI_PERFIL_QUERY } from '../../graphql/queries'
import AvatarUsuario from '../ui/AvatarUsuario'
import { seccionesPerfilParaMenu } from '../../utils/perfilMenu'

interface MenuItem { to: string; label: string; icon: string; highlight?: boolean; end?: boolean }

const itemsAdminGestion: MenuItem[] = [
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
]

const itemsCuentaBase: MenuItem[] = [
  { to: '/perfil',             label: 'Datos Personales',   icon: '📋', end: true },
  { to: '/cambiar-password',   label: 'Cambiar Contraseña', icon: '🔒' },
]

const itemsUsuarioOperativos: MenuItem[] = [
  { to: '/generar-qr',         label: 'Generar QR',         icon: '🔑', highlight: true },
  { to: '/registrar-invitado', label: 'Registrar Invitado', icon: '👥' },
]

function buildMenuItems(user: ReturnType<typeof useAuth>['user'], isAdmin: boolean): MenuItem[] {
  const perfilSecciones = seccionesPerfilParaMenu(user).map(({ to, label, icon }) => ({ to, label, icon }))

  if (isAdmin) {
    return [...itemsAdminGestion, ...itemsCuentaBase, ...perfilSecciones]
  }

  const operativos = itemsUsuarioOperativos.filter(item =>
    item.to !== '/registrar-invitado'
    || !!user?.puede_registrar_invitados
    || user?.tipo_usuario === 'docente'
  )

  return [
    itemsCuentaBase[0],
    ...operativos,
    itemsCuentaBase[1],
    ...perfilSecciones,
  ]
}

interface MenuLateralProps {
  onNavigate?: () => void
}

export default function MenuLateral({ onNavigate }: MenuLateralProps) {
  const { user, isAdmin } = useAuth()
  const { data: perfilData } = useQuery(MI_PERFIL_QUERY, { skip: !user })
  const fotoUrl = perfilData?.miPerfil?.fotoUrl
  const items = buildMenuItems(user, isAdmin)

  return (
    <aside className="w-[220px] min-h-full bg-[#0f2347] flex flex-col py-5 flex-shrink-0">
      <div className="px-4 mb-5">
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <AvatarUsuario
            nombres={user?.nombres}
            apellidos={user?.apellidos}
            fotoUrl={fotoUrl}
            size="sm"
            className="mx-auto mb-2 bg-white/20"
          />
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
