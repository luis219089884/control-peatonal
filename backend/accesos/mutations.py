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
from accesos.types import (
    AccesoLogisticoResponseType,
    AccesoManualResponseType,
    InvitadoRegistradoType,
    QRGeneradoType,
    ValidarQRResponseType,
)
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
        nombre=None, sede=None, facultad=None, tipo_persona=None, tipo_movimiento=None,
    )


@strawberry.type
class AccesoMutation:

    @strawberry.mutation
    def generar_qr(
        self,
        info,
        segundos_vida: int = 60,
    ) -> QRGeneradoType:
        """
        Genera un único QR de un solo uso.
        El guardia determina entrada o salida al escanear, según si la persona
        ya está adentro de la sede del portón.
        """
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
            tipo_movimiento="entrada",  # placeholder; se resuelve al escanear
            expira_en=expira_en,
        )

        return QRGeneradoType(
            token=token_hash,
            expira_en=expira_en,
            segundos_vida=segundos_vida,
            tipo_persona=usuario.tipo_usuario,
            tipo_movimiento=None,
        )

    @strawberry.mutation
    def validar_qr(
        self,
        info,
        token_hash: str,
        id_ingreso: int,
    ) -> ValidarQRResponseType:
        """
        Valida un QR escaneado por el guardia.
        - El tipo de persona y el movimiento (entrada/salida) se leen del token.
        - El guardia no necesita elegir el tipo de persona.
        - Se valida el estado adentro/afuera según la sede del portón.
        """
        try:
            guardia_usuario = get_usuario_from_info(info)
            if guardia_usuario.rol.nombre != "guardia":
                return _rechazado("Solo los guardias pueden validar QR.")
            if not guardia_usuario.activo:
                return _rechazado("Guardia desactivado.")

            try:
                guardia = Guardia.objects.select_related(
                    "ingreso__sede", "ingreso__facultad__sede"
                ).get(usuario=guardia_usuario)
            except Guardia.DoesNotExist:
                return _rechazado("No se encontró un guardia asociado a este usuario.")

            if guardia.ingreso.id_ingreso != id_ingreso:
                return _rechazado("No estás asignado a esta puerta de ingreso.")

            if not token_hash or not token_hash.strip():
                return _rechazado("Código QR vacío.")

            try:
                qr = QrToken.objects.select_related(
                    "usuario", "invitado", "invitado__facultad_destino__sede"
                ).get(
                    token_hash=token_hash.strip()
                )
            except QrToken.DoesNotExist:
                return _rechazado("QR no reconocido.")

            ahora = datetime.now(tz=timezone.utc)
            if qr.expira_en < ahora:
                return _rechazado("QR expirado. Genera un nuevo código.")

            try:
                ingreso = Ingreso.objects.select_related(
                    "sede", "facultad__sede"
                ).get(id_ingreso=id_ingreso)
            except Ingreso.DoesNotExist:
                return _rechazado("Punto de acceso no encontrado.")

            # Determinar la sede efectiva del portón
            from accesos.utils import (
                esta_adentro_sede,
                esta_adentro_sede_invitado,
                invitado_puede_acceder_sede,
                invitado_visita_completada,
                obtener_sede_de_ingreso,
                usuario_puede_acceder_sede,
            )
            sede_obj = obtener_sede_de_ingreso(ingreso)
            if not sede_obj:
                return _rechazado("Este portón no tiene sede asignada.")

            es_invitado = qr.invitado_id is not None

            # Invitado: el mismo QR sirve para entrar y salir (se invalida al salir).
            # Usuario UAGRM: QR de un solo uso por generación.
            if es_invitado and qr.usado:
                return _rechazado("Este QR ya fue utilizado.")
            if not es_invitado and qr.usado:
                return _rechazado("Este QR ya fue utilizado.")

            # ── Rama invitado ──────────────────────────────────────────────
            if qr.invitado:
                inv = qr.invitado
                if not inv.activo:
                    return _rechazado("Acceso no válido.")
                if inv.fecha_visita != date.today():
                    return _rechazado("Acceso no válido.")
                if not invitado_puede_acceder_sede(inv, sede_obj.id_sede):
                    return _rechazado("Acceso no válido.")
                if invitado_visita_completada(inv.id_invitado, sede_obj.id_sede):
                    return _rechazado("Acceso no válido.")

                ya_adentro = esta_adentro_sede_invitado(inv.id_invitado, sede_obj.id_sede)
                tipo_movimiento = "salida" if ya_adentro else "entrada"

                nombre = f"{inv.apellidos} {inv.nombres}"
                sede_nombre = sede_obj.nombre
                facultad_nombre = inv.facultad_destino.nombre
                carrera_nombre = ""
                tipo = "invitado"
                usuario_obj = None
                invitado_obj = inv

            # ── Rama usuario UAGRM ─────────────────────────────────────────
            else:
                u = qr.usuario
                if not u.activo:
                    return _rechazado("Acceso no válido.")

                if u.tipo_usuario == "personal_externo":
                    try:
                        pe = PersonalExterno.objects.select_related("empresa").get(usuario=u)
                        empresa = pe.empresa
                        hoy = date.today()
                        if not empresa.activo or not empresa.contrato_vigente:
                            return _rechazado("Acceso no válido.")
                        if empresa.contrato_hasta and empresa.contrato_hasta < hoy:
                            return _rechazado("Acceso no válido.")
                    except PersonalExterno.DoesNotExist:
                        return _rechazado("Acceso no válido.")

                if not usuario_puede_acceder_sede(u, sede_obj.id_sede):
                    return _rechazado("Acceso no válido.")

                ya_adentro = esta_adentro_sede(u.id_usuario, sede_obj.id_sede)
                tipo_movimiento = "salida" if ya_adentro else "entrada"

                nombre = _nombre_completo(u)
                sede_nombre, facultad_nombre, carrera_nombre = _datos_persona(u)
                tipo = u.tipo_usuario
                usuario_obj = u
                invitado_obj = None

            # ── Registrar ──────────────────────────────────────────────────
            if es_invitado:
                if tipo_movimiento == "salida":
                    qr.usado = True
                    qr.usado_en = ahora
                    qr.save()
            else:
                qr.usado = True
                qr.usado_en = ahora
                qr.save()

            # Actualizar ya_ingreso en invitados
            if invitado_obj and tipo_movimiento == "entrada":
                invitado_obj.ya_ingreso = True
                invitado_obj.save(update_fields=["ya_ingreso"])

            RegistroIngreso.objects.create(
                token=qr,
                ingreso=ingreso,
                guardia=guardia,
                sede_acceso=sede_obj,
                usuario=usuario_obj,
                invitado=invitado_obj,
                tipo_persona=tipo,
                tipo_movimiento=tipo_movimiento,
                metodo="qr",
                nombre_completo=nombre,
                sede_pertenece=sede_nombre,
                facultad_pertenece=facultad_nombre,
                carrera_pertenece=carrera_nombre,
                acceso_permitido=True,
            )

            if tipo_movimiento == "entrada":
                mensaje = f"Bienvenido/a, {nombre}"
            else:
                mensaje = f"Hasta luego, {nombre}"

            return ValidarQRResponseType(
                resultado="PERMITIDO",
                mensaje=mensaje,
                nombre=nombre,
                sede=sede_nombre,
                facultad=facultad_nombre,
                tipo_persona=tipo,
                tipo_movimiento=tipo_movimiento,
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
        email: str,
        celular: Optional[str] = None,
        horas_validez: int = 24,
    ) -> InvitadoRegistradoType:
        try:
            usuario = get_usuario_from_info(info)
            from usuarios.utils import usuario_puede_registrar_invitados
            if not usuario_puede_registrar_invitados(usuario):
                return InvitadoRegistradoType(
                    success=False,
                    message="No tienes permiso para registrar invitados. Solo docentes y administrativos con nivel jer?rquico autorizado pueden hacerlo.",
                    id_invitado=None, token_qr=None, expira_en=None,
                )
            if not nombres.strip() or not apellidos.strip() or not ci.strip():
                return InvitadoRegistradoType(
                    success=False, message="Nombres, apellidos y CI son requeridos.",
                    id_invitado=None, token_qr=None, expira_en=None,
                )
            if not email or not email.strip():
                return InvitadoRegistradoType(
                    success=False, message="El email del invitado es obligatorio para enviar el QR.",
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
                email=email.strip(),
                motivo_visita=motivo_visita,
                fecha_visita=fecha_visita,
                expira_en=expira_en,
            )

            ahora_reg = datetime.now(tz=timezone.utc)
            raw = f"inv-{invitado.id_invitado}-{ahora_reg}-{uuid4()}"
            token_hash = hashlib.sha256(raw.encode()).hexdigest()

            QrToken.objects.create(
                invitado=invitado,
                token_hash=token_hash,
                tipo_persona="invitado",
                tipo_movimiento="entrada",  # placeholder; se resuelve al escanear
                expira_en=expira_en,
            )

            # Enviar email con un solo QR — soporta múltiples correos separados por coma
            from accesos.email_utils import enviar_email_invitado
            registrado_por_nombre = f"{usuario.nombres} {usuario.apellidos}"
            destinatarios = [e.strip() for e in email.split(",") if e.strip()]
            emails_ok = []
            emails_fail = []
            for dest in destinatarios:
                ok = enviar_email_invitado(
                    email_destino=dest,
                    nombre_invitado=f"{nombres.strip()} {apellidos.strip()}",
                    registrado_por=registrado_por_nombre,
                    facultad_destino=facultad.nombre,
                    motivo_visita=motivo_visita,
                    fecha_visita=str(fecha_visita),
                    token_hash=token_hash,
                    expira_en=expira_en,
                )
                (emails_ok if ok else emails_fail).append(dest)

            email_enviado = len(emails_ok) > 0
            destinos_str = ", ".join(emails_ok) if emails_ok else email.strip()
            msg = f"Invitado {apellidos} {nombres} registrado correctamente."
            if emails_ok:
                msg += f" QR enviado a: {destinos_str}."
            if emails_fail:
                msg += f" No se pudo enviar a: {', '.join(emails_fail)}."

            return InvitadoRegistradoType(
                success=True,
                message=msg,
                id_invitado=invitado.id_invitado,
                token_qr=token_hash,
                expira_en=expira_en,
                email_enviado=email_enviado,
                email_destino=destinos_str,
            )
        except Exception as e:
            return InvitadoRegistradoType(
                success=False, message=f"Error al registrar invitado: {str(e)}",
                id_invitado=None, token_qr=None, expira_en=None,
            )

    @strawberry.mutation
    def cancelar_invitado(self, info, id_invitado: int) -> ResponseType:
        """Cancela (desactiva) un invitado registrado por el usuario autenticado."""
        try:
            usuario = get_usuario_from_info(info)
            try:
                invitado = Invitado.objects.get(id_invitado=id_invitado)
            except Invitado.DoesNotExist:
                return ResponseType(success=False, message="Invitado no encontrado.")
            if invitado.registrado_por_id != usuario.id_usuario:
                return ResponseType(success=False, message="No puedes cancelar un invitado que no registraste.")
            if not invitado.activo:
                return ResponseType(success=False, message="El invitado ya esta cancelado.")
            if invitado.ya_ingreso:
                return ResponseType(success=False, message="El invitado ya ingreso, no se puede cancelar.")
            invitado.activo = False
            invitado.save(update_fields=["activo"])
            # Invalidar el QR del invitado si aún no fue usado
            QrToken.objects.filter(invitado=invitado, usado=False).update(usado=True)
            return ResponseType(
                success=True,
                message=f"Invitado {invitado.apellidos} {invitado.nombres} cancelado correctamente."
            )
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def registrar_acceso_manual(
        self,
        info,
        ci: str,
        id_ingreso: int,
        tipo_movimiento: Optional[str] = None,
    ) -> AccesoManualResponseType:
        """
        Registro manual de acceso por el guardia cuando el lector QR falla.
        Busca al usuario por CI y registra entrada o salida automáticamente
        según si ya está adentro de la sede del portón.
        """
        def _rechazar_manual(msg: str) -> AccesoManualResponseType:
            return AccesoManualResponseType(
                resultado="RECHAZADO", mensaje=msg,
                nombre=None, ci=None, tipo_persona=None,
                tipo_movimiento=None, sede=None, facultad=None,
            )

        try:
            guardia_usuario = get_usuario_from_info(info)
            if guardia_usuario.rol.nombre != "guardia":
                return _rechazar_manual("Solo los guardias pueden usar esta función.")
            if not guardia_usuario.activo:
                return _rechazar_manual("Guardia desactivado.")

            try:
                guardia = Guardia.objects.select_related(
                    "ingreso__sede", "ingreso__facultad__sede"
                ).get(usuario=guardia_usuario)
            except Guardia.DoesNotExist:
                return _rechazar_manual("No se encontró un guardia asociado a este usuario.")

            if guardia.ingreso.id_ingreso != id_ingreso:
                return _rechazar_manual("No estás asignado a esta puerta de ingreso.")

            if not ci or not ci.strip():
                return _rechazar_manual("CI requerido.")

            ci = ci.strip()

            try:
                ingreso = Ingreso.objects.select_related(
                    "sede", "facultad__sede"
                ).get(id_ingreso=id_ingreso)
            except Ingreso.DoesNotExist:
                return _rechazar_manual("Punto de acceso no encontrado.")

            from accesos.utils import (
                esta_adentro_sede,
                obtener_sede_de_ingreso,
                usuario_puede_acceder_sede,
            )
            from usuarios.models import Usuario

            sede_obj = obtener_sede_de_ingreso(ingreso)
            if not sede_obj:
                return _rechazar_manual("Este portón no tiene sede asignada.")

            try:
                u = Usuario.objects.get(ci=ci)
            except Usuario.DoesNotExist:
                return _rechazar_manual(f"No se encontró ningún usuario con CI {ci}.")

            if not u.activo:
                return _rechazar_manual("El usuario está desactivado.")

            if u.rol.nombre == "guardia":
                return _rechazar_manual("Acción no permitida.")

            if not usuario_puede_acceder_sede(u, sede_obj.id_sede):
                return _rechazar_manual("Acceso no válido en esta sede.")

            ya_adentro = esta_adentro_sede(u.id_usuario, sede_obj.id_sede)
            if tipo_movimiento and tipo_movimiento not in ("entrada", "salida"):
                return _rechazar_manual("Tipo de movimiento inválido.")
            tipo_movimiento = tipo_movimiento or ("salida" if ya_adentro else "entrada")
            if tipo_movimiento == "entrada" and ya_adentro:
                return _rechazar_manual("El usuario ya se encuentra dentro de la sede.")
            if tipo_movimiento == "salida" and not ya_adentro:
                return _rechazar_manual("El usuario no tiene registro de entrada en esta sede.")

            nombre = _nombre_completo(u)
            sede_nombre, facultad_nombre, carrera_nombre = _datos_persona(u)

            ahora = datetime.now(tz=timezone.utc)
            RegistroIngreso.objects.create(
                token=None,
                ingreso=ingreso,
                guardia=guardia,
                sede_acceso=sede_obj,
                usuario=u,
                invitado=None,
                tipo_persona=u.tipo_usuario,
                tipo_movimiento=tipo_movimiento,
                metodo="manual",
                nombre_completo=nombre,
                sede_pertenece=sede_nombre,
                facultad_pertenece=facultad_nombre,
                carrera_pertenece=carrera_nombre,
                acceso_permitido=True,
            )

            mensaje = f"Bienvenido/a, {nombre}" if tipo_movimiento == "entrada" else f"Hasta luego, {nombre}"
            return AccesoManualResponseType(
                resultado="PERMITIDO",
                mensaje=mensaje,
                nombre=nombre,
                ci=ci,
                tipo_persona=u.tipo_usuario,
                tipo_movimiento=tipo_movimiento,
                sede=sede_nombre,
                facultad=facultad_nombre,
            )
        except Exception as e:
            return AccesoManualResponseType(
                resultado="RECHAZADO",
                mensaje=f"Error interno: {str(e)}",
                nombre=None, ci=None, tipo_persona=None,
                tipo_movimiento=None, sede=None, facultad=None,
            )

    @strawberry.mutation
    def registrar_acceso_logistico(
        self,
        info,
        ci: str,
        nombre_completo: str,
        motivo: str,
        tipo_movimiento: str,
        id_ingreso: int,
    ) -> AccesoLogisticoResponseType:
        """
        Registro rápido para delivery, proveedores y visitantes sin cuenta en el sistema.
        No requiere QR ni búsqueda de usuario.
        """
        def _error_log(msg: str) -> AccesoLogisticoResponseType:
            return AccesoLogisticoResponseType(
                resultado="ERROR", mensaje=msg,
                nombre=None, ci=None, tipo_movimiento=None,
            )

        try:
            guardia_usuario = get_usuario_from_info(info)
            if guardia_usuario.rol.nombre != "guardia":
                return _error_log("Solo los guardias pueden usar esta función.")
            if not guardia_usuario.activo:
                return _error_log("Guardia desactivado.")

            try:
                guardia = Guardia.objects.select_related(
                    "ingreso__sede", "ingreso__facultad__sede"
                ).get(usuario=guardia_usuario)
            except Guardia.DoesNotExist:
                return _error_log("No se encontró un guardia asociado a este usuario.")

            if guardia.ingreso.id_ingreso != id_ingreso:
                return _error_log("No estás asignado a esta puerta de ingreso.")

            if tipo_movimiento not in ("entrada", "salida"):
                return _error_log("Tipo de movimiento inválido.")

            if not ci.strip() or not nombre_completo.strip() or not motivo.strip():
                return _error_log("CI, nombre y motivo son requeridos.")

            try:
                ingreso = Ingreso.objects.select_related(
                    "sede", "facultad__sede"
                ).get(id_ingreso=id_ingreso)
            except Ingreso.DoesNotExist:
                return _error_log("Punto de acceso no encontrado.")

            from accesos.utils import obtener_sede_de_ingreso
            sede_obj = obtener_sede_de_ingreso(ingreso)

            RegistroIngreso.objects.create(
                token=None,
                ingreso=ingreso,
                guardia=guardia,
                sede_acceso=sede_obj,
                usuario=None,
                invitado=None,
                tipo_persona="logistico",
                tipo_movimiento=tipo_movimiento,
                metodo="logistico",
                nombre_completo=nombre_completo.strip(),
                ci_logistico=ci.strip(),
                motivo_logistico=motivo.strip(),
                sede_pertenece=sede_obj.nombre if sede_obj else "",
                facultad_pertenece="",
                carrera_pertenece="",
                acceso_permitido=True,
            )

            accion = "registrada" if tipo_movimiento == "entrada" else "registrada"
            return AccesoLogisticoResponseType(
                resultado="REGISTRADO",
                mensaje=f"{tipo_movimiento.capitalize()} {accion}: {nombre_completo.strip()}",
                nombre=nombre_completo.strip(),
                ci=ci.strip(),
                tipo_movimiento=tipo_movimiento,
            )
        except Exception as e:
            return AccesoLogisticoResponseType(
                resultado="ERROR",
                mensaje=f"Error interno: {str(e)}",
                nombre=None, ci=None, tipo_movimiento=None,
            )

    @strawberry.mutation
    def asignar_guardia(
        self,
        info,
        id_usuario: int,
        id_ingreso: int,
        turno: str = "jornada",
    ) -> ResponseType:
        """
        Crea o actualiza la asignación de un guardia a un portón.
        Solo admins. El turno puede ser: jornada, manana, tarde, noche.
        """
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso.")

            from usuarios.models import Usuario
            try:
                u = Usuario.objects.select_related("rol").get(id_usuario=id_usuario)
            except Usuario.DoesNotExist:
                return ResponseType(success=False, message="Usuario no encontrado.")

            if u.rol.nombre != "guardia":
                return ResponseType(success=False, message="El usuario no tiene rol de guardia.")

            if turno not in ("jornada", "manana", "tarde", "noche"):
                return ResponseType(success=False, message="Turno inválido.")

            try:
                ingreso = Ingreso.objects.get(id_ingreso=id_ingreso)
            except Ingreso.DoesNotExist:
                return ResponseType(success=False, message="Portón no encontrado.")

            guardia, created = Guardia.objects.update_or_create(
                usuario=u,
                defaults={"ingreso": ingreso, "turno": turno},
            )

            accion = "asignado" if created else "actualizado"
            return ResponseType(
                success=True,
                message=f"Guardia {u.apellidos} {u.nombres} {accion} al portón '{ingreso.nombre}' ({turno}).",
            )
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def desasignar_guardia(self, info, id_usuario: int) -> ResponseType:
        """Elimina la asignación de portón de un guardia."""
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso.")

            from usuarios.models import Usuario
            try:
                u = Usuario.objects.select_related("rol").get(id_usuario=id_usuario)
            except Usuario.DoesNotExist:
                return ResponseType(success=False, message="Usuario no encontrado.")

            deleted, _ = Guardia.objects.filter(usuario=u).delete()
            if deleted:
                return ResponseType(success=True, message=f"Asignación de {u.apellidos} {u.nombres} eliminada.")
            return ResponseType(success=False, message="Este guardia no tenía portón asignado.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

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
                return ResponseType(success=False, message="No tienes permiso para esta acci?n.")
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
                sede=facultad.sede if facultad.sede_id else None,
            )
            return ResponseType(success=True, message=f"Puerta '{nombre}' creada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error al crear puerta: {str(e)}")
