import { useState, useEffect } from 'react'
import { NavLink, Outlet, useParams, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useLazyQuery } from '@apollo/client'
import { LISTAR_USUARIOS_QUERY, LISTAR_INGRESOS_QUERY, DETALLE_USUARIO_QUERY } from '../../graphql/queries'
import {
  CREAR_USUARIO_MUTATION,
  ACTUALIZAR_USUARIO_MUTATION,
  DESACTIVAR_USUARIO_MUTATION,
  ACTIVAR_USUARIO_MUTATION,
} from '../../graphql/mutations'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export type TipoSeccion = 'estudiante' | 'docente' | 'administrativo' | 'personal_externo'

export const SECCIONES: {
  slug: string
  tipo: TipoSeccion
  label: string
  labelSingular: string
  icon: string
}[] = [
  { slug: 'estudiantes',       tipo: 'estudiante',        label: 'Estudiantes',       labelSingular: 'Estudiante',       icon: '🎓' },
  { slug: 'docentes',          tipo: 'docente',           label: 'Docentes',          labelSingular: 'Docente',          icon: '👨‍🏫' },
  { slug: 'administrativos',   tipo: 'administrativo',    label: 'Administrativos',   labelSingular: 'Administrativo',   icon: '🏢' },
  { slug: 'personal-externo',  tipo: 'personal_externo',  label: 'Personal Externo',  labelSingular: 'Personal Externo', icon: '🔧' },
]

export function seccionBySlug(slug: string | undefined) {
  return SECCIONES.find(s => s.slug === slug) ?? null
}

interface FormBase {
  nombres: string; apellidos: string; ci: string;
  email: string; celular: string; password: string; rol: string;
}
interface FormExt {
  nro_registro?: string; modalidad_ingreso?: string; periodo_ingreso?: string;
  codigo_docente?: string; especialidad?: string; categoria?: string;
  codigo_admin?: string; cargo?: string; area?: string;
  empresa?: string; id_ingreso?: string; turno?: string;
}

interface UsuarioRow {
  idUsuario: number; nombres: string; apellidos: string;
  ci: string; email?: string; celular?: string;
  tipoUsuario: string; activo: boolean; rol: { nombre: string }
}

