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
    sede_nombre: Optional[str]
    facultad: Optional[FacultadType]


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
    creado_en: datetime
    facultad_destino: FacultadType


@strawberry.type
class QrTokenType:
    id_token: int
    token_hash: str
    tipo_persona: str
    tipo_movimiento: str
    generado_en: datetime
    expira_en: datetime
    usado: bool
    usado_en: Optional[datetime]


@strawberry.type
class RegistroIngresoType:
    id_registro: int
    tipo_persona: str
    tipo_movimiento: str
    metodo: str
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
    tipo_movimiento: Optional[str]


@strawberry.type
class QRGeneradoType:
    token: str
    expira_en: datetime
    segundos_vida: int
    tipo_persona: str
    tipo_movimiento: Optional[str]


@strawberry.type
class InvitadoRegistradoType:
    success: bool
    message: str
    id_invitado: Optional[int]
    token_qr: Optional[str]
    expira_en: Optional[datetime]
    email_enviado: bool = False
    email_destino: Optional[str] = None


@strawberry.type
class GuardiaAdminType:
    """Vista del guardia para el panel de administración."""
    id_usuario: int
    nombres: str
    apellidos: str
    ci: str
    activo: bool
    id_guardia: Optional[int]
    id_ingreso: Optional[int]
    ingreso_nombre: Optional[str]
    sede_nombre: Optional[str]
    turno: Optional[str]
    horario: Optional[str]
    fecha_asignacion: Optional[str]


@strawberry.type
class AccesoManualResponseType:
    resultado: str          # "PERMITIDO" | "RECHAZADO"
    mensaje: str
    nombre: Optional[str]
    ci: Optional[str]
    tipo_persona: Optional[str]
    tipo_movimiento: Optional[str]
    sede: Optional[str]
    facultad: Optional[str]


@strawberry.type
class AccesoLogisticoResponseType:
    resultado: str          # "REGISTRADO" | "ERROR"
    mensaje: str
    nombre: Optional[str]
    ci: Optional[str]
    tipo_movimiento: Optional[str]


@strawberry.type
class GuardiaPanelType:
    nombre_completo: str
    turno: str
    horario: str
    ingreso_id: int
    ingreso_nombre: str
    facultad_nombre: str
    sede_nombre: str
    sede_id: int
    registros_hoy: list[RegistroIngresoType]


@strawberry.type
class IngresoConGuardiaType:
    id_ingreso: int
    nombre: str
    descripcion: Optional[str]
    ubicacion: Optional[str]
    sede_nombre: str
    facultad_nombre: str
    guardia_nombre: Optional[str]
    turno: Optional[str]
    activo: bool = True
    id_facultad: int = 0
    id_sede: int = 0
