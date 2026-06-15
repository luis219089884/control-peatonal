import { gql } from '@apollo/client'

export const LOGIN_MUTATION = gql`
  mutation Login($ci: String!, $password: String!, $tipoUsuario: String!) {
    login(ci: $ci, password: $password, tipoUsuario: $tipoUsuario) {
      token tipoUsuario rol nombres apellidos message needs2fa partialToken
    }
  }
`

export const VERIFICAR_LOGIN_2FA_MUTATION = gql`
  mutation VerificarLogin2fa($partialToken: String!, $codigo: String!) {
    verificarLogin2fa(partialToken: $partialToken, codigo: $codigo) {
      token tipoUsuario rol nombres apellidos message
    }
  }
`

export const ACTIVAR_2FA_MUTATION = gql`
  mutation Activar2fa {
    activar2fa { secret qrUrl message }
  }
`

export const CONFIRMAR_2FA_MUTATION = gql`
  mutation Confirmar2fa($codigo: String!) {
    confirmar2fa(codigo: $codigo) { success message }
  }
`

export const DESACTIVAR_2FA_MUTATION = gql`
  mutation Desactivar2fa($codigo: String!) {
    desactivar2fa(codigo: $codigo) { success message }
  }
`

export const GENERAR_QR_OBLIGATORIO_MUTATION = gql`
  mutation GenerarQrObligatorio($partialToken: String!) {
    generarQrObligatorio(partialToken: $partialToken) { secret qrUrl message }
  }
`

export const ACTIVAR_2FA_OBLIGATORIO_MUTATION = gql`
  mutation Activar2faObligatorio($partialToken: String!, $codigo: String!) {
    activar2faObligatorio(partialToken: $partialToken, codigo: $codigo) { success message }
  }
`

export const GENERAR_QR_MUTATION = gql`
  mutation GenerarQR($tipoMovimiento: String, $segundosVida: Int) {
    generarQr(tipoMovimiento: $tipoMovimiento, segundosVida: $segundosVida) {
      token
      expiraEn
      segundosVida
      tipoPersona
      tipoMovimiento
    }
  }
`

export const VALIDAR_QR_MUTATION = gql`
  mutation ValidarQR(
    $tokenHash: String!
    $idIngreso: Int!
  ) {
    validarQr(
      tokenHash: $tokenHash
      idIngreso: $idIngreso
    ) {
      resultado
      mensaje
      nombre
      sede
      facultad
      tipoPersona
      tipoMovimiento
    }
  }
`

export const REGISTRAR_ACCESO_MANUAL_MUTATION = gql`
  mutation RegistrarAccesoManual($ci: String!, $tipoMovimiento: String!, $idIngreso: Int!) {
    registrarAccesoManual(ci: $ci, tipoMovimiento: $tipoMovimiento, idIngreso: $idIngreso) {
      resultado
      mensaje
      nombre
      ci
      tipoPersona
      tipoMovimiento
      sede
      facultad
    }
  }
`

export const SINCRONIZAR_DTIC_MUTATION = gql`
  mutation SincronizarDtic($simulado: Boolean) {
    sincronizarDtic(simulado: $simulado)
  }
`

export const ASIGNAR_GUARDIA_MUTATION = gql`
  mutation AsignarGuardia($idUsuario: Int!, $idIngreso: Int!, $turno: String) {
    asignarGuardia(idUsuario: $idUsuario, idIngreso: $idIngreso, turno: $turno) {
      success message
    }
  }
`

export const DESASIGNAR_GUARDIA_MUTATION = gql`
  mutation DesasignarGuardia($idUsuario: Int!) {
    desasignarGuardia(idUsuario: $idUsuario) {
      success message
    }
  }
`

export const REGISTRAR_ACCESO_LOGISTICO_MUTATION = gql`
  mutation RegistrarAccesoLogistico(
    $ci: String!
    $nombreCompleto: String!
    $motivo: String!
    $tipoMovimiento: String!
    $idIngreso: Int!
  ) {
    registrarAccesoLogistico(
      ci: $ci
      nombreCompleto: $nombreCompleto
      motivo: $motivo
      tipoMovimiento: $tipoMovimiento
      idIngreso: $idIngreso
    ) {
      resultado
      mensaje
      nombre
      ci
      tipoMovimiento
    }
  }
`

export const REGISTRAR_INVITADO_MUTATION = gql`
  mutation RegistrarInvitado(
    $idFacultadDestino: Int!
    $nombres: String!
    $apellidos: String!
    $ci: String!
    $email: String!
    $celular: String
    $motivoVisita: String!
    $fechaVisita: Date!
    $horasValidez: Int
  ) {
    registrarInvitado(
      idFacultadDestino: $idFacultadDestino
      nombres: $nombres
      apellidos: $apellidos
      ci: $ci
      email: $email
      celular: $celular
      motivoVisita: $motivoVisita
      fechaVisita: $fechaVisita
      horasValidez: $horasValidez
    ) {
      success
      message
      idInvitado
      tokenQr
      expiraEn
      emailEnviado
      emailDestino
    }
  }
`

