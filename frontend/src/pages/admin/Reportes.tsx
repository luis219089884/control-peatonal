import { useState } from 'react'
import { useLazyQuery } from '@apollo/client'
import { LISTAR_REGISTROS_QUERY, LISTAR_FACULTADES_QUERY } from '../../graphql/queries'
import { useQuery } from '@apollo/client'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface Registro {
  idRegistro: number; nombreCompleto: string; tipoPersona: string;
  sedePertenece?: string; facultadPertenece?: string; carreraPertenece?: string;
  accesoPermitido: boolean; motivoRechazo?: string; fechaHora: string;
  ingreso: { nombre: string; facultad: { nombre: string } };
  guardia?: { turno: string; usuario: { nombres: string; apellidos: string } };
}

interface Facultad { idFacultad: number; nombre: string }

const TIPOS = ['estudiante','docente','administrativo','personal_externo','invitado','guardia']

function exportarCSV(registros: Registro[]) {
  const encabezados = ['Fecha/Hora','Nombre','Tipo','Sede Origen','Facultad Origen','Carrera','Portón','Guardia','Resultado']
  const filas = registros.map(r => [
    new Date(r.fechaHora).toLocaleString('es-BO'),
    r.nombreCompleto,
    r.tipoPersona,
    r.sedePertenece || '',
    r.facultadPertenece || '',
    r.carreraPertenece || '',
    r.ingreso?.nombre || '',
    r.guardia ? `${r.guardia.usuario.apellidos} ${r.guardia.usuario.nombres}` : '',
    r.accesoPermitido ? 'PERMITIDO' : 'RECHAZADO',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csvContent = [encabezados.join(','), ...filas].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `registros_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reportes() {
  const hoy = new Date().toISOString().slice(0,10)
  const [filtros, setFiltros] = useState({ fechaInicio: hoy, fechaFin: hoy, idFacultad: '', tipoPersona: '' })
  const [aplicados, setAplicados] = useState(false)

  const { data: facData } = useQuery(LISTAR_FACULTADES_QUERY)
  const facultades: Facultad[] = facData?.listarFacultades ?? []

  const [buscar, { data, loading }] = useLazyQuery(LISTAR_REGISTROS_QUERY, { fetchPolicy: 'network-only' })

  const registros: Registro[] = data?.listarRegistros ?? []

  const aplicar = () => {
    buscar({ variables: {
      fechaInicio: filtros.fechaInicio || null,
      fechaFin:    filtros.fechaFin || null,
      idFacultad:  filtros.idFacultad ? +filtros.idFacultad : null,
      tipoPersona: filtros.tipoPersona || null,
    }})
    setAplicados(true)
  }

  // Estadísticas
  const total = registros.length
  const permitidos = registros.filter(r => r.accesoPermitido).length
  const rechazados = total - permitidos
  const porcPermitido = total > 0 ? Math.round((permitidos / total) * 100) : 0

  const conteoTipo: Record<string, number> = {}
  const conteoFacultad: Record<string, number> = {}
  registros.forEach(r => {
    conteoTipo[r.tipoPersona] = (conteoTipo[r.tipoPersona] || 0) + 1
    const fac = r.facultadPertenece || 'Sin facultad'
    conteoFacultad[fac] = (conteoFacultad[fac] || 0) + 1
  })
  const tipoMasFrecuente = Object.entries(conteoTipo).sort(([,a],[,b]) => b-a)[0]?.[0]
  const facMasFrecuente = Object.entries(conteoFacultad).sort(([,a],[,b]) => b-a)[0]?.[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">📈 Reportes de Ingresos</h1>
        {registros.length > 0 && (
          <Button variant="secondary" onClick={() => exportarCSV(registros)}>
            ⬇️ Exportar CSV
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#1a3a6b] uppercase tracking-wide">Filtros</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label-field">Fecha inicio</label>
            <input type="date" value={filtros.fechaInicio} onChange={e => setFiltros(p => ({...p, fechaInicio: e.target.value}))} className="input-field" />
          </div>
          <div>
            <label className="label-field">Fecha fin</label>
            <input type="date" value={filtros.fechaFin} onChange={e => setFiltros(p => ({...p, fechaFin: e.target.value}))} className="input-field" />
          </div>
          <div>
            <label className="label-field">Facultad</label>
            <select value={filtros.idFacultad} onChange={e => setFiltros(p => ({...p, idFacultad: e.target.value}))} className="input-field">
              <option value="">Todas</option>
              {facultades.map(f => <option key={f.idFacultad} value={f.idFacultad}>{f.nombre.slice(0,40)}...</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Tipo de persona</label>
            <select value={filtros.tipoPersona} onChange={e => setFiltros(p => ({...p, tipoPersona: e.target.value}))} className="input-field">
              <option value="">Todos</option>
              {TIPOS.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={aplicar} loading={loading}>🔍 Aplicar filtros</Button>
      </div>

      {/* Estadísticas */}
      {aplicados && !loading && total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total registros', val: total, icon: '📋', color: 'bg-blue-50' },
            { label: `${porcPermitido}% permitidos`, val: `${permitidos} / ${rechazados} ❌`, icon: '✅', color: 'bg-green-50' },
            { label: 'Tipo más frecuente', val: tipoMasFrecuente?.replace('_',' ') || '—', icon: '👤', color: 'bg-purple-50' },
            { label: 'Facultad con más ingresos', val: (facMasFrecuente || '—').slice(0, 20) + '...', icon: '🏛️', color: 'bg-orange-50' },
          ].map(({ label, val, icon, color }) => (
            <div key={label} className={`${color} rounded-xl p-4`}>
              <p className="text-2xl">{icon}</p>
              <p className="text-lg font-bold text-gray-800 mt-1 leading-tight">{val}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner text="Cargando registros..." /></div>
        ) : !aplicados ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p>Aplica los filtros para ver los registros.</p>
          </div>
        ) : registros.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p>No hay registros para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Fecha/Hora','Nombre','Tipo','Sede','Facultad','Portón','Guardia','Resultado'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map(r => (
                  <tr key={r.idRegistro} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.fechaHora).toLocaleString('es-BO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-800 max-w-[140px] truncate">{r.nombreCompleto}</td>
                    <td className="py-2.5 px-3"><Badge tipo={r.tipoPersona as Parameters<typeof Badge>[0]['tipo']} /></td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 max-w-[80px] truncate">{r.sedePertenece || '—'}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 max-w-[120px] truncate">{r.facultadPertenece || '—'}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{r.ingreso?.nombre || '—'}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">
                      {r.guardia ? `${r.guardia.usuario.apellidos}` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-semibold ${r.accesoPermitido ? 'text-green-600' : 'text-red-500'}`}>
                        {r.accesoPermitido ? '✅ Permitido' : '❌ Rechazado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
