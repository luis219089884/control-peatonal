import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { MI_PERFIL_QUERY, MI_PERFIL_EXTENDIDO_QUERY, MIS_REGISTROS_QUERY } from '../graphql/queries'
import { useAuth } from '../context/AuthContext'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Seguridad2FA from '../components/Seguridad2FA'
import RegistroRostro from '../components/rostro/RegistroRostro'
import SubirFotoPerfil from '../components/perfil/SubirFotoPerfil'
import {
  seccionPerfilPermitida,
  type SeccionPerfil,
} from '../utils/perfilMenu'

const SECCIONES_VALIDAS: SeccionPerfil[] = ['datos', 'rostro', 'facultad', 'ingresos', 'seguridad']

const TITULOS: Record<SeccionPerfil, string> = {
  datos: 'Mi Perfil',
  rostro: 'Registro de Rostro',
  facultad: 'Mi Facultad/Carrera',
  ingresos: 'Mis Ingresos',
  seguridad: 'Seguridad',
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <input
        readOnly
        value={value || '—'}
        className="w-full bg-[#f0f4f8] border border-[#d0d7e0] rounded-lg px-3 py-2
          text-sm text-gray-700 cursor-default focus:outline-none"
      />
    </div>
  )
}

export default function Perfil() {
  const { seccion: seccionParam } = useParams<{ seccion?: string }>()
  const seccion: SeccionPerfil = (seccionParam as SeccionPerfil) || 'datos'
  const { user } = useAuth()

  const { data, loading } = useQuery(MI_PERFIL_QUERY)
  const { data: extData, loading: extLoading } = useQuery(MI_PERFIL_EXTENDIDO_QUERY)
  const { data: regData, loading: loadingReg } = useQuery(MIS_REGISTROS_QUERY, {
    variables: { limite: 20 },
    skip: seccion !== 'ingresos',
  })
  const misRegistros = regData?.misRegistros ?? []

  if (seccionParam && !SECCIONES_VALIDAS.includes(seccionParam as SeccionPerfil)) {
    return <Navigate to="/perfil" replace />
  }

  if (seccion !== 'datos' && !seccionPerfilPermitida(seccion, user)) {
    return <Navigate to="/perfil" replace />
  }

  if (loading) return <div className="flex justify-center mt-20"><LoadingSpinner text="Cargando perfil..." /></div>

  const u = data?.miPerfil
  const ext = extData?.miPerfilExtendido ? JSON.parse(extData.miPerfilExtendido) : null
  if (!u) return null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">{TITULOS[seccion]}</h1>
        <Badge tipo={u.tipoUsuario} />
      </div>

      {seccion === 'datos' && (
        <div className="bg-white rounded-xl shadow-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <SubirFotoPerfil
              nombres={u.nombres}
              apellidos={u.apellidos}
              fotoUrl={u.fotoUrl}
            />
            <div className="text-center sm:text-left">
              <p className="text-xl font-bold text-gray-900">{u.apellidos} {u.nombres}</p>
              <p className="text-sm text-gray-500 mt-0.5">CI: {u.ci}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Registrado el {new Date(u.creadoEn).toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Campo label="Nro. Registro" value={ext?.nro_registro} />
            <div className="md:col-span-2">
              <Campo label="Apellidos y Nombres" value={`${u.apellidos} ${u.nombres}`} />
            </div>
            <Campo label="CI" value={u.ci} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Campo label="Correo Electrónico" value={u.email} />
            <Campo label="Celular" value={u.celular} />
            <Campo label="Tipo de Usuario" value={u.tipoUsuario?.replace('_', ' ')} />
          </div>

          {ext && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ext.modalidad_ingreso && <Campo label="Modalidad Ingreso" value={ext.modalidad_ingreso} />}
              {ext.periodo_ingreso   && <Campo label="Período Ingreso"   value={ext.periodo_ingreso} />}
              {ext.tipo_sangre       && <Campo label="Tipo de Sangre"    value={ext.tipo_sangre} />}
              {ext.titulo_bachiller  && <Campo label="Título Bachiller"  value={ext.titulo_bachiller} />}
              {ext.especialidad      && <Campo label="Especialidad"      value={ext.especialidad} />}
              {ext.categoria         && <Campo label="Categoría"         value={ext.categoria} />}
              {ext.codigo_docente    && <Campo label="Código Docente"    value={ext.codigo_docente} />}
              {ext.codigo_admin      && <Campo label="Código Admin"      value={ext.codigo_admin} />}
              {ext.cargo             && <Campo label="Cargo"             value={ext.cargo} />}
              {ext.area              && <Campo label="Área"              value={ext.area} />}
              {ext.empresa           && <Campo label="Empresa"           value={ext.empresa} />}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold
              ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {u.activo ? '✅ Activo' : '❌ Inactivo'}
            </span>
            <span className="text-xs text-gray-400">Rol: {u.rol?.nombre}</span>
          </div>
        </div>
      )}

      {seccion === 'rostro' && (
        <RegistroRostro />
      )}

      {seccion === 'ingresos' && (
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          {loadingReg ? (
            <div className="flex justify-center py-12"><LoadingSpinner text="Cargando registros..." /></div>
          ) : misRegistros.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📅</p>
              <p>No tienes registros de ingreso aún.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Fecha/Hora','Portón','Facultad','Sede','Resultado'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {misRegistros.map((r: {
                  idRegistro: number; fechaHora: string; accesoPermitido: boolean;
                  ingreso: { nombre: string; facultad: { nombre: string; sede: { nombre: string } } };
                  sedePertenece?: string;
                }) => (
                  <tr key={r.idRegistro} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-gray-500">
                      {new Date(r.fechaHora).toLocaleString('es-BO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 text-xs">{r.ingreso?.nombre || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs max-w-[180px] truncate">{r.ingreso?.facultad?.nombre || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">{r.ingreso?.facultad?.sede?.nombre || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs font-semibold ${r.accesoPermitido ? 'text-green-600' : 'text-red-500'}`}>
                        {r.accesoPermitido ? '✅ Permitido' : '❌ Rechazado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {seccion === 'seguridad' && (
        <div className="max-w-lg">
          <Seguridad2FA />
        </div>
      )}

      {seccion === 'facultad' && (
        <div className="space-y-4">
          {extLoading ? (
            <div className="flex justify-center mt-8"><LoadingSpinner text="Cargando..." /></div>
          ) : ext?.facultades?.length > 0 ? (
            ext.facultades.map((pf: { facultad: string; sede: string; carrera?: string }, i: number) => (
              <div key={i} className="bg-white rounded-xl shadow-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-[#1a3a6b] text-base">{pf.facultad}</p>
                    {pf.carrera && (
                      <p className="text-sm text-gray-700 mt-1">🎓 {pf.carrera}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">📍 {pf.sede}</p>
                  </div>
                  <Badge tipo={u.tipoUsuario} />
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl shadow-card p-8 text-center">
              <p className="text-4xl mb-3">🏛️</p>
              <p className="text-gray-500">No hay información de facultad registrada.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
