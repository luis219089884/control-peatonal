import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { useAuth } from '../../context/AuthContext'

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="bg-[#1a3a6b] text-white px-6 py-3 flex items-center justify-between shadow-panel">
      <div className="flex items-center gap-3">
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-lg tracking-wide">UAGRM</span>
          <span className="text-xs text-blue-200">Control Peatonal</span>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{user.apellidos} {user.nombres}</p>
            <Badge tipo={user.tipo_usuario} className="mt-0.5" />
          </div>
          <Button variant="ghost" size="sm" onClick={logout}
            className="text-white border border-white/30 hover:bg-white/10">
            Salir
          </Button>
        </div>
      )}
    </header>
  )
}
