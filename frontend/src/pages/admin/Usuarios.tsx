import { useState, useEffect } from 'react'
import { NavLink, Outlet, useParams, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useLazyQuery } from '@apollo/client'
import {
  LISTAR_USUARIOS_QUERY, LISTAR_INGRESOS_QUERY,
  DETALLE_USUARIO_QUERY, LISTAR_EMPRESAS_SELECTOR_QUERY,
  LISTAR_FACULTADES_QUERY, LISTAR_CARRERAS_QUERY,
  LISTAR_DIRECCIONES_UAGRM_QUERY, LISTAR_NIVELES_ADMIN_QUERY,
} from '../../graphql/queries'
import {
  CREAR_USUARIO_MUTATION,
  ACTUALIZAR_USUARIO_MUTATION,
  DESACTIVAR_USUARIO_MUTATION,
  ACTIVAR_USUARIO_MUTATION,
} from '../../graphql/mutations'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import PasswordInput from '../../components/ui/PasswordInput'
import { PASSWORD_POLICY_HINT, passwordCumplePolitica, validarPassword } from '../../utils/passwordPolicy'

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
  nro_registro?: string;
  codigo_docente?: string; especialidad?: string; categoria?: string;
  codigo_admin?: string;
  nivel_jerarquico_admin?: string;
  codigo_direccion_admin?: string;
  id_facultad_admin?: string;
  cargo?: string; area?: string;
  empresa?: string; id_ingreso?: string;
}
interface CarreraSlot {
  id_facultad: string
  id_carrera: string
  paralelo: string
  modalidad: string
  periodo: string
}

interface DocenteFacultadBlock {
  id_facultad: string
  id_carreras: string[]
}

const EMPTY_DOCENTE_FACULTAD: DocenteFacultadBlock = { id_facultad: '', id_carreras: [''] }
const MAX_DOCENTE_FACULTADES = 5
const MAX_CARRERAS_POR_FACULTAD = 10