export const CAMBIAR_PASSWORD_MUTATION = gql`
  mutation CambiarPassword($passwordActual: String!, $passwordNuevo: String!) {
    cambiarPassword(passwordActual: $passwordActual, passwordNuevo: $passwordNuevo) {
      success
      message
    }
  }
`

export const DESACTIVAR_EMPRESA_MUTATION = gql`
  mutation DesactivarEmpresa($idEmpresa: Int!) {
    desactivarEmpresa(idEmpresa: $idEmpresa) {
      success
      message
    }
  }
`

export const ACTIVAR_EMPRESA_MUTATION = gql`
  mutation ActivarEmpresa($idEmpresa: Int!) {
    activarEmpresa(idEmpresa: $idEmpresa) {
      success
      message
    }
  }
`

export const EDITAR_EMPRESA_MUTATION = gql`
  mutation EditarEmpresa(
    $idEmpresa: Int! $nombre: String! $tipo: String!
    $nit: String $contactoNombre: String
    $contratoVigente: Boolean $contratoDesde: String $contratoHasta: String
  ) {
    editarEmpresa(
      idEmpresa: $idEmpresa nombre: $nombre tipo: $tipo
      nit: $nit contactoNombre: $contactoNombre
      contratoVigente: $contratoVigente contratoDesde: $contratoDesde contratoHasta: $contratoHasta
    ) { success message }
  }
`

export const CREAR_EMPRESA_MUTATION = gql`
  mutation CrearEmpresa(
    $nombre: String! $tipo: String $nit: String $contactoNombre: String
    $contratoDesde: String $contratoHasta: String
  ) {
    crearEmpresa(
      nombre: $nombre tipo: $tipo nit: $nit contactoNombre: $contactoNombre
      contratoDesde: $contratoDesde contratoHasta: $contratoHasta
    ) { success message }
  }
`

export const CREAR_INGRESO_MUTATION = gql`
  mutation CrearIngreso($idFacultad: Int! $nombre: String! $descripcion: String $ubicacion: String) {
    crearIngreso(idFacultad: $idFacultad nombre: $nombre descripcion: $descripcion ubicacion: $ubicacion) {
      success message
    }
  }
`

export const EDITAR_INGRESO_MUTATION = gql`
  mutation EditarIngreso($idIngreso: Int! $nombre: String! $idFacultad: Int! $descripcion: String $ubicacion: String) {
    editarIngreso(idIngreso: $idIngreso nombre: $nombre idFacultad: $idFacultad descripcion: $descripcion ubicacion: $ubicacion) {
      success message
    }
  }
`

export const DESACTIVAR_INGRESO_MUTATION = gql`
  mutation DesactivarIngreso($idIngreso: Int!) {
    desactivarIngreso(idIngreso: $idIngreso) { success message }
  }
`

export const ACTIVAR_INGRESO_MUTATION = gql`
  mutation ActivarIngreso($idIngreso: Int!) {
    activarIngreso(idIngreso: $idIngreso) { success message }
  }
`

export const CREAR_FACULTAD_MUTATION = gql`
  mutation CrearFacultad($idSede: Int! $nombre: String! $descripcion: String) {
    crearFacultad(idSede: $idSede nombre: $nombre descripcion: $descripcion) { success message }
  }
`

export const EDITAR_FACULTAD_MUTATION = gql`
  mutation EditarFacultad($idFacultad: Int! $nombre: String! $idSede: Int $descripcion: String) {
    editarFacultad(idFacultad: $idFacultad nombre: $nombre idSede: $idSede descripcion: $descripcion) { success message }
  }
`

export const DESACTIVAR_FACULTAD_MUTATION = gql`
  mutation DesactivarFacultad($idFacultad: Int!) {
    desactivarFacultad(idFacultad: $idFacultad) { success message }
  }
`

export const ACTIVAR_FACULTAD_MUTATION = gql`
  mutation ActivarFacultad($idFacultad: Int!) {
    activarFacultad(idFacultad: $idFacultad) { success message }
  }
`

