import { calcularResumen } from './accesosShared'

interface Props {
  total: number
  entradas: number
  salidas: number
  rechazados: number
  compacto?: boolean
}

export default function TarjetasResumen({ total, entradas, salidas, rechazados, compacto }: Props) {
  const items = [
    { label: 'Total registros', val: total, color: 'text-[#1a3a6b]', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Entradas', val: entradas, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100' },
    { label: 'Salidas', val: salidas, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Rechazados', val: rechazados, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' },
  ]

  return (
    <div className={`grid ${compacto ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'} gap-3`}>
      {items.map(s => (
        <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-4 text-center`}>
          <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
          <p className="text-xs text-gray-500 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

export function TarjetasResumenFromRegistros({
  registros,
  compacto,
}: {
  registros: { tipoMovimiento?: string; accesoPermitido: boolean }[]
  compacto?: boolean
}) {
  const r = calcularResumen(registros as Parameters<typeof calcularResumen>[0])
  return (
    <TarjetasResumen
      total={r.total}
      entradas={r.entradas}
      salidas={r.salidas}
      rechazados={r.rechazados}
      compacto={compacto}
    />
  )
}