function ModalUsuarioForm({
  mode,
  tipo,
  labelSingular,
  idUsuario,
  onClose,
  onGuardado,
}: {
  mode: 'create' | 'edit'
  tipo: TipoSeccion
  labelSingular: string
  idUsuario?: number
  onClose: () => void
  onGuardado: () => void
}) {
  const [paso, setPaso] = useState<1 | 2>(1)
  const [base, setBase] = useState<FormBase>({
    nombres: '', apellidos: '', ci: '', email: '', celular: '', password: '', rol: 'usuario',
  })
  const [ext, setExt] = useState<FormExt>({})
  const [error, setError] = useState('')
  const [cargandoDetalle, setCargandoDetalle] = useState(mode === 'edit')

  const [crearUsuario, { loading: loadingCrear }] = useMutation(CREAR_USUARIO_MUTATION)
  const [actualizarUsuario, { loading: loadingEditar }] = useMutation(ACTUALIZAR_USUARIO_MUTATION)
  const [fetchDetalle] = useLazyQuery(DETALLE_USUARIO_QUERY, { fetchPolicy: 'network-only' })
  const { data: ingData } = useQuery(LISTAR_INGRESOS_QUERY, { skip: tipo !== 'personal_externo' })
  const ingresos: { idIngreso: number; nombre: string; facultadNombre: string; sedeNombre: string }[] =
    ingData?.listarIngresos ?? []

  useEffect(() => {
    if (mode !== 'edit' || !idUsuario) return
    setCargandoDetalle(true)
    fetchDetalle({ variables: { idUsuario } }).then(({ data }) => {
      if (!data?.detalleUsuario) { setError('No se pudo cargar el usuario.'); setCargandoDetalle(false); return }
      const d = JSON.parse(data.detalleUsuario)
      setBase({
        nombres: d.nombres || '',
        apellidos: d.apellidos || '',
        ci: d.ci || '',
        email: d.email || '',
        celular: d.celular || '',
        password: '',
        rol: d.rol || 'usuario',
      })
      setExt({
        nro_registro: d.nro_registro || '',
        modalidad_ingreso: d.modalidad_ingreso || '',
        periodo_ingreso: d.periodo_ingreso || '',
        codigo_docente: d.codigo_docente || '',
        especialidad: d.especialidad || '',
        categoria: d.categoria || '',
        codigo_admin: d.codigo_admin || '',
        cargo: d.cargo || '',
        area: d.area || '',
        empresa: d.empresa || '',
        id_ingreso: d.id_ingreso ? String(d.id_ingreso) : '',
        turno: d.turno === 'manana' ? 'mañana' : (d.turno || ''),
      })
      setCargandoDetalle(false)
    }).catch(() => {
      setError('Error al cargar los datos del usuario.')
      setCargandoDetalle(false)
    })
  }, [mode, idUsuario, fetchDetalle])

  const setB = (k: keyof FormBase, v: string) => setBase(p => ({ ...p, [k]: v }))
  const setE = (k: keyof FormExt, v: string) => setExt(p => ({ ...p, [k]: v }))

  const paso1Valido = base.nombres && base.apellidos && base.ci &&
    (mode === 'edit' || (base.password && base.password.length >= 6))

  const variablesComunes = {
    nombres:          base.nombres,
    apellidos:        base.apellidos,
    ci:               base.ci,
    email:            base.email || null,
    celular:          base.celular || null,
    rol:              tipo === 'personal_externo' ? base.rol : 'usuario',
    nroRegistro:      ext.nro_registro || null,
    modalidadIngreso: ext.modalidad_ingreso || null,
    periodoIngreso:   ext.periodo_ingreso || null,
    codigoDocente:    ext.codigo_docente || null,
    especialidad:     ext.especialidad || null,
    categoria:        ext.categoria || null,
    codigoAdmin:      ext.codigo_admin || null,
    cargo:            ext.cargo || null,
    area:             ext.area || null,
    empresa:          ext.empresa || null,
    turno:            ext.turno || null,
    idIngreso:        ext.id_ingreso ? +ext.id_ingreso : null,
  }

  const handleGuardar = async () => {
    setError('')
    try {
      if (mode === 'create') {
        const { data } = await crearUsuario({
          variables: { tipoUsuario: tipo, password: base.password, ...variablesComunes },
        })
        if (!data?.crearUsuario?.ok) {
          setError(data?.crearUsuario?.message || 'Error al crear usuario')
          return
        }
      } else {
        const { data } = await actualizarUsuario({
          variables: {
            idUsuario: idUsuario!,
            password: base.password || null,
            ...variablesComunes,
          },
        })
        if (!data?.actualizarUsuario?.ok) {
          setError(data?.actualizarUsuario?.message || 'Error al actualizar usuario')
          return
        }
      }
      onGuardado()
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  const loading = loadingCrear || loadingEditar

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="bg-[#1a3a6b] text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">
              {mode === 'create' ? `Nuevo ${labelSingular}` : `Editar ${labelSingular}`}
            </h3>
            <p className="text-blue-200 text-xs mt-0.5">Paso {paso} de 2</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>

        {cargandoDetalle ? (
          <div className="flex justify-center py-16"><LoadingSpinner text="Cargando datos..." /></div>
        ) : (
          <>
            <div className="flex border-b border-gray-100">
              {[{ n: 1, label: 'Datos base' }, { n: 2, label: 'Datos específicos' }].map(({ n, label }) => (
                <div key={n} className={`flex-1 py-3 text-center text-sm font-medium transition-colors duration-200
                  ${paso === n ? 'text-[#1a3a6b] border-b-2 border-[#1a3a6b]' : 'text-gray-400'}`}>
                  {label}
                </div>
              ))}
            </div>

            <div className="px-6 py-5 space-y-4">
              {paso === 1 && (
                <>
                  {tipo === 'personal_externo' && (
                    <div>
                      <label className="label-field">Rol *</label>
                      <select value={base.rol} onChange={e => setB('rol', e.target.value)} className="input-field">
                        <option value="usuario">Usuario externo</option>
                        <option value="guardia">Guardia de seguridad</option>
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">Nombres *</label>
                      <input value={base.nombres} onChange={e => setB('nombres', e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className="label-field">Apellidos *</label>
                      <input value={base.apellidos} onChange={e => setB('apellidos', e.target.value)} className="input-field" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">Carnet de Identidad *</label>
                      <input value={base.ci} onChange={e => setB('ci', e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className="label-field">
                        {mode === 'create' ? 'Contraseña *' : 'Nueva contraseña'}
                      </label>
                      <input
                        type="password"
                        value={base.password}
                        onChange={e => setB('password', e.target.value)}
                        className="input-field"
                        placeholder={mode === 'edit' ? 'Dejar vacío para no cambiar' : ''}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">Email</label>
                      <input type="email" value={base.email} onChange={e => setB('email', e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className="label-field">Celular</label>
                      <input value={base.celular} onChange={e => setB('celular', e.target.value)} className="input-field" />
                    </div>
                  </div>
                </>
              )}

              {paso === 2 && (
                <>
                  {tipo === 'estudiante' && (
                    <>
                      <div>
                        <label className="label-field">Nro. Registro *</label>
                        <input value={ext.nro_registro || ''} onChange={e => setE('nro_registro', e.target.value)} className="input-field" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label-field">Modalidad Ingreso</label>
                          <input value={ext.modalidad_ingreso || ''} onChange={e => setE('modalidad_ingreso', e.target.value)} className="input-field" />
                        </div>
                        <div>
                          <label className="label-field">Período Ingreso</label>
                          <input value={ext.periodo_ingreso || ''} onChange={e => setE('periodo_ingreso', e.target.value)} className="input-field" />
                        </div>
                      </div>
                    </>
                  )}
                  {tipo === 'docente' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label-field">Código Docente *</label>
                          <input value={ext.codigo_docente || ''} onChange={e => setE('codigo_docente', e.target.value)} className="input-field" />
                        </div>
                        <div>
                          <label className="label-field">Categoría</label>
                          <input value={ext.categoria || ''} onChange={e => setE('categoria', e.target.value)} className="input-field" />
                        </div>
                      </div>
                      <div>
                        <label className="label-field">Especialidad</label>
                        <input value={ext.especialidad || ''} onChange={e => setE('especialidad', e.target.value)} className="input-field" />
                      </div>
                    </>
                  )}
                  {tipo === 'administrativo' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label-field">Código Admin *</label>
                          <input value={ext.codigo_admin || ''} onChange={e => setE('codigo_admin', e.target.value)} className="input-field" />
                        </div>
                        <div>
                          <label className="label-field">Cargo</label>
                          <input value={ext.cargo || ''} onChange={e => setE('cargo', e.target.value)} className="input-field" />
                        </div>
                      </div>
                      <div>
                        <label className="label-field">Área</label>
                        <input value={ext.area || ''} onChange={e => setE('area', e.target.value)} className="input-field" />
                      </div>
                    </>
                  )}
                  {tipo === 'personal_externo' && (
                    <>
                      <div>
                        <label className="label-field">Empresa *</label>
                        <input value={ext.empresa || ''} onChange={e => setE('empresa', e.target.value)} className="input-field" />
                      </div>
                      <div>
                        <label className="label-field">Cargo</label>
                        <input value={ext.cargo || ''} onChange={e => setE('cargo', e.target.value)} className="input-field" />
                      </div>
                      {base.rol === 'guardia' && (
                        <>
                          <div>
                            <label className="label-field">Puerta de ingreso *</label>
                            <select value={ext.id_ingreso || ''} onChange={e => setE('id_ingreso', e.target.value)} className="input-field">
                              <option value="">Seleccionar puerta...</option>
                              {ingresos.map(i => (
                                <option key={i.idIngreso} value={i.idIngreso}>
                                  {i.nombre} — {i.facultadNombre} ({i.sedeNombre})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label-field">Turno *</label>
                            <select value={ext.turno || ''} onChange={e => setE('turno', e.target.value)} className="input-field">
                              <option value="">Seleccionar...</option>
                              <option value="mañana">Mañana</option>
                              <option value="tarde">Tarde</option>
                              <option value="noche">Noche</option>
                            </select>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  <span>⚠️</span><span>{error}</span>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex justify-between gap-3">
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              <div className="flex gap-2">
                {paso === 2 && (
                  <Button variant="secondary" onClick={() => setPaso(1)}>← Atrás</Button>
                )}
                {paso === 1 ? (
                  <Button onClick={() => setPaso(2)} disabled={!paso1Valido}>
                    Siguiente →
                  </Button>
                ) : (
                  <Button onClick={handleGuardar} loading={loading}>
                    {mode === 'create' ? `✅ Crear ${labelSingular}` : '💾 Guardar cambios'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function UsuariosLayout() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a6b]">Gestión de Usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">Administra cada tipo de usuario por separado</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
        {SECCIONES.map(s => (
          <NavLink
            key={s.slug}
            to={`/admin/usuarios/${s.slug}`}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors
              ${isActive
                ? 'bg-white text-[#1a3a6b] border border-b-white border-gray-200 shadow-sm -mb-px'
                : 'text-gray-500 hover:text-[#1a3a6b] hover:bg-gray-50'}`
            }
          >
            <span>{s.icon}</span>
            {s.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}

export function UsuariosRedirect() {
  return <Navigate to="/admin/usuarios/estudiantes" replace />
}

export function UsuariosSeccion() {
  const { seccion } = useParams<{ seccion: string }>()
  const config = seccionBySlug(seccion)
  const tipo = config?.tipo ?? 'estudiante'
  const label = config?.label ?? ''
  const labelSingular = config?.labelSingular ?? ''
  const icon = config?.icon ?? '👤'

  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<string>('')
  const [pagina, setPagina] = useState(0)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; idUsuario?: number } | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<UsuarioRow | null>(null)
  const [msg, setMsg] = useState('')
  const POR_PAGINA = 20

  const { data, loading, refetch } = useQuery(LISTAR_USUARIOS_QUERY, {
    skip: !config,
    variables: {
      tipoUsuario: tipo,
      activo: filtroActivo === '' ? undefined : filtroActivo === 'true',
    },
  })
  const [desactivar, { loading: loadingDesact }] = useMutation(DESACTIVAR_USUARIO_MUTATION)
  const [activar, { loading: loadingAct }] = useMutation(ACTIVAR_USUARIO_MUTATION)

  if (!config) {
    return <Navigate to="/admin/usuarios/estudiantes" replace />
  }

  const todos: UsuarioRow[] = data?.listarUsuarios ?? []

  const filtrados = todos.filter(u => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return u.nombres.toLowerCase().includes(q) || u.apellidos.toLowerCase().includes(q) || u.ci.includes(q)
  })

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const paginaActual = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)

  const handleToggleActivo = async () => {
    if (!confirmToggle) return
    setMsg('')
    try {
      const mut = confirmToggle.activo ? desactivar : activar
      const { data: res } = await mut({ variables: { idUsuario: confirmToggle.idUsuario } })
      const key = confirmToggle.activo ? 'desactivarUsuario' : 'activarUsuario'
      const result = res?.[key]
      if (!result?.success) {
        setMsg(result?.message || 'Error en la operación')
        return
      }
      setMsg(result.message)
      setConfirmToggle(null)
      refetch()
    } catch (e: unknown) {
      setMsg((e as Error).message)
    }
  }

  const columnas = tipo === 'personal_externo'
    ? ['Nombre', 'CI', 'Email', 'Rol', 'Estado', 'Acciones']
    : ['Nombre', 'CI', 'Email', 'Estado', 'Acciones']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h2 className="text-lg font-semibold text-[#1a3a6b]">{label}</h2>
            <p className="text-xs text-gray-400">{filtrados.length} registrado{filtrados.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })}>+ Nuevo {labelSingular}</Button>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex justify-between items-center">
          <span>✅ {msg}</span>
          <button type="button" onClick={() => setMsg('')} className="text-green-500 hover:text-green-800 ml-4">✕</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card p-4 flex flex-wrap gap-3">
        <input
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPagina(0) }}
          placeholder={`🔍  Buscar ${label.toLowerCase()} por nombre o CI...`}
          className="input-field flex-1 min-w-[200px]"
        />
        <select
          value={filtroActivo}
          onChange={e => { setFiltroActivo(e.target.value); setPagina(0) }}
          className="input-field w-36"
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner text={`Cargando ${label.toLowerCase()}...`} /></div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">{icon}</p>
            <p>No hay {label.toLowerCase()} registrados.</p>
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              className="mt-3 text-sm text-[#1a3a6b] hover:underline"
            >
              + Crear primer {labelSingular.toLowerCase()}
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {columnas.map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginaActual.map(u => (
                    <tr key={u.idUsuario} className="border-b border-gray-50 hover:bg-blue-50 transition-colors duration-150">
                      <td className="py-3 px-4 font-medium text-gray-800 whitespace-nowrap">{u.apellidos} {u.nombres}</td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-xs">{u.ci}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs max-w-[160px] truncate">{u.email || '—'}</td>
                      {tipo === 'personal_externo' && (
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap
                            ${u.rol?.nombre === 'guardia'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-600'}`}>
                            {u.rol?.nombre === 'guardia' ? 'Guardia seguridad' : 'Usuario externo'}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap
                          ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {u.activo ? '● Activo' : '● Inactivo'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit', idUsuario: u.idUsuario })}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-[#1a3a6b] hover:bg-blue-100 font-medium transition-colors"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmToggle(u)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors
                              ${u.activo
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                          >
                            {u.activo ? '🚫 Desactivar' : '✅ Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, filtrados.length)} de {filtrados.length}
                </p>
                <div className="flex gap-1">
                  <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                    ← Anterior
                  </button>
                  <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <ModalUsuarioForm
          mode={modal.mode}
          tipo={tipo}
          labelSingular={labelSingular}
          idUsuario={modal.idUsuario}
          onClose={() => setModal(null)}
          onGuardado={() => { refetch(); setPagina(0); setMsg(modal.mode === 'create' ? `${labelSingular} creado correctamente.` : 'Cambios guardados.') }}
        />
      )}

      {confirmToggle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg text-gray-800">
              {confirmToggle.activo ? 'Desactivar usuario' : 'Activar usuario'}
            </h3>
            <p className="text-sm text-gray-600">
              {confirmToggle.activo
                ? `¿Desactivar a ${confirmToggle.apellidos} ${confirmToggle.nombres}? No podrá iniciar sesión.`
                : `¿Reactivar a ${confirmToggle.apellidos} ${confirmToggle.nombres}?`}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmToggle(null)}>Cancelar</Button>
              <Button
                variant={confirmToggle.activo ? 'danger' : 'primary'}
                onClick={handleToggleActivo}
                loading={loadingDesact || loadingAct}
              >
                {confirmToggle.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
