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
  mutation GenerarQR($segundosVida: Int) {
    generarQr(segundosVida: $segundosVida) {
      token
      expiraEn
      segundosVida
      tipoPersona
    }
  }
`

export const VALIDAR_QR_MUTATION = gql`
  mutation ValidarQR(
    $tokenHash: String!
    $idIngreso: Int!
    $tipoPersonaSeleccionado: String!
  ) {
    validarQr(
      tokenHash: $tokenHash
      idIngreso: $idIngreso
      tipoPersonaSeleccionado: $tipoPersonaSeleccionado
    ) {
      resultado
      mensaje
      nombre
      sede
      facultad
      tipoPersona
    }
  }
`

export const REGISTRAR_INVITADO_MUTATION = gql`
  mutation RegistrarInvitado(
    $idFacultadDestino: Int!
    $nombres: String!
    $apellidos: String!
    $ci: String!
    $celular: String
    $email: String
    $motivoVisita: String!
    $fechaVisita: Date!
    $horasValidez: Int
  ) {
    registrarInvitado(
      idFacultadDestino: $idFacultadDestino
      nombres: $nombres
      apellidos: $apellidos
      ci: $ci
      celular: $celular
      email: $email
      motivoVisita: $motivoVisita
      fechaVisita: $fechaVisita
      horasValidez: $horasValidez
    ) {
      success
      message
      idInvitado
      tokenQr
      expiraEn
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
    $modalidadIngreso: String
    $periodoIngreso: String
    $codigoDocente: String
    $especialidad: String
    $categoria: String
    $codigoAdmin: String
    $cargo: String
    $area: String
    $empresa: String
    $turno: String
    $idIngreso: Int
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
      modalidadIngreso: $modalidadIngreso
      periodoIngreso: $periodoIngreso
      codigoDocente: $codigoDocente
      especialidad: $especialidad
      categoria: $categoria
      codigoAdmin: $codigoAdmin
      cargo: $cargo
      area: $area
      empresa: $empresa
      turno: $turno
      idIngreso: $idIngreso
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
    $modalidadIngreso: String
    $periodoIngreso: String
    $codigoDocente: String
    $especialidad: String
    $categoria: String
    $codigoAdmin: String
    $cargo: String
    $area: String
    $empresa: String
    $turno: String
    $idIngreso: Int
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
      modalidadIngreso: $modalidadIngreso
      periodoIngreso: $periodoIngreso
      codigoDocente: $codigoDocente
      especialidad: $especialidad
      categoria: $categoria
      codigoAdmin: $codigoAdmin
      cargo: $cargo
      area: $area
      empresa: $empresa
      turno: $turno
      idIngreso: $idIngreso
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
