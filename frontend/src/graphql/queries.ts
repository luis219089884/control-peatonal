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

export const LISTAR_FACULTADES_QUERY = gql`
  query ListarFacultades {
    listarFacultades {
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
      nombreCompleto turno ingresoNombre facultadNombre sedeNombre
      registrosHoy {
        idRegistro tipoPersona nombreCompleto accesoPermitido fechaHora
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
      idRegistro nombreCompleto tipoPersona sedePertenece facultadPertenece
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

export const LISTAR_INGRESOS_QUERY = gql`
  query ListarIngresos {
    listarIngresos {
      idIngreso nombre descripcion ubicacion facultadNombre sedeNombre
      guardiaNombre turno
    }
  }
`