function vinculosToDocenteFacultades(
  vinculos: { id_facultad: number; id_carrera?: number | null }[],
): DocenteFacultadBlock[] {
  const order: number[] = []
  const map = new Map<number, string[]>()
  for (const v of vinculos) {
    if (!map.has(v.id_facultad)) {
      map.set(v.id_facultad, [])
      order.push(v.id_facultad)
    }
    if (v.id_carrera) {
      map.get(v.id_facultad)!.push(String(v.id_carrera))
    }
  }
  return order.map(fac => ({
    id_facultad: String(fac),
    id_carreras: (map.get(fac)?.length ?? 0) > 0 ? map.get(fac)! : [''],
  }))
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
  const EMPTY_CARRERA: CarreraSlot = { id_facultad: '', id_carrera: '', paralelo: '', modalidad: '', periodo: '' }

  const [paso, setPaso] = useState<1 | 2>(1)
  const [base, setBase] = useState<FormBase>({
    nombres: '', apellidos: '', ci: '', email: '', celular: '', password: '', rol: 'usuario',
  })
  const [ext, setExt] = useState<FormExt>({})
  const [carrera1, setCarrera1] = useState<CarreraSlot>(EMPTY_CARRERA)
  const [carrera2, setCarrera2] = useState<CarreraSlot>(EMPTY_CARRERA)
  const [mostrarCarrera2, setMostrarCarrera2] = useState(false)
  const [docenteFacultades, setDocenteFacultades] = useState<DocenteFacultadBlock[]>([{ ...EMPTY_DOCENTE_FACULTAD }])
  const [error, setError] = useState('')
  const [cargandoDetalle, setCargandoDetalle] = useState(mode === 'edit')

  const [crearUsuario, { loading: loadingCrear }] = useMutation(CREAR_USUARIO_MUTATION)
  const [actualizarUsuario, { loading: loadingEditar }] = useMutation(ACTUALIZAR_USUARIO_MUTATION)
  const [fetchDetalle] = useLazyQuery(DETALLE_USUARIO_QUERY, { fetchPolicy: 'network-only' })
  const { data: ingData } = useQuery(LISTAR_INGRESOS_QUERY, { skip: tipo !== 'personal_externo' })
  const ingresos: { idIngreso: number; nombre: string; facultadNombre: string; sedeNombre: string }[] =
    ingData?.listarIngresos ?? []

  // Filtra empresas según el rol del personal externo
  const tipoEmpresa = base.rol === 'guardia' ? 'seguridad' : 'externa'
  const { data: empData } = useQuery(LISTAR_EMPRESAS_SELECTOR_QUERY, {
    skip: tipo !== 'personal_externo',
    variables: { tipo: tipoEmpresa },
    fetchPolicy: 'network-only',
  })
  const empresasDisponibles: { id_empresa: number; nombre: string; contrato_vigente: boolean }[] =
    empData?.listarEmpresasSelector ? JSON.parse(empData.listarEmpresasSelector) : []

  // Facultades y carreras para estudiante
  const { data: facData } = useQuery(LISTAR_FACULTADES_QUERY, {
    skip: tipo !== 'estudiante' && tipo !== 'docente',
    variables: { soloActivas: true },
  })
  const facultades: { idFacultad: number; nombre: string; sede: { nombre: string } }[] =
    facData?.listarFacultades ?? []

  const { data: docCarData } = useQuery(LISTAR_CARRERAS_QUERY, {
    skip: tipo !== 'docente',
    variables: { soloActivas: true },
  })
  const todasCarrerasDoc: { idCarrera: number; nombre: string; facultad: { idFacultad: number } }[] =
    docCarData?.listarCarreras ?? []

  const { data: dirData } = useQuery(LISTAR_DIRECCIONES_UAGRM_QUERY, { skip: tipo !== 'administrativo' })
  const direcciones: { codigo: string; nombre: string }[] = dirData?.listarDireccionesUagrm
    ? JSON.parse(dirData.listarDireccionesUagrm) : []

  const { data: nivelesData } = useQuery(LISTAR_NIVELES_ADMIN_QUERY, { skip: tipo !== 'administrativo' })
  const nivelesAdmin: { valor: string; label: string; puede_invitar: boolean }[] = nivelesData?.listarNivelesAdmin
    ? JSON.parse(nivelesData.listarNivelesAdmin) : []

  const nivelSeleccionado = nivelesAdmin.find(n => n.valor === ext.nivel_jerarquico_admin)
  const esFacultativo = ext.nivel_jerarquico_admin === 'autoridad_ejecutiva'

  const { data: car1Data } = useQuery(LISTAR_CARRERAS_QUERY, {
    skip: tipo !== 'estudiante' || !carrera1.id_facultad,
    variables: { idFacultad: carrera1.id_facultad ? +carrera1.id_facultad : undefined },
    fetchPolicy: 'network-only',
  })
  const carrerasList1: { idCarrera: number; nombre: string }[] = car1Data?.listarCarreras ?? []

  const { data: car2Data } = useQuery(LISTAR_CARRERAS_QUERY, {
    skip: tipo !== 'estudiante' || !carrera2.id_facultad || !mostrarCarrera2,
    variables: { idFacultad: carrera2.id_facultad ? +carrera2.id_facultad : undefined },
    fetchPolicy: 'network-only',
  })
  const carrerasList2: { idCarrera: number; nombre: string }[] = car2Data?.listarCarreras ?? []

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
        codigo_docente: d.codigo_docente || '',
        especialidad: d.especialidad || '',
        categoria: d.categoria || '',
        codigo_admin: d.codigo_admin || '',
        nivel_jerarquico_admin: d.nivel_jerarquico_admin || 'apoyo_secretarial',
        codigo_direccion_admin: d.codigo_direccion_admin || '',
        id_facultad_admin: d.id_facultad_admin ? String(d.id_facultad_admin) : '',
        cargo: d.cargo || '',
        area: d.area || '',
        empresa: d.empresa || '',
        id_ingreso: d.id_ingreso ? String(d.id_ingreso) : '',
      })
      if (d.carreras && d.carreras.length > 0) {
        const c1 = d.carreras[0]
        setCarrera1({
          id_facultad: c1.id_facultad ? String(c1.id_facultad) : '',
          id_carrera: c1.id_carrera ? String(c1.id_carrera) : '',
          paralelo: c1.paralelo || '',
          modalidad: c1.modalidad_ingreso || '',
          periodo: c1.periodo_ingreso || '',
        })
        if (d.carreras.length > 1) {
          const c2 = d.carreras[1]
          setCarrera2({
            id_facultad: c2.id_facultad ? String(c2.id_facultad) : '',
            id_carrera: c2.id_carrera ? String(c2.id_carrera) : '',
            paralelo: c2.paralelo || '',
            modalidad: c2.modalidad_ingreso || '',
            periodo: c2.periodo_ingreso || '',
          })
          setMostrarCarrera2(true)
        }
      }
      if (tipo === 'docente' && d.vinculos && d.vinculos.length > 0) {
        setDocenteFacultades(vinculosToDocenteFacultades(d.vinculos))
      } else if (tipo === 'docente') {
        setDocenteFacultades([{ ...EMPTY_DOCENTE_FACULTAD }])
      }
      setCargandoDetalle(false)
    }).catch(() => {
      setError('Error al cargar los datos del usuario.')
      setCargandoDetalle(false)
    })
  }, [mode, idUsuario, fetchDetalle])

  const setB = (k: keyof FormBase, v: string) => {
    setBase(p => ({ ...p, [k]: v }))
    // Al cambiar el rol en personal externo, limpiar empresa seleccionada
    if (k === 'rol') {
      setExt(p => ({ ...p, empresa: '' }))
    }
  }
  const setE = (k: keyof FormExt, v: string) => setExt(p => ({ ...p, [k]: v }))

  const carrerasPorFacultad = (idFacultad: string) => {
    if (!idFacultad) return []
    return todasCarrerasDoc.filter(c => c.facultad.idFacultad === +idFacultad)
  }

  const buildVinculosDocenteJson = () => JSON.stringify(
    docenteFacultades
      .filter(f => f.id_facultad)
      .flatMap(f => {
        const carreras = f.id_carreras.filter(c => c)
        if (carreras.length === 0) {
          return [{ id_facultad: +f.id_facultad }]
        }
        return carreras.map(c => ({ id_facultad: +f.id_facultad, id_carrera: +c }))
      })
  )

  const paso1Valido = base.nombres && base.apellidos && base.ci &&
    (mode === 'edit'
      ? (!base.password || passwordCumplePolitica(base.password))
      : passwordCumplePolitica(base.password))

  const variablesComunes = {
    nombres:       base.nombres,
    apellidos:     base.apellidos,
    ci:            base.ci,
    email:         base.email || null,
    celular:       base.celular || null,
    rol:           tipo === 'personal_externo' ? base.rol : 'usuario',
    nroRegistro:   ext.nro_registro || null,
    codigoDocente: ext.codigo_docente || null,
    especialidad:  ext.especialidad || null,
    categoria:     ext.categoria || null,
    codigoAdmin:            ext.codigo_admin || null,
    nivelJerarquicoAdmin:   ext.nivel_jerarquico_admin || null,
    codigoDireccionAdmin:   ext.codigo_direccion_admin || null,
    idFacultadAdmin:        ext.id_facultad_admin ? +ext.id_facultad_admin : null,
    cargo:                  ext.cargo || null,
    area:          ext.area || null,
    empresa:       ext.empresa || null,
    idIngreso:     ext.id_ingreso ? +ext.id_ingreso : null,
    idCarrera1:    carrera1.id_carrera ? +carrera1.id_carrera : null,
    paralelo1:     carrera1.paralelo || null,
    modalidad1:    carrera1.modalidad || null,
    periodo1:      carrera1.periodo || null,
    idCarrera2:    mostrarCarrera2 && carrera2.id_carrera ? +carrera2.id_carrera : null,
    paralelo2:     mostrarCarrera2 && carrera2.id_carrera ? (carrera2.paralelo || null) : null,
    modalidad2:    mostrarCarrera2 && carrera2.id_carrera ? (carrera2.modalidad || null) : null,
    periodo2:      mostrarCarrera2 && carrera2.id_carrera ? (carrera2.periodo || null) : null,
    vinculosDocente: tipo === 'docente' ? buildVinculosDocenteJson() : null,
  }

  const handleGuardar = async () => {
    setError('')
    if (mode === 'create') {
      const errPass = validarPassword(base.password)
      if (errPass) {
        setError(errPass)
        return
      }
    } else if (base.password) {
      const errPass = validarPassword(base.password)
      if (errPass) {
        setError(errPass)
        return
      }
    }
    if (tipo === 'docente') {
      const filled = docenteFacultades.filter(f => f.id_facultad)
      if (filled.length === 0) {
        setError('Debe registrar al menos una facultad para el docente.')
        return
      }
      const globalKeys = new Set<string>()
      for (const f of filled) {
        const carreras = f.id_carreras.filter(c => c)
        if (carreras.length === 0) {
          const key = `${f.id_facultad}-none`
          if (globalKeys.has(key)) {
            setError('Hay facultades duplicadas sin carrera específica.')
            return
          }
          globalKeys.add(key)
          continue
        }
        const local = new Set<string>()
        for (const c of carreras) {
          if (local.has(c)) {
            setError('Hay carreras duplicadas en la misma facultad.')
            return
          }
          local.add(c)
          const key = `${f.id_facultad}-${c}`
          if (globalKeys.has(key)) {
            setError('Hay vinculaciones duplicadas (misma facultad y carrera).')
            return
          }
          globalKeys.add(key)
        }
      }
    }
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
      <div className={`bg-white rounded-xl shadow-2xl w-full ${tipo === 'docente' ? 'max-w-xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
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
                      <PasswordInput
                        value={base.password}
                        onChange={v => setB('password', v)}
                        placeholder={mode === 'edit' ? 'Dejar vacío para no cambiar' : ''}
                      />
                      <p className="text-xs text-gray-500 mt-1">{PASSWORD_POLICY_HINT}</p>
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

                      {/* ── Carrera 1 ── */}
                      <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-3 space-y-3">
                        <p className="text-xs font-semibold text-[#1a3a6b] uppercase tracking-wide">Carrera principal *</p>
                        <div>
                          <label className="label-field">Facultad *</label>
                          <select
                            className="input-field"
                            value={carrera1.id_facultad}
                            onChange={e => setCarrera1(c => ({ ...c, id_facultad: e.target.value, id_carrera: '' }))}
                          >
                            <option value="">— Selecciona facultad —</option>
                            {facultades.map((f: { idFacultad: number; nombre: string; sede: { nombre: string } }) => (
                              <option key={f.idFacultad} value={f.idFacultad}>
                                {f.nombre} ({f.sede.nombre})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label-field">Carrera *</label>
                            <select
                              className="input-field"
                              value={carrera1.id_carrera}
                              onChange={e => setCarrera1(c => ({ ...c, id_carrera: e.target.value }))}
                              disabled={!carrera1.id_facultad}
                            >
                              <option value="">— Selecciona carrera —</option>
                              {carrerasList1.map((c: { idCarrera: number; nombre: string }) => (
                                <option key={c.idCarrera} value={c.idCarrera}>{c.nombre}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label-field">Paralelo</label>
                            <input
                              className="input-field"
                              value={carrera1.paralelo}
                              onChange={e => setCarrera1(c => ({ ...c, paralelo: e.target.value }))}
                              placeholder="A, B, 1, 2..."
                              maxLength={5}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label-field">Modalidad Ingreso</label>
                            <input
                              className="input-field"
                              value={carrera1.modalidad}
                              onChange={e => setCarrera1(c => ({ ...c, modalidad: e.target.value }))}
                              placeholder="Regular, Becado..."
                            />
                          </div>
                          <div>
                            <label className="label-field">Período Ingreso</label>
                            <input
                              className="input-field"
                              value={carrera1.periodo}
                              onChange={e => setCarrera1(c => ({ ...c, periodo: e.target.value }))}
                              placeholder="2024-I"
                            />
                          </div>
                        </div>
                      </div>

                      {/* ── Carrera 2 ── */}
                      {mostrarCarrera2 ? (
                        <div className="border border-amber-100 bg-amber-50/40 rounded-lg p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Segunda carrera</p>
                            <button
                              type="button"
                              onClick={() => { setMostrarCarrera2(false); setCarrera2(EMPTY_CARRERA) }}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              ✕ Quitar
                            </button>
                          </div>
                          <div>
                            <label className="label-field">Facultad</label>
                            <select
                              className="input-field"
                              value={carrera2.id_facultad}
                              onChange={e => setCarrera2(c => ({ ...c, id_facultad: e.target.value, id_carrera: '' }))}
                            >
                              <option value="">— Selecciona facultad —</option>
                              {facultades.map((f: { idFacultad: number; nombre: string; sede: { nombre: string } }) => (
                                <option key={f.idFacultad} value={f.idFacultad}>
                                  {f.nombre} ({f.sede.nombre})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="label-field">Carrera</label>
                              <select
                                className="input-field"
                                value={carrera2.id_carrera}
                                onChange={e => setCarrera2(c => ({ ...c, id_carrera: e.target.value }))}
                                disabled={!carrera2.id_facultad}
                              >
                                <option value="">— Selecciona carrera —</option>
                                {carrerasList2.map((c: { idCarrera: number; nombre: string }) => (
                                  <option key={c.idCarrera} value={c.idCarrera}>{c.nombre}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label-field">Paralelo</label>
                              <input
                                className="input-field"
                                value={carrera2.paralelo}
                                onChange={e => setCarrera2(c => ({ ...c, paralelo: e.target.value }))}
                                placeholder="A, B, 1, 2..."
                                maxLength={5}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="label-field">Modalidad Ingreso</label>
                              <input
                                className="input-field"
                                value={carrera2.modalidad}
                                onChange={e => setCarrera2(c => ({ ...c, modalidad: e.target.value }))}
                                placeholder="Regular, Becado..."
                              />
                            </div>
                            <div>
                              <label className="label-field">Período Ingreso</label>
                              <input
                                className="input-field"
                                value={carrera2.periodo}
                                onChange={e => setCarrera2(c => ({ ...c, periodo: e.target.value }))}
                                placeholder="2025-I"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMostrarCarrera2(true)}
                          className="text-sm text-[#1a3a6b] hover:underline font-medium"
                        >
                          + Agregar segunda carrera
                        </button>
                      )}
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

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-[#1a3a6b] uppercase tracking-wide">
                            Vinculación académica *
                          </p>
                          <span className="text-xs text-gray-400">
                            Mín. 1 facultad — máx. {MAX_DOCENTE_FACULTADES}
                          </span>
                        </div>

                        {docenteFacultades.map((bloque, facIdx) => (
                          <div key={facIdx} className="border border-indigo-100 bg-indigo-50/40 rounded-lg p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-indigo-700">Facultad {facIdx + 1}</p>
                              {docenteFacultades.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setDocenteFacultades(rows => rows.filter((_, i) => i !== facIdx))}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  ✕ Quitar facultad
                                </button>
                              )}
                            </div>
                            <div>
                              <label className="label-field">Facultad *</label>
                              <select
                                className="input-field"
                                value={bloque.id_facultad}
                                onChange={e => setDocenteFacultades(rows => rows.map((r, i) =>
                                  i === facIdx ? { id_facultad: e.target.value, id_carreras: [''] } : r
                                ))}
                              >
                                <option value="">— Selecciona facultad —</option>
                                {facultades.map(f => (
                                  <option key={f.idFacultad} value={f.idFacultad}>
                                    {f.nombre} ({f.sede.nombre})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2 pl-2 border-l-2 border-indigo-200">
                              <p className="text-xs font-medium text-indigo-600">
                                Carreras <span className="font-normal text-gray-400">(opcional, varias por facultad)</span>
                              </p>
                              {bloque.id_carreras.map((idCar, carIdx) => (
                                <div key={carIdx} className="flex gap-2 items-end">
                                  <div className="flex-1">
                                    <select
                                      className="input-field"
                                      value={idCar}
                                      onChange={e => setDocenteFacultades(rows => rows.map((r, i) =>
                                        i === facIdx
                                          ? {
                                              ...r,
                                              id_carreras: r.id_carreras.map((c, j) =>
                                                j === carIdx ? e.target.value : c
                                              ),
                                            }
                                          : r
                                      ))}
                                      disabled={!bloque.id_facultad}
                                    >
                                      <option value="">— Sin carrera específica —</option>
                                      {carrerasPorFacultad(bloque.id_facultad)
                                        .filter(c => !bloque.id_carreras.includes(String(c.idCarrera)) || String(c.idCarrera) === idCar)
                                        .map(c => (
                                          <option key={c.idCarrera} value={c.idCarrera}>{c.nombre}</option>
                                        ))}
                                    </select>
                                  </div>
                                  {bloque.id_carreras.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setDocenteFacultades(rows => rows.map((r, i) =>
                                        i === facIdx
                                          ? { ...r, id_carreras: r.id_carreras.filter((_, j) => j !== carIdx) }
                                          : r
                                      ))}
                                      className="text-xs text-red-500 hover:text-red-700 px-2 py-2"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}
                              {bloque.id_facultad && bloque.id_carreras.length < MAX_CARRERAS_POR_FACULTAD && (
                                <button
                                  type="button"
                                  onClick={() => setDocenteFacultades(rows => rows.map((r, i) =>
                                    i === facIdx ? { ...r, id_carreras: [...r.id_carreras, ''] } : r
                                  ))}
                                  className="text-xs text-indigo-700 hover:underline"
                                >
                                  + Agregar carrera
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {docenteFacultades.length < MAX_DOCENTE_FACULTADES && (
                          <button
                            type="button"
                            onClick={() => setDocenteFacultades(rows => [...rows, { ...EMPTY_DOCENTE_FACULTAD }])}
                            className="text-sm text-[#1a3a6b] hover:underline"
                          >
                            + Agregar otra facultad
                          </button>
                        )}
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
                          <input value={ext.cargo || ''} onChange={e => setE('cargo', e.target.value)} className="input-field" placeholder="Ej: Decano, Director DAEF..." />
                        </div>
                      </div>

                      <div>
                        <label className="label-field">Nivel jerárquico *</label>
                        <select
                          value={ext.nivel_jerarquico_admin || ''}
                          onChange={e => setE('nivel_jerarquico_admin', e.target.value)}
                          className="input-field"
                        >
                          <option value="">— Selecciona nivel —</option>
                          {nivelesAdmin.map(n => (
                            <option key={n.valor} value={n.valor}>{n.label}</option>
                          ))}
                        </select>
                        {nivelSeleccionado && (
                          <p className={`text-xs mt-1 ${nivelSeleccionado.puede_invitar ? 'text-green-600' : 'text-red-500'}`}>
                            {nivelSeleccionado.puede_invitar ? '✅ Puede registrar invitados' : '🚫 Sin permiso para registrar invitados'}
                          </p>
                        )}
                      </div>

                      {esFacultativo ? (
                        <div>
                          <label className="label-field">Facultad *</label>
                          <select
                            value={ext.id_facultad_admin || ''}
                            onChange={e => setE('id_facultad_admin', e.target.value)}
                            className="input-field"
                          >
                            <option value="">— Selecciona facultad —</option>
                            {facultades.map(f => (
                              <option key={f.idFacultad} value={f.idFacultad}>
                                {f.nombre} ({f.sede.nombre})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="label-field">Dirección / Unidad</label>
                          <select
                            value={ext.codigo_direccion_admin || ''}
                            onChange={e => setE('codigo_direccion_admin', e.target.value)}
                            className="input-field"
                          >
                            <option value="">— Sin dirección específica —</option>
                            {direcciones.map(d => (
                              <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="label-field">Área / Subunidad</label>
                        <input value={ext.area || ''} onChange={e => setE('area', e.target.value)} className="input-field" placeholder="Ej: Unidad de Contabilidad" />
                      </div>
                    </>
                  )}
                  {tipo === 'personal_externo' && (
                    <>
                      <div>
                        <label className="label-field">
                          {base.rol === 'guardia' ? 'Empresa de seguridad *' : 'Empresa *'}
                        </label>
                        {empresasDisponibles.length === 0 ? (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            No hay empresas de tipo <strong>{base.rol === 'guardia' ? 'seguridad' : 'externa'}</strong> registradas.
                            Crea una primero en <em>Empresas Externas</em>.
                          </div>
                        ) : (
                          <select
                            value={ext.empresa || ''}
                            onChange={e => setE('empresa', e.target.value)}
                            className="input-field"
                          >
                            <option value="">Seleccionar empresa...</option>
                            {empresasDisponibles.map(emp => (
                              <option key={emp.id_empresa} value={emp.nombre}>
                                {emp.nombre}{!emp.contrato_vigente ? ' ⚠ (contrato vencido)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="label-field">Cargo</label>
                        <input value={ext.cargo || ''} onChange={e => setE('cargo', e.target.value)} className="input-field" />
                      </div>
                      {base.rol === 'guardia' && (
                        <>
                          <div>
                            <label className="label-field">Portón de ingreso *</label>
                            <select value={ext.id_ingreso || ''} onChange={e => setE('id_ingreso', e.target.value)} className="input-field">
                              <option value="">Seleccionar portón...</option>
                              {ingresos.map(i => (
                                <option key={i.idIngreso} value={i.idIngreso}>
                                  {i.nombre} — {i.facultadNombre} ({i.sedeNombre})
                                </option>
                              ))}
                            </select>
                          </div>
                          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                            El horario de trabajo es según el contrato de la empresa: <strong>07:00 a 22:00</strong>.
                          </p>
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
