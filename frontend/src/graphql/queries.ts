import { gql } from '@apollo/client'

export const MI_PERFIL_QUERY = gql`
  query MiPerfil {
    miPerfil {
      idUsuario tipoUsuario nombres apellidos ci email celular fotoUrl activo creadoEn
      rol { nombre }
    }
  }
`

export const MI_PERFIL_EXTENDIDO_QUERY = gql`
  query MiPerfilExtendido {
    miPerfilExtendido
  }
`

export const LISTAR_SEDES_QUERY = gql`
  query ListarSedes {
    listarSedes {
      idSede nombre ciudad departamento esIntegral activo
    }
  }
`

export const LISTAR_FACULTADES_QUERY = gql`
  query ListarFacultades($soloActivas: Boolean) {
    listarFacultades(soloActivas: $soloActivas) {
      idFacultad nombre descripcion activo
      sede { idSede nombre ciudad departamento esIntegral activo }
    }
  }
`

export const MIS_REGISTROS_HOY_QUERY = gql`
  query MisRegistrosHoy {
    misRegistrosHoy {
      idRegistro tipoPersona nombreCompleto sedePertenece facultadPertenece
      accesoPermitido motivoRechazo fechaHora
      ingreso { idIngreso nombre facultad { nombre } }
    }
  }
`

export const MIS_REGISTROS_QUERY = gql`
  query MisRegistros($limite: Int) {
    misRegistros(limite: $limite) {
      idRegistro tipoPersona nombreCompleto sedePertenece facultadPertenece
      accesoPermitido motivoRechazo fechaHora
      ingreso { idIngreso nombre facultad { nombre sede { nombre } } }
    }
  }
`

export const MI_PANEL_GUARDIA_QUERY = gql`
  query MiPanelGuardia {
    miPanelGuardia {
      nombreCompleto turno horario ingresoId ingresoNombre facultadNombre sedeNombre sedeId
      guardiaAsignadoNombre
      registrosHoy {
        idRegistro tipoPersona nombreCompleto accesoPermitido fechaHora tipoMovimiento metodo
        ingreso { nombre }
      }
    }
  }
`

export const PANEL_PORTON_ADMIN_QUERY = gql`
  query PanelPortonAdmin($idIngreso: Int!) {
    panelPortonAdmin(idIngreso: $idIngreso) {
      nombreCompleto turno horario ingresoId ingresoNombre facultadNombre sedeNombre sedeId
      guardiaAsignadoNombre
      registrosHoy {
        idRegistro tipoPersona nombreCompleto accesoPermitido fechaHora tipoMovimiento metodo
        ingreso { nombre }
      }
    }
  }
`

export const LISTAR_REGISTROS_QUERY = gql`
  query ListarRegistros(
    $fechaInicio: Date $fechaFin: Date $idFacultad: Int $tipoPersona: String
  ) {
    listarRegistros(
      fechaInicio: $fechaInicio fechaFin: $fechaFin
      idFacultad: $idFacultad tipoPersona: $tipoPersona
    ) {
      idRegistro nombreCompleto tipoPersona tipoMovimiento sedePertenece facultadPertenece
      carreraPertenece accesoPermitido motivoRechazo fechaHora
      ingreso { nombre facultad { nombre } }
      guardia { turno usuario { nombres apellidos } }
    }
  }
`

export const ESTADISTICAS_HOY_QUERY = gql`
  query EstadisticasHoy {
    estadisticasHoy
  }
`

export const LISTAR_USUARIOS_QUERY = gql`
  query ListarUsuarios($tipoUsuario: String, $activo: Boolean) {
    listarUsuarios(tipoUsuario: $tipoUsuario, activo: $activo) {
      idUsuario tipoUsuario nombres apellidos ci email celular activo creadoEn
      rol { nombre }
    }
  }
`

export const DETALLE_USUARIO_QUERY = gql`
  query DetalleUsuario($idUsuario: Int!) {
    detalleUsuario(idUsuario: $idUsuario)
  }
`

export const LISTAR_EMPRESAS_QUERY = gql`
  query ListarEmpresas {
    listarEmpresas
  }
`

export const LISTAR_EMPRESAS_SELECTOR_QUERY = gql`
  query ListarEmpresasSelector($tipo: String) {
    listarEmpresasSelector(tipo: $tipo)
  }
`

export const LISTAR_INGRESOS_QUERY = gql`
  query ListarIngresos($soloActivos: Boolean) {
    listarIngresos(soloActivos: $soloActivos) {
      idIngreso nombre descripcion ubicacion facultadNombre sedeNombre
      guardiaNombre turno activo idFacultad
    }
  }
`

export const LISTAR_CARRERAS_QUERY = gql`
  query ListarCarreras($idFacultad: Int, $soloActivas: Boolean) {
    listarCarreras(idFacultad: $idFacultad, soloActivas: $soloActivas) {
      idCarrera nombre codigo duracionAnios activo
      facultad { idFacultad nombre sede { nombre } }
    }
  }
`

export const LISTAR_DIRECCIONES_UAGRM_QUERY = gql`
  query ListarDireccionesUagrm {
    listarDireccionesUagrm
  }
`

export const LISTAR_NIVELES_ADMIN_QUERY = gql`
  query ListarNivelesAdmin {
    listarNivelesAdmin
  }
`

export const MI_PERFIL_EXTENDIDO_QUERY_FULL = gql`
  query MiPerfilExtendido {
    miPerfilExtendido
  }
`

export const LISTAR_GUARDIAS_QUERY = gql`
  query ListarGuardias {
    listarGuardias {
      idUsuario nombres apellidos ci activo
      idGuardia idIngreso ingresoNombre sedeNombre turno horario fechaAsignacion
    }
  }
`

export const LISTAR_REGISTROS_COMPLETO_QUERY = gql`
  query ListarRegistrosCompleto(
    $fechaInicio: Date $fechaFin: Date $idFacultad: Int
    $tipoPersona: String $tipoMovimiento: String $metodo: String $idSede: Int
  ) {
    listarRegistros(
      fechaInicio: $fechaInicio fechaFin: $fechaFin
      idFacultad: $idFacultad tipoPersona: $tipoPersona
      tipoMovimiento: $tipoMovimiento metodo: $metodo idSede: $idSede
    ) {
      idRegistro nombreCompleto tipoPersona tipoMovimiento metodo
      sedePertenece facultadPertenece accesoPermitido motivoRechazo fechaHora
      ingreso { nombre }
      guardia { turno usuario { nombres apellidos } }
    }
  }
`

export const LISTAR_SINCRONIZACIONES_DTIC_QUERY = gql`
  query ListarSincronizacionesDtic {
    listarSincronizacionesDtic
  }
`

export const ESTADO_DTIC_API_QUERY = gql`
  query EstadoDticApi {
    estadoDticApi
  }
`

export const MIS_INVITADOS_QUERY = gql`
  query MisInvitados {
    misInvitados {
      idInvitado nombres apellidos ci email celular
      motivoVisita fechaVisita expiraEn yaIngreso activo creadoEn
      facultadDestino { idFacultad nombre sede { nombre } }
    }
  }
`
