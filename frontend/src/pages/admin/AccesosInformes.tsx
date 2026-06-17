import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import {
  LISTAR_FACULTADES_QUERY,
  LISTAR_REGISTROS_COMPLETO_QUERY,
  LISTAR_SEDES_QUERY,
} from '../../graphql/queries'
import { fechaHoyBolivia, formatearFechaBo } from '../../utils/fechaBolivia'
import { exportarAccesosPdf } from '../../utils/exportAccesosPdf'
import Button from '../../components/ui/Button'
import TablaAccesos from '../../components/admin/accesos/TablaAccesos'
import { TarjetasResumenFromRegistros } from '../../components/admin/accesos/TarjetasResumen'
import {
  ETIQUETAS_METODO,
  ETIQUETAS_TIPO,
  METODOS,
  TIPOS_PERSONA,
  agruparConteo,
  filtrarBusqueda,
  registroAFilaPdf,
  type FiltrosAccesosState,
  type RegistroAcceso,
} from '../../components/admin/accesos/accesosShared'

const POR_PAGINA = 50
const hoy = fechaHoyBolivia()

const FILTROS_INICIAL: FiltrosAccesosState = {
  fechaInicio: hoy,
  fechaFin: hoy,
  idSede: 0,
  idFacultad: 0,
  tipoPersona: '',
  tipoMovimiento: '',
  metodo: '',
  buscar: '',
}