export const CREAR_USUARIO_MUTATION = gql`
  mutation CrearUsuario(
    $tipoUsuario: String!
    $nombres: String!
    $apellidos: String!
    $ci: String!
    $email: String
    $celular: String
    $password: String!
    $rol: String
    $nroRegistro: String
    $codigoDocente: String
    $especialidad: String
    $categoria: String
    $codigoAdmin: String
    $nivelJerarquicoAdmin: String
    $codigoDireccionAdmin: String
    $idFacultadAdmin: Int
    $cargo: String
    $area: String
    $empresa: String
    $turno: String
    $idIngreso: Int
    $idCarrera1: Int
    $paralelo1: String
    $modalidad1: String
    $periodo1: String
    $idCarrera2: Int
    $paralelo2: String
    $modalidad2: String
    $periodo2: String
    $vinculosDocente: String
  ) {
    crearUsuario(
      tipoUsuario: $tipoUsuario
      nombres: $nombres
      apellidos: $apellidos
      ci: $ci
      email: $email
      celular: $celular
      password: $password
      rol: $rol
      nroRegistro: $nroRegistro
      codigoDocente: $codigoDocente
      especialidad: $especialidad
      categoria: $categoria
      codigoAdmin: $codigoAdmin
      nivelJerarquicoAdmin: $nivelJerarquicoAdmin
      codigoDireccionAdmin: $codigoDireccionAdmin
      idFacultadAdmin: $idFacultadAdmin
      cargo: $cargo
      area: $area
      empresa: $empresa
      turno: $turno
      idIngreso: $idIngreso
      idCarrera1: $idCarrera1
      paralelo1: $paralelo1
      modalidad1: $modalidad1
      periodo1: $periodo1
      idCarrera2: $idCarrera2
      paralelo2: $paralelo2
      modalidad2: $modalidad2
      periodo2: $periodo2
      vinculosDocente: $vinculosDocente
    ) {
      ok
      message
      idUsuario
    }
  }
`

export const ACTUALIZAR_USUARIO_MUTATION = gql`
  mutation ActualizarUsuario(
    $idUsuario: Int!
    $nombres: String!
    $apellidos: String!
    $ci: String!
    $email: String
    $celular: String
    $password: String
    $rol: String
    $nroRegistro: String
    $codigoDocente: String
    $especialidad: String
    $categoria: String
    $codigoAdmin: String
    $nivelJerarquicoAdmin: String
    $codigoDireccionAdmin: String
    $idFacultadAdmin: Int
    $cargo: String
    $area: String
    $empresa: String
    $turno: String
    $idIngreso: Int
    $idCarrera1: Int
    $paralelo1: String
    $modalidad1: String
    $periodo1: String
    $idCarrera2: Int
    $paralelo2: String
    $modalidad2: String
    $periodo2: String
    $vinculosDocente: String
  ) {
    actualizarUsuario(
      idUsuario: $idUsuario
      nombres: $nombres
      apellidos: $apellidos
      ci: $ci
      email: $email
      celular: $celular
      password: $password
      rol: $rol
      nroRegistro: $nroRegistro
      codigoDocente: $codigoDocente
      especialidad: $especialidad
      categoria: $categoria
      codigoAdmin: $codigoAdmin
      nivelJerarquicoAdmin: $nivelJerarquicoAdmin
      codigoDireccionAdmin: $codigoDireccionAdmin
      idFacultadAdmin: $idFacultadAdmin
      cargo: $cargo
      area: $area
      empresa: $empresa
      turno: $turno
      idIngreso: $idIngreso
      idCarrera1: $idCarrera1
      paralelo1: $paralelo1
      modalidad1: $modalidad1
      periodo1: $periodo1
      idCarrera2: $idCarrera2
      paralelo2: $paralelo2
      modalidad2: $modalidad2
      periodo2: $periodo2
      vinculosDocente: $vinculosDocente
    ) {
      ok
      message
      idUsuario
    }
  }
`

export const DESACTIVAR_USUARIO_MUTATION = gql`
  mutation DesactivarUsuario($idUsuario: Int!) {
    desactivarUsuario(idUsuario: $idUsuario) {
      success
      message
    }
  }
`

export const ACTIVAR_USUARIO_MUTATION = gql`
  mutation ActivarUsuario($idUsuario: Int!) {
    activarUsuario(idUsuario: $idUsuario) {
      success
      message
    }
  }
`

export const CANCELAR_INVITADO_MUTATION = gql`
  mutation CancelarInvitado($idInvitado: Int!) {
    cancelarInvitado(idInvitado: $idInvitado) { success message }
  }
`

export const CREAR_CARRERA_MUTATION = gql`
  mutation CrearCarrera($idFacultad: Int!, $nombre: String!, $codigo: String!, $duracionAnios: Int) {
    crearCarrera(idFacultad: $idFacultad, nombre: $nombre, codigo: $codigo, duracionAnios: $duracionAnios) {
      success message
    }
  }
`

export const EDITAR_CARRERA_MUTATION = gql`
  mutation EditarCarrera($idCarrera: Int!, $nombre: String!, $codigo: String!, $idFacultad: Int, $duracionAnios: Int) {
    editarCarrera(idCarrera: $idCarrera, nombre: $nombre, codigo: $codigo, idFacultad: $idFacultad, duracionAnios: $duracionAnios) {
      success message
    }
  }
`

export const DESACTIVAR_CARRERA_MUTATION = gql`
  mutation DesactivarCarrera($idCarrera: Int!) {
    desactivarCarrera(idCarrera: $idCarrera) { success message }
  }
`

export const ACTIVAR_CARRERA_MUTATION = gql`
  mutation ActivarCarrera($idCarrera: Int!) {
    activarCarrera(idCarrera: $idCarrera) { success message }
  }
`
