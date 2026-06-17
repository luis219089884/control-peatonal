import { useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import { LISTAR_INGRESOS_QUERY, PANEL_PORTON_ADMIN_QUERY } from '../../graphql/queries'
import PanelGuardiaOperativo from '../../components/panel/PanelGuardiaOperativo'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const SESSION_KEY = 'admin_panel_ingreso_id'

interface IngresoOption {
  idIngreso: number
  nombre: string
  sedeNombre: string
  facultadNombre: string
  guardiaNombre?: string | null
}

function SelectorPorton({
  ingresos,
  loading,
  onSelect,
}: {
  ingresos: IngresoOption[]
  loading: boolean
  onSelect: (id: number) => void
}) {
  const [busqueda, setBusqueda] = useState('')

  const agrupados = useMemo(() => {
    const filtrados = ingresos.filter(i => {
      const q = busqueda.toLowerCase()
      return !q
        || i.nombre.toLowerCase().includes(q)
        || i.sedeNombre.toLowerCase().includes(q)
        || i.facultadNombre.toLowerCase().includes(q)
    })
    const map: Record<string, IngresoOption[]> = {}
    for (const ing of filtrados) {
      const sede = ing.sedeNombre || 'Sin sede'
      if (!map[sede]) map[sede] = []
      map[sede].push(ing)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [ingresos, busqueda])

  if (loading) {
    return <div className="flex justify-center py-20"><LoadingSpinner text="Cargando portones..." /></div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a6b]">👮 Panel Guardia</h1>
        <p className="text-sm text-gray-500 mt-1">
          Selecciona el portón en el que vas a operar el control peatonal.
        </p>
      </div>

      <input
        type="search"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por portón, sede o facultad..."
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-[#2a5298] focus:ring-1 focus:ring-[#2a5298]"
      />

      {agrupados.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-center text-gray-400">
          No hay portones activos que coincidan con la búsqueda.
        </div>
      ) : (
        agrupados.map(([sede, items]) => (
          <div key={sede} className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 bg-[#0f2347] text-white text-sm font-semibold">
              🏙️ {sede}
            </div>
            <ul className="divide-y divide-gray-100">
              {items.map(ing => (
                <li key={ing.idIngreso}>
                  <button
                    type="button"
                    onClick={() => onSelect(ing.idIngreso)}
                    className="w-full text-left px-4 py-4 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">🚪 {ing.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{ing.facultadNombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ing.guardiaNombre
                          ? `Guardia: ${ing.guardiaNombre}`
                          : 'Sin guardia asignado — puedes operar igual'}
                      </p>
                    </div>
                    <span className="text-[#2a5298] text-sm font-medium shrink-0">Operar →</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}

export default function PanelGuardiaAdmin() {
  const [idIngreso, setIdIngreso] = useState<number | null>(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (!stored) return null
    const n = Number(stored)
    return Number.isFinite(n) && n > 0 ? n : null
  })

  const { data: ingData, loading: loadingIngresos } = useQuery(LISTAR_INGRESOS_QUERY, {
    variables: { soloActivos: true },
  })

  const ingresos: IngresoOption[] = ingData?.listarIngresos ?? []

  const { data, loading, refetch, error } = useQuery(PANEL_PORTON_ADMIN_QUERY, {
    variables: { idIngreso: idIngreso! },
    skip: !idIngreso,
    fetchPolicy: 'network-only',
  })

  const seleccionarPorton = (id: number) => {
    setIdIngreso(id)
    sessionStorage.setItem(SESSION_KEY, String(id))
  }

  const cambiarPorton = () => {
    setIdIngreso(null)
    sessionStorage.removeItem(SESSION_KEY)
  }

  if (!idIngreso) {
    return (
      <SelectorPorton
        ingresos={ingresos}
        loading={loadingIngresos}
        onSelect={seleccionarPorton}
      />
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-card p-6 text-center space-y-3">
        <p className="text-red-600 text-sm">{(error as Error).message}</p>
        <button type="button" onClick={cambiarPorton}
          className="px-4 py-2 text-sm rounded-lg bg-[#1a3a6b] text-white hover:bg-[#2a5298]">
          Elegir otro portón
        </button>
      </div>
    )
  }

  return (
    <PanelGuardiaOperativo
      modo="admin"
      panel={data?.panelPortonAdmin}
      loadingPanel={loading}
      idIngreso={idIngreso}
      onRefetch={refetch}
      onCambiarPorton={cambiarPorton}
    />
  )
}