function PanelFiltros({
  filtros,
  setFiltros,
  sedes,
  facultades,
  onReset,
  modo,
}: {
  filtros: FiltrosAccesosState
  setFiltros: React.Dispatch<React.SetStateAction<FiltrosAccesosState>>
  sedes: { idSede: number; nombre: string }[]
  facultades: { idFacultad: number; nombre: string }[]
  onReset: () => void
  modo: 'consulta' | 'informes'
}) {
  const set = <K extends keyof FiltrosAccesosState>(key: K, val: FiltrosAccesosState[K]) =>
    setFiltros((prev: FiltrosAccesosState) => ({ ...prev, [key]: val }))

  return (
    <div className="bg-white rounded-xl shadow-card p-5 border border-gray-100 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-[#1a3a6b] uppercase tracking-wide">Filtros de búsqueda</h2>
        <button type="button" onClick={onReset} className="text-xs text-gray-500 hover:text-[#1a3a6b] underline">
          Restablecer
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="label-field">Fecha inicio</label>
          <input type="date" value={filtros.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label-field">Fecha fin</label>
          <input type="date" value={filtros.fechaFin} onChange={e => set('fechaFin', e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label-field">Sede</label>
          <select value={filtros.idSede} onChange={e => set('idSede', Number(e.target.value))} className="input-field">
            <option value={0}>Todas las sedes</option>
            {sedes.map(s => <option key={s.idSede} value={s.idSede}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="label-field">Facultad</label>
          <select value={filtros.idFacultad} onChange={e => set('idFacultad', Number(e.target.value))} className="input-field">
            <option value={0}>Todas las facultades</option>
            {facultades.map(f => <option key={f.idFacultad} value={f.idFacultad}>{f.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="label-field">Tipo de persona</label>
          <select value={filtros.tipoPersona} onChange={e => set('tipoPersona', e.target.value)} className="input-field">
            <option value="">Todos</option>
            {TIPOS_PERSONA.map(t => <option key={t} value={t}>{ETIQUETAS_TIPO[t]}</option>)}
          </select>
        </div>
        {modo === 'consulta' && (
          <>
            <div>
              <label className="label-field">Movimiento</label>
              <select value={filtros.tipoMovimiento} onChange={e => set('tipoMovimiento', e.target.value)} className="input-field">
                <option value="">Entrada y salida</option>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </div>
            <div>
              <label className="label-field">Método</label>
              <select value={filtros.metodo} onChange={e => set('metodo', e.target.value)} className="input-field">
                <option value="">Todos</option>
                {METODOS.map(m => <option key={m} value={m}>{ETIQUETAS_METODO[m]}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label-field">Buscar persona, facultad o sede</label>
              <input
                value={filtros.buscar}
                onChange={e => set('buscar', e.target.value)}
                placeholder="Nombre, facultad..."
                className="input-field"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function construirTextoFiltros(
  filtros: FiltrosAccesosState,
  sedes: { idSede: number; nombre: string }[],
  facultades: { idFacultad: number; nombre: string }[],
): string[] {
  const partes: string[] = []
  if (filtros.idSede) partes.push(`Sede: ${sedes.find(s => s.idSede === filtros.idSede)?.nombre ?? filtros.idSede}`)
  if (filtros.idFacultad) partes.push(`Facultad: ${facultades.find(f => f.idFacultad === filtros.idFacultad)?.nombre ?? filtros.idFacultad}`)
  if (filtros.tipoPersona) partes.push(`Tipo: ${ETIQUETAS_TIPO[filtros.tipoPersona] ?? filtros.tipoPersona}`)
  if (filtros.tipoMovimiento) partes.push(`Movimiento: ${filtros.tipoMovimiento}`)
  if (filtros.metodo) partes.push(`Método: ${ETIQUETAS_METODO[filtros.metodo] ?? filtros.metodo}`)
  if (filtros.buscar.trim()) partes.push(`Búsqueda: ${filtros.buscar.trim()}`)
  return partes
}

export default function AccesosInformes() {
  const location = useLocation()
  const modo: 'consulta' | 'informes' = location.pathname.includes('/reportes') ? 'informes' : 'consulta'

  const [filtros, setFiltros] = useState<FiltrosAccesosState>(FILTROS_INICIAL)
  const [paginaActual, setPagina] = useState(1)
  const [informeGenerado, setInformeGenerado] = useState(modo === 'consulta')

  useEffect(() => {
    setInformeGenerado(modo === 'consulta')
    setPagina(1)
  }, [modo])

  const actualizarFiltros: React.Dispatch<React.SetStateAction<FiltrosAccesosState>> = action => {
    setFiltros(action)
    setPagina(1)
  }

  const { data, loading, refetch } = useQuery(LISTAR_REGISTROS_COMPLETO_QUERY, {
    variables: {
      fechaInicio: filtros.fechaInicio || null,
      fechaFin: filtros.fechaFin || null,
      idFacultad: filtros.idFacultad || null,
      tipoPersona: filtros.tipoPersona || null,
      tipoMovimiento: modo === 'consulta' ? (filtros.tipoMovimiento || null) : null,
      metodo: modo === 'consulta' ? (filtros.metodo || null) : null,
      idSede: filtros.idSede || null,
    },
    fetchPolicy: 'network-only',
    skip: modo === 'informes' && !informeGenerado,
  })

  const { data: sedeData } = useQuery(LISTAR_SEDES_QUERY)
  const { data: facData } = useQuery(LISTAR_FACULTADES_QUERY)
  const sedes = sedeData?.listarSedes ?? []
  const facultades = facData?.listarFacultades ?? []

  const registros: RegistroAcceso[] = data?.listarRegistros ?? []
  const filtrados = useMemo(
    () => (modo === 'consulta' ? filtrarBusqueda(registros, filtros.buscar) : registros),
    [registros, filtros.buscar, modo],
  )

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const pagina = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  const conteoTipo = useMemo(() => agruparConteo(filtrados, r => ETIQUETAS_TIPO[r.tipoPersona] ?? r.tipoPersona), [filtrados])
  const conteoSede = useMemo(() => agruparConteo(filtrados, r => r.sedePertenece ?? 'Sin sede'), [filtrados])
  const conteoFacultad = useMemo(() => agruparConteo(filtrados, r => r.facultadPertenece ?? 'Sin facultad'), [filtrados])

  const descargarPdf = (tipo: 'consulta' | 'informe') => {
    if (filtrados.length === 0) return
    const resumen = filtrados.reduce(
      (acc, r) => {
        acc.total++
        if (r.tipoMovimiento === 'entrada' && r.accesoPermitido) acc.entradas++
        if (r.tipoMovimiento === 'salida' && r.accesoPermitido) acc.salidas++
        if (!r.accesoPermitido) acc.rechazados++
        return acc
      },
      { total: 0, entradas: 0, salidas: 0, rechazados: 0 },
    )

    exportarAccesosPdf({
      tituloDocumento: tipo === 'informe'
        ? 'Informe institucional de ingresos peatonal'
        : 'Bitácora de consulta de accesos',
      tipoInforme: tipo,
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin,
      filtrosAplicados: construirTextoFiltros(filtros, sedes, facultades),
      resumen: [
        { label: 'Total', value: resumen.total },
        { label: 'Entradas', value: resumen.entradas },
        { label: 'Salidas', value: resumen.salidas },
        { label: 'Rechazados', value: resumen.rechazados },
      ],
      bloquesResumen: tipo === 'informe' ? [
        { titulo: 'Por tipo de persona', filas: conteoTipo.slice(0, 8) },
        { titulo: 'Por sede', filas: conteoSede.slice(0, 8) },
        { titulo: 'Por facultad', filas: conteoFacultad.slice(0, 8).map(([k, v]) => [k.length > 40 ? `${k.slice(0, 40)}…` : k, v]) },
      ] : undefined,
      filas: filtrados.map(registroAFilaPdf),
      nombreArchivo: tipo === 'informe'
        ? `informe_accesos_${filtros.fechaInicio}_${filtros.fechaFin}.pdf`
        : `bitacora_accesos_${filtros.fechaInicio}_${filtros.fechaFin}.pdf`,
    })
  }

  const tabs = [
    { to: '/admin/accesos', label: 'Consulta operativa', desc: 'Bitácora diaria y búsqueda detallada' },
    { to: '/admin/reportes', label: 'Informes', desc: 'Resumen por periodo e informe PDF' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a6b]">
            {modo === 'consulta' ? 'Registro de Accesos' : 'Informes de Accesos'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {modo === 'consulta'
              ? 'Consulta en tiempo real entradas, salidas y rechazos del control peatonal.'
              : 'Genera informes institucionales por periodo con resumen estadístico.'}
          </p>
        </div>
        {filtrados.length > 0 && (modo === 'consulta' || informeGenerado) && (
          <Button onClick={() => descargarPdf(modo === 'informes' ? 'informe' : 'consulta')}>
            Descargar PDF
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 p-1 bg-gray-100 rounded-xl">
        {tabs.map(tab => {
          const activo = location.pathname === tab.to
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex-1 rounded-lg px-4 py-3 transition-colors ${
                activo ? 'bg-white shadow-sm border border-gray-200' : 'hover:bg-white/60'
              }`}
            >
              <p className={`text-sm font-semibold ${activo ? 'text-[#1a3a6b]' : 'text-gray-600'}`}>{tab.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{tab.desc}</p>
            </Link>
          )
        })}
      </div>

      <PanelFiltros
        filtros={filtros}
        setFiltros={actualizarFiltros}
        sedes={sedes}
        facultades={facultades}
        onReset={() => { setFiltros(FILTROS_INICIAL); setPagina(1); setInformeGenerado(modo === 'consulta') }}
        modo={modo}
      />

      {modo === 'informes' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => { setInformeGenerado(true); refetch() }} loading={loading}>
            Generar informe
          </Button>
          <p className="text-xs text-gray-500">
            Periodo: {formatearFechaBo(filtros.fechaInicio)} — {formatearFechaBo(filtros.fechaFin)}
          </p>
        </div>
      )}

      {modo === 'consulta' && (
        <button type="button" onClick={() => refetch()} className="text-xs text-[#1a3a6b] hover:underline font-medium">
          Actualizar resultados
        </button>
      )}

      {(modo === 'consulta' || informeGenerado) && (
        <>
          <TarjetasResumenFromRegistros registros={filtrados} />

          {modo === 'informes' && filtrados.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { titulo: 'Por tipo de persona', datos: conteoTipo.slice(0, 5) },
                { titulo: 'Por sede', datos: conteoSede.slice(0, 5) },
                { titulo: 'Por facultad', datos: conteoFacultad.slice(0, 5) },
              ].map(bloque => (
                <div key={bloque.titulo} className="bg-white rounded-xl shadow-card p-4 border border-gray-100">
                  <h3 className="text-xs font-semibold text-[#1a3a6b] uppercase tracking-wide mb-3">{bloque.titulo}</h3>
                  <div className="space-y-2">
                    {bloque.datos.map(([nombre, cant]) => (
                      <div key={nombre} className="flex justify-between text-sm gap-2">
                        <span className="text-gray-600 truncate">{nombre}</span>
                        <span className="font-bold text-[#1a3a6b] shrink-0">{cant}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <TablaAccesos
            registros={filtrados}
            loading={loading}
            pagina={modo === 'informes' ? filtrados.slice(0, 100) : pagina}
            paginaActual={modo === 'informes' ? 1 : paginaActual}
            totalPaginas={modo === 'informes' ? 1 : totalPaginas}
            totalFiltrados={filtrados.length}
            porPagina={modo === 'informes' ? 100 : POR_PAGINA}
            onPaginaChange={setPagina}
            vacioMensaje={
              modo === 'informes' && !informeGenerado
                ? 'Configure el periodo y pulse «Generar informe».'
                : 'Sin registros para los filtros seleccionados.'
            }
          />

          {modo === 'informes' && filtrados.length > 100 && (
            <p className="text-xs text-gray-400 text-center">
              Vista previa: primeros 100 registros. El PDF incluye el detalle completo (hasta 400 filas por documento).
            </p>
          )}
        </>
      )}
    </div>
  )
}
