from datetime import date, datetime
from typing import Optional

import strawberry


@strawberry.type
class SedeType:
    id_sede: int
    nombre: str
    ciudad: str
    departamento: str
    es_integral: bool
    activo: bool


@strawberry.type
class FacultadType:
    id_facultad: int
    nombre: str
    descripcion: Optional[str]
    activo: bool
    sede: SedeType


@strawberry.type
class CarreraType:
    id_carrera: int
    nombre: str
    codigo: str
    duracion_anios: Optional[int]
    activo: bool
    facultad: FacultadType


@strawberry.type
class RolType:
    id_rol: int
    nombre: str
    descripcion: Optional[str]


@strawberry.type
class UsuarioType:
    id_usuario: int
    tipo_usuario: str
    nombres: str
    apellidos: str
    ci: str
    email: str
    celular: Optional[str]
    foto_url: Optional[str]
    activo: bool
    creado_en: datetime
    rol: RolType


@strawberry.type
class EstudianteType:
    id_estudiante: int
    nro_registro: str
    modalidad_ingreso: Optional[str]
    periodo_ingreso: Optional[str]
    tipo_sangre: Optional[str]
    titulo_bachiller: Optional[str]
    pais: Optional[str]
    departamento_origen: Optional[str]
    provincia_origen: Optional[str]
    usuario: UsuarioType


@strawberry.type
class DocenteType:
    id_docente: int
    codigo_docente: str
    especialidad: Optional[str]
    categoria: Optional[str]
    fecha_ingreso: Optional[date]
    usuario: UsuarioType


@strawberry.type
class AdministrativoType:
    id_administrativo: int
    codigo_admin: str
    cargo: Optional[str]
    area: Optional[str]
    fecha_ingreso: Optional[date]
    usuario: UsuarioType


@strawberry.type
class EmpresaExternaType:
    id_empresa: int
    nombre: str
    tipo: str
    nit: Optional[str]
    contacto_nombre: Optional[str]
    contrato_vigente: bool
    contrato_desde: Optional[date]
    contrato_hasta: Optional[date]
    activo: bool


@strawberry.type
class PersonalExternoType:
    id_personal: int
    cargo: Optional[str]
    horario: Optional[str]
    fecha_inicio: Optional[date]
    fecha_fin: Optional[date]
    usuario: UsuarioType
    empresa: EmpresaExternaType


@strawberry.type
class PersonaFacultadType:
    id_persona_facultad: int
    tipo_vinculo: str
    activo: bool
    desde: date
    hasta: Optional[date]
    usuario: UsuarioType
    facultad: FacultadType
    carrera: Optional[CarreraType]


@strawberry.type
class AuthType:
    token: str
    tipo_usuario: str
    rol: str
    nombres: str
    apellidos: str
    message: str
    needs2fa: bool = False
    partial_token: Optional[str] = None


@strawberry.type
class Activar2FAType:
    secret: str
    qr_url: str
    message: str


@strawberry.type
class Verificar2FAResponseType:
    token: str
    tipo_usuario: str
    rol: str
    nombres: str
    apellidos: str
    message: str


@strawberry.type
class ResponseType:
    success: bool
    message: str


@strawberry.type
class CrearUsuarioResponseType:
    ok: bool
    message: str
    id_usuario: Optional[int] = None
