import hashlib
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import strawberry

from accesos.models import (
    Guardia,
    Ingreso,
    Invitado,
    QrToken,
    RegistroIngreso,
)
from accesos.types import InvitadoRegistradoType, QRGeneradoType, ValidarQRResponseType
from usuarios.models import Administrativo, Docente, Estudiante, PersonalExterno
from usuarios.types import ResponseType
from usuarios.utils import get_usuario_from_info


def _nombre_completo(usuario) -> str:
    return f"{usuario.apellidos} {usuario.nombres}"


def _datos_persona(usuario):
    sede = ""
    facultad = ""
    carrera = ""
    try:
        from accesos.models import PersonaFacultad
        pf = (
            PersonaFacultad.objects
            .select_related("facultad__sede", "carrera")
            .filter(usuario=usuario, activo=True)
            .first()
        )
        if pf:
            facultad = pf.facultad.nombre
            sede = pf.facultad.sede.nombre
            carrera = pf.carrera.nombre if pf.carrera else ""
    except Exception:
        pass
    return sede, facultad, carrera


def _rechazado(mensaje: str) -> ValidarQRResponseType:
    return ValidarQRResponseType(
        resultado="RECHAZADO",
        mensaje=mensaje,
        nombre=None, sede=None, facultad=None, tipo_persona=None,
    )


