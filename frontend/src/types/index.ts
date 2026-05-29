export interface Sede {
  idSede: number
  nombre: string
  ciudad: string
  departamento: string
  esIntegral: boolean
}

export interface Facultad {
  idFacultad: number
  nombre: string
  descripcion?: string
  sede: Sede
}

export interface Carrera {
  idCarrera: number
  nombre: string
  codigo: string
  duracionAnios?: number
  facultad: Facultad
}

export interface Rol {
  nombre: string
}

export interface Usuario {
  idUsuario: number
  tipoUsuario: string
  nombres: string
  apellidos: string
  ci: string
  email: string
  celular?: string
  fotoUrl?: string
  activo: boolean
  creadoEn: string
  rol?: Rol
}

export interface Estudiante {
  idEstudiante: number
  nroRegistro: string
  modalidadIngreso?: string
  periodoIngreso?: string
  tipoSangre?: string
  tituloBachiller?: string
  pais?: string
  departamentoOrigen?: string
  provinciaOrigen?: string
  usuario: Usuario
}

export interface Docente {
  idDocente: number
  codigoDocente: string
  especialidad?: string
  categoria?: string
  fechaIngreso?: string
  usuario: Usuario
}

export interface Ingreso {
  idIngreso: number
  nombre: string
  descripcion?: string
  ubicacion?: string
  facultad: Facultad
}

export interface RegistroIngreso {
  idRegistro: number
  tipoPersona: string
  nombreCompleto: string
  sedePertenece?: string
  facultadPertenece?: string
  carreraPertenece?: string
  accesoPermitido: boolean
  motivoRechazo?: string
  fechaHora: string
  ingreso: Ingreso
}

export interface QRGenerado {
  token: string
  expiraEn: string
  segundosVida: number
  tipoPersona: string
}

export interface ValidarQRResponse {
  resultado: string
  mensaje: string
  nombre?: string
  sede?: string
  facultad?: string
  tipoPersona?: string
}
