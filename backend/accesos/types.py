from datetime import date, datetime
from typing import Optional

import strawberry

from usuarios.types import FacultadType, UsuarioType


@strawberry.type
class IngresoType:
    id_ingreso: int
    nombre: str
    descripcion: Optional[str]
    ubicacion: Optional[str]
    activo: bool
    facultad: FacultadType


@strawberry.type
class GuardiaType:
    id_guardia: int
    turno: str
    fecha_asignacion: date
    usuario: UsuarioType
    ingreso: IngresoType


@strawberry.type
class InvitadoType:
    id_invitado: int
    nombres: str
    apellidos: str
    ci: str
    celular: Optional[str]
    email: Optional[str]
    motivo_visita: str
    fecha_visita: date
    expira_en: datetime
    ya_ingreso: bool
    activo: bool
    facultad_destino: FacultadType


@strawberry.type
class QrTokenType:
    id_token: int
    token_hash: str
    tipo_persona: str
    generado_en: datetime
    expira_en: datetime
    usado: bool
    usado_en: Optional[datetime]


@strawberry.type
class RegistroIngresoType:
    id_registro: int
    tipo_persona: str
    nombre_completo: str
    sede_pertenece: Optional[str]
    facultad_pertenece: Optional[str]
    carrera_pertenece: Optional[str]
    acceso_permitido: bool
    motivo_rechazo: Optional[str]
    fecha_hora: datetime
    ingreso: IngresoType
    guardia: GuardiaType


@strawberry.type
class ValidarQRResponseType:
    resultado: str
    mensaje: str
    nombre: Optional[str]
    sede: Optional[str]
    facultad: Optional[str]
    tipo_persona: Optional[str]


@strawberry.type
class QRGeneradoType:
    token: str
    expira_en: datetime
    segundos_vida: int
    tipo_persona: str


@strawberry.type
class InvitadoRegistradoType:
    success: bool
    message: str
    id_invitado: Optional[int]
    token_qr: Optional[str]
    expira_en: Optional[datetime]


@strawberry.type
class GuardiaPanelType:
    nombre_completo: str
    turno: str
    horario: str
    ingreso_nombre: str
    facultad_nombre: str
    sede_nombre: str
    registros_hoy: list[RegistroIngresoType]


@strawberry.type
class IngresoConGuardiaType:
    id_ingreso: int
    nombre: str
    descripcion: Optional[str]
    ubicacion: Optional[str]
    facultad_nombre: str
    sede_nombre: str
    guardia_nombre: Optional[str]
    turno: Optional[str]
    activo: bool = True
    id_facultad: int = 0