@strawberry.type
class AccesoMutation:

    @strawberry.mutation
    def generar_qr(self, info, segundos_vida: int = 60) -> QRGeneradoType:
        usuario = get_usuario_from_info(info)
        if usuario.rol.nombre == "guardia":
            raise Exception("Los guardias no pueden generar QR.")
        if not usuario.activo:
            raise Exception("Usuario desactivado. Contacte al administrador.")

        # Validar contrato vigente para personal externo
        if usuario.tipo_usuario == "personal_externo":
            try:
                pe = PersonalExterno.objects.select_related("empresa").get(usuario=usuario)
                empresa = pe.empresa
                if not empresa.activo:
                    raise Exception("Su empresa ha sido desactivada. No puede generar QR.")
                if not empresa.contrato_vigente:
                    raise Exception("El contrato de su empresa no está vigente. No puede generar QR.")
                hoy = date.today()
                if empresa.contrato_hasta and empresa.contrato_hasta < hoy:
                    raise Exception(
                        f"El contrato de su empresa venció el {empresa.contrato_hasta}. "
                        "Contacte al administrador."
                    )
            except PersonalExterno.DoesNotExist:
                raise Exception("No se encontró registro de personal externo para su usuario.")

        ahora = datetime.now(tz=timezone.utc)
        raw = f"{usuario.id_usuario}-{ahora}-{uuid4()}"
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        expira_en = ahora + timedelta(seconds=segundos_vida)

        QrToken.objects.create(
            usuario=usuario,
            token_hash=token_hash,
            tipo_persona=usuario.tipo_usuario,
            expira_en=expira_en,
        )

        return QRGeneradoType(
            token=token_hash,
            expira_en=expira_en,
            segundos_vida=segundos_vida,
            tipo_persona=usuario.tipo_usuario,
        )

    @strawberry.mutation
    def validar_qr(
        self,
        info,
        token_hash: str,
        id_ingreso: int,
        tipo_persona_seleccionado: str,
    ) -> ValidarQRResponseType:
        try:
            guardia_usuario = get_usuario_from_info(info)
            if guardia_usuario.rol.nombre != "guardia":
                return _rechazado("Solo los guardias pueden validar QR.")
            if not guardia_usuario.activo:
                return _rechazado("Guardia desactivado.")

            try:
                guardia = Guardia.objects.select_related("ingreso__facultad__sede").get(
                    usuario=guardia_usuario
                )
            except Guardia.DoesNotExist:
                return _rechazado("No se encontró un guardia asociado a este usuario.")

            # Verificar que el guardia está en el ingreso correcto
            if guardia.ingreso.id_ingreso != id_ingreso:
                return _rechazado("No estás asignado a esta puerta de ingreso.")

            if not token_hash or not token_hash.strip():
                return _rechazado("Token QR vacío.")

            try:
                qr = QrToken.objects.select_related("usuario", "invitado").get(
                    token_hash=token_hash.strip()
                )
            except QrToken.DoesNotExist:
                return _rechazado("QR no reconocido. Verifique el código.")

            if qr.usado:
                return _rechazado("Este QR ya fue utilizado anteriormente.")

            ahora = datetime.now(tz=timezone.utc)
            if qr.expira_en < ahora:
                return _rechazado("QR expirado. Solicite un nuevo código.")

            try:
                ingreso = Ingreso.objects.select_related("facultad__sede").get(
                    id_ingreso=id_ingreso
                )
            except Ingreso.DoesNotExist:
                return _rechazado("Punto de ingreso no encontrado.")

            # Datos de la persona
            if qr.invitado:
                inv = qr.invitado
                if inv.fecha_visita != date.today():
                    return _rechazado("Su visita está programada para otra fecha.")
                nombre = f"{inv.apellidos} {inv.nombres}"
                sede = ingreso.facultad.sede.nombre
                facultad = inv.facultad_destino.nombre
                carrera = ""
                tipo = "invitado"
                usuario_obj = None
                invitado_obj = inv
            else:
                u = qr.usuario
                if not u.activo:
                    return _rechazado("El usuario ha sido desactivado.")

                # Validar contrato vigente para personal externo
                if u.tipo_usuario == "personal_externo":
                    try:
                        pe = PersonalExterno.objects.select_related("empresa").get(usuario=u)
                        empresa = pe.empresa
                        if not empresa.activo:
                            return _rechazado("Acceso denegado: la empresa del visitante ha sido desactivada.")
                        if not empresa.contrato_vigente:
                            return _rechazado("Acceso denegado: el contrato de la empresa del visitante no está vigente.")
                        if empresa.contrato_hasta and empresa.contrato_hasta < date.today():
                            return _rechazado(
                                f"Acceso denegado: el contrato de la empresa venció el {empresa.contrato_hasta}."
                            )
                    except PersonalExterno.DoesNotExist:
                        return _rechazado("No se encontró registro de personal externo para este usuario.")

                nombre = _nombre_completo(u)
                sede, facultad, carrera = _datos_persona(u)
                tipo = u.tipo_usuario
                usuario_obj = u
                invitado_obj = None

            # Marcar usado
            qr.usado = True
            qr.usado_en = ahora
            qr.save()

            RegistroIngreso.objects.create(
                token=qr,
                ingreso=ingreso,
                guardia=guardia,
                usuario=usuario_obj,
                invitado=invitado_obj,
                tipo_persona=tipo,
                nombre_completo=nombre,
                sede_pertenece=sede,
                facultad_pertenece=facultad,
                carrera_pertenece=carrera,
                acceso_permitido=True,
            )

            return ValidarQRResponseType(
                resultado="PERMITIDO",
                mensaje=f"Bienvenido, {nombre}",
                nombre=nombre,
                sede=sede,
                facultad=facultad,
                tipo_persona=tipo,
            )
        except Exception as e:
            return _rechazado(f"Error interno: {str(e)}")

    @strawberry.mutation
    def registrar_invitado(
        self,
        info,
        id_facultad_destino: int,
        nombres: str,
        apellidos: str,
        ci: str,
        motivo_visita: str,
        fecha_visita: date,
        celular: Optional[str] = None,
        email: Optional[str] = None,
        horas_validez: int = 24,
    ) -> InvitadoRegistradoType:
        try:
            usuario = get_usuario_from_info(info)
            if usuario.tipo_usuario not in ("docente", "administrativo"):
                return InvitadoRegistradoType(
                    success=False,
                    message="Solo docentes o administrativos pueden registrar invitados.",
                    id_invitado=None, token_qr=None, expira_en=None,
                )
            if not nombres.strip() or not apellidos.strip() or not ci.strip():
                return InvitadoRegistradoType(
                    success=False, message="Nombres, apellidos y CI son requeridos.",
                    id_invitado=None, token_qr=None, expira_en=None,
                )

            from usuarios.models import Facultad
            try:
                facultad = Facultad.objects.get(id_facultad=id_facultad_destino)
            except Facultad.DoesNotExist:
                return InvitadoRegistradoType(
                    success=False, message="Facultad de destino no encontrada.",
                    id_invitado=None, token_qr=None, expira_en=None,
                )

            expira_en = datetime.combine(fecha_visita, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ) + timedelta(hours=horas_validez)

            invitado = Invitado.objects.create(
                registrado_por=usuario,
                facultad_destino=facultad,
                nombres=nombres.strip(),
                apellidos=apellidos.strip(),
                ci=ci.strip(),
                celular=celular,
                email=email,
                motivo_visita=motivo_visita,
                fecha_visita=fecha_visita,
                expira_en=expira_en,
            )

            raw = f"inv-{invitado.id_invitado}-{datetime.now(tz=timezone.utc)}-{uuid4()}"
            token_hash = hashlib.sha256(raw.encode()).hexdigest()

            QrToken.objects.create(
                invitado=invitado,
                token_hash=token_hash,
                tipo_persona="invitado",
                expira_en=expira_en,
            )

            return InvitadoRegistradoType(
                success=True,
                message=f"Invitado {apellidos} {nombres} registrado correctamente.",
                id_invitado=invitado.id_invitado,
                token_qr=token_hash,
                expira_en=expira_en,
            )
        except Exception as e:
            return InvitadoRegistradoType(
                success=False, message=f"Error al registrar invitado: {str(e)}",
                id_invitado=None, token_qr=None, expira_en=None,
            )

    @strawberry.mutation
    def crear_ingreso(
        self,
        info,
        id_facultad: int,
        nombre: str,
        descripcion: Optional[str] = None,
        ubicacion: Optional[str] = None,
    ) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            if not nombre or not nombre.strip():
                return ResponseType(success=False, message="El nombre de la puerta es requerido.")

            from usuarios.models import Facultad
            try:
                facultad = Facultad.objects.get(id_facultad=id_facultad)
            except Facultad.DoesNotExist:
                return ResponseType(success=False, message="Facultad no encontrada.")

            Ingreso.objects.create(
                nombre=nombre.strip(),
                descripcion=descripcion,
                ubicacion=ubicacion,
                facultad=facultad,
            )
            return ResponseType(success=True, message=f"Puerta '{nombre}' creada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error al crear puerta: {str(e)}")
