import json
import re
from typing import List, Optional, Tuple

import pyotp
import strawberry

from usuarios.models import (
    Administrativo,
    Carrera,
    Docente,
    Estudiante,
    EmpresaExterna,
    Facultad,
    FotoRostro,
    PersonalExterno,
    Rol,
    Sede,
    Usuario,
)
from usuarios.types import (
    Activar2FAType,
    AuthType,
    CrearUsuarioResponseType,
    FotoPerfilResponseType,
    FotoRostroInput,
    FotoRostroType,
    PasswordResetResponseType,
    RegistroRostroResponseType,
    ResponseType,
    Verificar2FAResponseType,
)
from usuarios.password_policy import (
    MAX_LOGIN_ATTEMPTS,
    LOCKOUT_SECONDS,
    intentos_restantes_login,
    limpiar_bloqueo_login,
    mensaje_cuenta_bloqueada,
    registrar_fallo_login,
    segundos_bloqueo_restante,
    validar_politica_password,
)
from usuarios.email_reset import enviar_email_recuperacion_password
from usuarios.face_storage import (
    ANGULOS_ROSTRO,
    eliminar_archivo_rostro,
    guardar_foto_perfil,
    guardar_foto_rostro,
)
from usuarios.face_matching import validar_descriptor
from usuarios.password_reset import (
    MENSAJE_SOLICITUD_GENERICO,
    MAX_SOLICITUDES_POR_HORA,
    RESET_TOKEN_MINUTES,
    buscar_usuario_recuperacion,
    crear_solicitud_reset,
    marcar_token_usado,
    solicitudes_recientes,
    validar_token_recuperacion,
)
from usuarios.utils import (
    decode_partial_token,
    generate_partial_token,
    generate_token,
    get_usuario_from_info,
    hash_password,
    password_needs_rehash,
    verify_password,
)

def _validar_email(email: str) -> bool:
    return bool(re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email))


MAX_VINCULOS_DOCENTE = 30


def _parse_vinculos_docente(
    vinculos_json: Optional[str],
) -> Tuple[List[Tuple[int, Optional[int]]], Optional[str]]:
    """Parsea JSON de vinculaciones docente: [{id_facultad, id_carrera?}, ...]."""
    if not vinculos_json or not vinculos_json.strip():
        return [], "Debe registrar al menos una facultad para el docente."

    try:
        raw = json.loads(vinculos_json)
    except json.JSONDecodeError:
        return [], "Formato de vinculacion academica invalido."

    if not isinstance(raw, list):
        return [], "Formato de vinculacion academica invalido."

    if len(raw) > MAX_VINCULOS_DOCENTE:
        return [], f"Maximo {MAX_VINCULOS_DOCENTE} vinculaciones academicas por docente."

    result: List[Tuple[int, Optional[int]]] = []
    seen: set = set()

    for item in raw:
        if not isinstance(item, dict):
            return [], "Formato de vinculacion academica invalido."
        id_fac = item.get("id_facultad")
        if not id_fac:
            continue
        id_car = item.get("id_carrera") or None
        try:
            id_fac_int = int(id_fac)
            id_car_int = int(id_car) if id_car else None
        except (TypeError, ValueError):
            return [], "Facultad o carrera invalida en vinculacion academica."

        key = (id_fac_int, id_car_int)
        if key in seen:
            return [], "Hay vinculaciones academicas duplicadas (misma facultad y carrera)."
        seen.add(key)
        result.append(key)

    if not result:
        return [], "Debe registrar al menos una facultad para el docente."

    return result, None


def _sync_vinculos_docente(
    usuario: Usuario,
    vinculos: List[Tuple[int, Optional[int]]],
) -> Optional[str]:
    from accesos.models import PersonaFacultad

    resolved: List[Tuple[Facultad, Optional[Carrera]]] = []
    for id_fac, id_car in vinculos:
        try:
            facultad = Facultad.objects.get(id_facultad=id_fac)
        except Facultad.DoesNotExist:
            return f"Facultad con id {id_fac} no encontrada."

        carrera_obj = None
        if id_car:
            try:
                carrera_obj = Carrera.objects.get(id_carrera=id_car)
            except Carrera.DoesNotExist:
                return f"Carrera con id {id_car} no encontrada."
            if carrera_obj.facultad_id != facultad.id_facultad:
                return (
                    f"La carrera {carrera_obj.nombre} no pertenece "
                    f"a la facultad {facultad.nombre}."
                )
        resolved.append((facultad, carrera_obj))

    new_keys = {
        (f.id_facultad, c.id_carrera if c else None)
        for f, c in resolved
    }

    for pf in PersonaFacultad.objects.filter(usuario=usuario, tipo_vinculo="docente"):
        key = (pf.facultad_id, pf.carrera_id)
        if key not in new_keys:
            pf.delete()

    for facultad, carrera_obj in resolved:
        PersonaFacultad.objects.get_or_create(
            usuario=usuario,
            facultad=facultad,
            carrera=carrera_obj,
            tipo_vinculo="docente",
            defaults={"activo": True},
        )

    return None


def _auth_vacio(**kwargs) -> AuthType:
    defaults = {
        "cuenta_bloqueada": False,
        "segundos_bloqueo": None,
        "intentos_restantes": None,
        "max_intentos": MAX_LOGIN_ATTEMPTS,
    }
    defaults.update(kwargs)
    return AuthType(
        token="",
        tipo_usuario="",
        rol="",
        nombres="",
        apellidos="",
        needs2fa=False,
        partial_token=None,
        **defaults,
    )


def _auth_bloqueado(usuario, message: str | None = None) -> AuthType:
    segundos = segundos_bloqueo_restante(usuario) or LOCKOUT_SECONDS
    return _auth_vacio(
        message=message or mensaje_cuenta_bloqueada(usuario) or "Cuenta bloqueada.",
        cuenta_bloqueada=True,
        segundos_bloqueo=segundos,
        intentos_restantes=0,
    )


def _auth_fallo_credenciales(usuario) -> AuthType:
    segundos = segundos_bloqueo_restante(usuario)
    if segundos is not None:
        return _auth_bloqueado(
            usuario,
            f"Demasiados intentos fallidos. Cuenta bloqueada por {LOCKOUT_SECONDS} segundos.",
        )
    restantes = intentos_restantes_login(usuario)
    if restantes <= 1:
        aviso = "Último intento antes del bloqueo temporal."
    else:
        aviso = f"Te quedan {restantes} intento(s) antes del bloqueo."
    return _auth_vacio(
        message=f"CI o contraseña incorrectos. {aviso}",
        intentos_restantes=restantes,
    )


_LOGIN_FAIL_MSG = "CI o contraseña incorrectos."


def _aplicar_login_exitoso(usuario: Usuario, password_plano: str) -> None:
    usuario.intentos_fallidos_login = 0
    usuario.bloqueado_hasta = None
    updates = ["intentos_fallidos_login", "bloqueado_hasta"]
    if password_needs_rehash(usuario.password_hash):
        usuario.password_hash = hash_password(password_plano)
        updates.append("password_hash")
    usuario.save(update_fields=updates)


@strawberry.type
class UsuarioMutation:

    @strawberry.mutation
    def login(self, ci: str, password: str, tipo_usuario: str) -> AuthType:
        try:
            if not ci.strip() or not password.strip():
                return _auth_vacio(message="CI y contraseña son requeridos.")

            try:
                usuario = Usuario.objects.select_related("rol").get(
                    ci=ci.strip(), tipo_usuario=tipo_usuario
                )
            except Usuario.DoesNotExist:
                return _auth_vacio(message=_LOGIN_FAIL_MSG)

            bloqueo = mensaje_cuenta_bloqueada(usuario)
            if bloqueo:
                return _auth_bloqueado(usuario, bloqueo)

            if not usuario.activo:
                return _auth_vacio(message="Usuario desactivado. Contacte al administrador.")

            if not verify_password(password, usuario.password_hash):
                registrar_fallo_login(usuario)
                usuario.refresh_from_db(fields=["intentos_fallidos_login", "bloqueado_hasta"])
                return _auth_fallo_credenciales(usuario)

            _aplicar_login_exitoso(usuario, password)

            rol_nombre = usuario.rol.nombre

            # Si tiene 2FA activo (opcional para todos los roles) → pedir segundo paso
            if usuario.totp_activo:
                partial = generate_partial_token(usuario)
                return AuthType(
                    token="",
                    tipo_usuario=usuario.tipo_usuario,
                    rol=rol_nombre,
                    nombres=usuario.nombres,
                    apellidos=usuario.apellidos,
                    message="Se requiere verificación en dos pasos.",
                    needs2fa=True,
                    partial_token=partial,
                )

            token = generate_token(usuario)
            return AuthType(
                token=token,
                tipo_usuario=usuario.tipo_usuario,
                rol=rol_nombre,
                nombres=usuario.nombres,
                apellidos=usuario.apellidos,
                message="Login exitoso.",
                needs2fa=False,
            )
        except Exception as e:
            return _auth_vacio(message=f"Error interno: {str(e)}")

    @strawberry.mutation
    def verificar_login_2fa(self, partial_token: str, codigo: str) -> Verificar2FAResponseType:
        _vacio = Verificar2FAResponseType(token="", tipo_usuario="", rol="", nombres="", apellidos="", message="")
        try:
            payload = decode_partial_token(partial_token)
            try:
                usuario = Usuario.objects.select_related("rol").get(
                    id_usuario=payload["id_usuario"], activo=True
                )
            except Usuario.DoesNotExist:
                return Verificar2FAResponseType(**{**_vacio.__dict__, "message": "Usuario no encontrado."})

            if not usuario.totp_secret:
                return Verificar2FAResponseType(**{**_vacio.__dict__, "message": "2FA no configurado."})

            totp = pyotp.TOTP(usuario.totp_secret)
            if not totp.verify(codigo.strip(), valid_window=1):
                return Verificar2FAResponseType(**{**_vacio.__dict__, "message": "Código incorrecto. Intente nuevamente."})

            limpiar_bloqueo_login(usuario)
            token = generate_token(usuario)
            return Verificar2FAResponseType(
                token=token,
                tipo_usuario=usuario.tipo_usuario,
                rol=usuario.rol.nombre,
                nombres=usuario.nombres,
                apellidos=usuario.apellidos,
                message="Verificación exitosa.",
            )
        except Exception as e:
            return Verificar2FAResponseType(**{**_vacio.__dict__, "message": str(e)})

    @strawberry.mutation
    def activar_2fa(self, info) -> Activar2FAType:
        try:
            usuario = get_usuario_from_info(info)
            if usuario.totp_activo:
                return Activar2FAType(secret="", qr_url="", message="El 2FA ya está activo en tu cuenta.")

            secret = pyotp.random_base32()
            usuario.totp_secret = secret
            usuario.save(update_fields=["totp_secret"])

            totp = pyotp.TOTP(secret)
            nombre_cuenta = f"UAGRM:{usuario.ci}"
            qr_url = totp.provisioning_uri(name=nombre_cuenta, issuer_name="UAGRM Control Peatonal")

            return Activar2FAType(
                secret=secret,
                qr_url=qr_url,
                message="Escanea el código QR con Google Authenticator y confirma con el código generado.",
            )
        except Exception as e:
            return Activar2FAType(secret="", qr_url="", message=f"Error: {str(e)}")

    @strawberry.mutation
    def confirmar_2fa(self, info, codigo: str) -> ResponseType:
        try:
            usuario = get_usuario_from_info(info)
            if not usuario.totp_secret:
                return ResponseType(success=False, message="Primero genera el QR con activar2fa.")
            if usuario.totp_activo:
                return ResponseType(success=False, message="El 2FA ya está activo.")

            totp = pyotp.TOTP(usuario.totp_secret)
            if not totp.verify(codigo.strip(), valid_window=1):
                return ResponseType(success=False, message="Código incorrecto. Verifique el código de Google Authenticator.")

            usuario.totp_activo = True
            usuario.save(update_fields=["totp_activo"])
            return ResponseType(success=True, message="¡Verificación en dos pasos activada correctamente!")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def desactivar_2fa(self, info, codigo: str) -> ResponseType:
        try:
            usuario = get_usuario_from_info(info)
            if not usuario.totp_activo:
                return ResponseType(success=False, message="El 2FA no está activo.")

            totp = pyotp.TOTP(usuario.totp_secret)
            if not totp.verify(codigo.strip(), valid_window=1):
                return ResponseType(success=False, message="Código incorrecto.")

            usuario.totp_activo = False
            usuario.totp_secret = None
            usuario.save(update_fields=["totp_activo", "totp_secret"])
            return ResponseType(success=True, message="Verificación en dos pasos desactivada.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def activar_2fa_obligatorio(self, partial_token: str, codigo: str) -> ResponseType:
        """Legacy: confirma activación de 2FA con token parcial (ya no es obligatorio)."""
        try:
            payload = decode_partial_token(partial_token)
            try:
                usuario = Usuario.objects.select_related("rol").get(
                    id_usuario=payload["id_usuario"], activo=True
                )
            except Usuario.DoesNotExist:
                return ResponseType(success=False, message="Usuario no encontrado.")

            if not usuario.totp_secret:
                return ResponseType(success=False, message="Primero genera el QR de configuración.")

            totp = pyotp.TOTP(usuario.totp_secret)
            if not totp.verify(codigo.strip(), valid_window=1):
                return ResponseType(success=False, message="Código incorrecto.")

            usuario.totp_activo = True
            usuario.save(update_fields=["totp_activo"])
            return ResponseType(success=True, message="2FA activado. Ya puedes iniciar sesión.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def generar_qr_obligatorio(self, partial_token: str) -> Activar2FAType:
        """Legacy: genera QR con token parcial (2FA ya no es obligatorio en el login)."""
        try:
            payload = decode_partial_token(partial_token)
            usuario = Usuario.objects.get(id_usuario=payload["id_usuario"], activo=True)

            secret = pyotp.random_base32()
            usuario.totp_secret = secret
            usuario.save(update_fields=["totp_secret"])

            totp = pyotp.TOTP(secret)
            qr_url = totp.provisioning_uri(
                name=f"UAGRM:{usuario.ci}",
                issuer_name="UAGRM Control Peatonal"
            )
            return Activar2FAType(
                secret=secret,
                qr_url=qr_url,
                message="Escanea este QR con Google Authenticator y confirma con el código.",
            )
        except Exception as e:
            return Activar2FAType(secret="", qr_url="", message=f"Error: {str(e)}")

    @strawberry.mutation
    def crear_usuario(
        self, info, tipo_usuario: str, nombres: str, apellidos: str,
        ci: str, password: str, email: Optional[str] = None, celular: Optional[str] = None,
        rol: Optional[str] = None, nro_registro: Optional[str] = None,
        codigo_docente: Optional[str] = None, especialidad: Optional[str] = None,
        categoria: Optional[str] = None, codigo_admin: Optional[str] = None,
        nivel_jerarquico_admin: Optional[str] = None,
        codigo_direccion_admin: Optional[str] = None,
        id_facultad_admin: Optional[int] = None,
        cargo: Optional[str] = None, area: Optional[str] = None,
        empresa: Optional[str] = None, turno: Optional[str] = None,
        id_ingreso: Optional[int] = None,
        id_carrera_1: Optional[int] = None, paralelo_1: Optional[str] = None,
        modalidad_1: Optional[str] = None, periodo_1: Optional[str] = None,
        id_carrera_2: Optional[int] = None, paralelo_2: Optional[str] = None,
        modalidad_2: Optional[str] = None, periodo_2: Optional[str] = None,
        vinculos_docente: Optional[str] = None,
    ) -> CrearUsuarioResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return CrearUsuarioResponseType(ok=False, message="No tienes permiso para esta acción.")

            if not ci or len(ci.strip()) < 6:
                return CrearUsuarioResponseType(ok=False, message="El CI debe tener al menos 6 caracteres.")
            if not password:
                return CrearUsuarioResponseType(ok=False, message="La contraseña es requerida.")
            ok_pass, msg_pass = validar_politica_password(password)
            if not ok_pass:
                return CrearUsuarioResponseType(ok=False, message=msg_pass)
            if not nombres or not nombres.strip():
                return CrearUsuarioResponseType(ok=False, message="El nombre es requerido.")
            if not apellidos or not apellidos.strip():
                return CrearUsuarioResponseType(ok=False, message="El apellido es requerido.")
            if email and not _validar_email(email):
                return CrearUsuarioResponseType(ok=False, message="El formato del email no es válido.")
            if tipo_usuario == "estudiante" and not nro_registro:
                return CrearUsuarioResponseType(ok=False, message="El número de registro es obligatorio para estudiantes.")
            if tipo_usuario == "docente" and not codigo_docente:
                return CrearUsuarioResponseType(ok=False, message="El código de docente es obligatorio.")
            vinculos_docente_parsed: List[Tuple[int, Optional[int]]] = []
            if tipo_usuario == "docente":
                vinculos_docente_parsed, err_vinc = _parse_vinculos_docente(vinculos_docente)
                if err_vinc:
                    return CrearUsuarioResponseType(ok=False, message=err_vinc)
            if tipo_usuario == "administrativo" and not codigo_admin:
                return CrearUsuarioResponseType(ok=False, message="El código administrativo es obligatorio.")
            if tipo_usuario == "personal_externo" and not empresa:
                return CrearUsuarioResponseType(ok=False, message="La empresa es obligatoria para personal externo.")
            if tipo_usuario == "guardia":
                return CrearUsuarioResponseType(
                    ok=False,
                    message="Los guardias se registran como Personal Externo con rol Guardia.",
                )

            nombre_rol = rol or "usuario"
            if nombre_rol == "guardia" and tipo_usuario != "personal_externo":
                return CrearUsuarioResponseType(
                    ok=False,
                    message="Los guardias deben ser de tipo Personal Externo.",
                )
            if nombre_rol == "guardia":
                if not id_ingreso:
                    return CrearUsuarioResponseType(ok=False, message="El portón de ingreso es obligatorio para guardias.")

            if Usuario.objects.filter(ci=ci.strip(), tipo_usuario=tipo_usuario).exists():
                return CrearUsuarioResponseType(ok=False, message=f"Ya existe un usuario {tipo_usuario} con ese CI.")

            nombre_rol = rol or "usuario"
            try:
                rol_obj = Rol.objects.get(nombre=nombre_rol)
            except Rol.DoesNotExist:
                return CrearUsuarioResponseType(ok=False, message=f"Rol '{nombre_rol}' no encontrado.")

            usuario = Usuario.objects.create(
                rol=rol_obj, tipo_usuario=tipo_usuario,
                nombres=nombres.strip(), apellidos=apellidos.strip(),
                ci=ci.strip(), email=email.strip() if email else "",
                password_hash=hash_password(password), celular=celular,
            )

            if tipo_usuario == "estudiante":
                Estudiante.objects.create(usuario=usuario, nro_registro=nro_registro)
                from accesos.models import PersonaFacultad
                carreras_input = [
                    (id_carrera_1, paralelo_1, modalidad_1, periodo_1),
                    (id_carrera_2, paralelo_2, modalidad_2, periodo_2),
                ]
                for id_car, paralelo, modalidad, periodo in carreras_input:
                    if not id_car:
                        continue
                    try:
                        carrera_obj = Carrera.objects.select_related("facultad").get(id_carrera=id_car)
                    except Carrera.DoesNotExist:
                        usuario.delete()
                        return CrearUsuarioResponseType(ok=False, message=f"Carrera con id {id_car} no encontrada.")
                    PersonaFacultad.objects.get_or_create(
                        usuario=usuario,
                        facultad=carrera_obj.facultad,
                        carrera=carrera_obj,
                        tipo_vinculo="estudiante",
                        defaults={
                            "paralelo": paralelo or "",
                            "modalidad_ingreso": modalidad or None,
                            "periodo_ingreso": periodo or None,
                        },
                    )
            elif tipo_usuario == "docente":
                Docente.objects.create(usuario=usuario, codigo_docente=codigo_docente,
                    especialidad=especialidad, categoria=categoria)
                err_sync = _sync_vinculos_docente(usuario, vinculos_docente_parsed)
                if err_sync:
                    usuario.delete()
                    return CrearUsuarioResponseType(ok=False, message=err_sync)
            elif tipo_usuario == "administrativo":
                fac_admin = None
                if id_facultad_admin:
                    try:
                        fac_admin = Facultad.objects.get(id_facultad=id_facultad_admin)
                    except Facultad.DoesNotExist:
                        usuario.delete()
                        return CrearUsuarioResponseType(ok=False, message="Facultad no encontrada para el administrativo.")
                Administrativo.objects.create(
                    usuario=usuario,
                    codigo_admin=codigo_admin,
                    nivel_jerarquico=nivel_jerarquico_admin or "apoyo_secretarial",
                    facultad=fac_admin,
                    codigo_direccion=codigo_direccion_admin or None,
                    cargo=cargo,
                    area=area,
                )
            elif tipo_usuario == "personal_externo" and empresa:
                try:
                    emp = EmpresaExterna.objects.get(nombre__icontains=empresa)
                    if not emp.activo:
                        usuario.delete()
                        return CrearUsuarioResponseType(ok=False, message=f"La empresa '{emp.nombre}' está desactivada.")
                    from accesos.models import Guardia, Ingreso
                    horario_guardia = "07:00-22:00"
                    PersonalExterno.objects.create(
                        usuario=usuario,
                        empresa=emp,
                        cargo=cargo or ("Guardia de seguridad" if nombre_rol == "guardia" else ""),
                        horario=horario_guardia if nombre_rol == "guardia" else None,
                    )
                    if nombre_rol == "guardia":
                        try:
                            ingreso = Ingreso.objects.get(id_ingreso=id_ingreso)
                        except Ingreso.DoesNotExist:
                            usuario.delete()
                            return CrearUsuarioResponseType(ok=False, message="Portón de ingreso no encontrado.")
                        Guardia.objects.create(
                            usuario=usuario,
                            ingreso=ingreso,
                            turno=Guardia.TURNO_DEFAULT,
                        )
                except EmpresaExterna.DoesNotExist:
                    usuario.delete()
                    return CrearUsuarioResponseType(ok=False, message=f"Empresa '{empresa}' no encontrada.")

            return CrearUsuarioResponseType(
                ok=True, message=f"Usuario {nombres} {apellidos} creado correctamente.",
                id_usuario=usuario.id_usuario,
            )
        except Exception as e:
            return CrearUsuarioResponseType(ok=False, message=f"Error al crear usuario: {str(e)}")

    @strawberry.mutation
    def actualizar_usuario(
        self, info, id_usuario: int, nombres: str, apellidos: str,
        ci: str, email: Optional[str] = None, celular: Optional[str] = None,
        password: Optional[str] = None, rol: Optional[str] = None,
        nro_registro: Optional[str] = None,
        codigo_docente: Optional[str] = None,
        especialidad: Optional[str] = None, categoria: Optional[str] = None,
        codigo_admin: Optional[str] = None,
        nivel_jerarquico_admin: Optional[str] = None,
        codigo_direccion_admin: Optional[str] = None,
        id_facultad_admin: Optional[int] = None,
        cargo: Optional[str] = None, area: Optional[str] = None,
        empresa: Optional[str] = None,
        turno: Optional[str] = None, id_ingreso: Optional[int] = None,
        id_carrera_1: Optional[int] = None, paralelo_1: Optional[str] = None,
        modalidad_1: Optional[str] = None, periodo_1: Optional[str] = None,
        id_carrera_2: Optional[int] = None, paralelo_2: Optional[str] = None,
        modalidad_2: Optional[str] = None, periodo_2: Optional[str] = None,
        vinculos_docente: Optional[str] = None,
    ) -> CrearUsuarioResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return CrearUsuarioResponseType(ok=False, message="No tienes permiso para esta acción.")

            try:
                usuario = Usuario.objects.select_related("rol").get(id_usuario=id_usuario)
            except Usuario.DoesNotExist:
                return CrearUsuarioResponseType(ok=False, message="Usuario no encontrado.")

            tipo_usuario = usuario.tipo_usuario

            if not ci or len(ci.strip()) < 6:
                return CrearUsuarioResponseType(ok=False, message="El CI debe tener al menos 6 caracteres.")
            if password:
                ok_pass, msg_pass = validar_politica_password(password)
                if not ok_pass:
                    return CrearUsuarioResponseType(ok=False, message=msg_pass)
            if not nombres or not nombres.strip():
                return CrearUsuarioResponseType(ok=False, message="El nombre es requerido.")
            if not apellidos or not apellidos.strip():
                return CrearUsuarioResponseType(ok=False, message="El apellido es requerido.")
            if email and not _validar_email(email):
                return CrearUsuarioResponseType(ok=False, message="El formato del email no es válido.")

            if Usuario.objects.filter(ci=ci.strip()).exclude(id_usuario=id_usuario).exists():
                return CrearUsuarioResponseType(ok=False, message="Ya existe otro usuario con ese CI.")
            if email and Usuario.objects.filter(email=email.strip()).exclude(id_usuario=id_usuario).exists():
                return CrearUsuarioResponseType(ok=False, message="Ya existe otro usuario con ese email.")

            nombre_rol = rol or usuario.rol.nombre
            if nombre_rol == "guardia" and tipo_usuario != "personal_externo":
                return CrearUsuarioResponseType(
                    ok=False, message="Los guardias deben ser de tipo Personal Externo.",
                )
            if nombre_rol == "guardia":
                if not id_ingreso:
                    return CrearUsuarioResponseType(ok=False, message="El portón de ingreso es obligatorio para guardias.")

            if tipo_usuario == "estudiante" and not nro_registro:
                return CrearUsuarioResponseType(ok=False, message="El número de registro es obligatorio.")
            if tipo_usuario == "docente" and not codigo_docente:
                return CrearUsuarioResponseType(ok=False, message="El código de docente es obligatorio.")
            vinculos_docente_parsed: List[Tuple[int, Optional[int]]] = []
            if tipo_usuario == "docente":
                vinculos_docente_parsed, err_vinc = _parse_vinculos_docente(vinculos_docente)
                if err_vinc:
                    return CrearUsuarioResponseType(ok=False, message=err_vinc)
            if tipo_usuario == "administrativo" and not codigo_admin:
                return CrearUsuarioResponseType(ok=False, message="El código administrativo es obligatorio.")
            if tipo_usuario == "personal_externo" and not empresa:
                return CrearUsuarioResponseType(ok=False, message="La empresa es obligatoria.")

            try:
                rol_obj = Rol.objects.get(nombre=nombre_rol)
            except Rol.DoesNotExist:
                return CrearUsuarioResponseType(ok=False, message=f"Rol '{nombre_rol}' no encontrado.")

            usuario.nombres = nombres.strip()
            usuario.apellidos = apellidos.strip()
            usuario.ci = ci.strip()
            usuario.email = email.strip() if email else ""
            usuario.celular = celular or None
            usuario.rol = rol_obj
            if password:
                usuario.password_hash = hash_password(password)
            usuario.save()

            if tipo_usuario == "estudiante":
                est, _ = Estudiante.objects.get_or_create(usuario=usuario, defaults={"nro_registro": nro_registro})
                if est.nro_registro != nro_registro and Estudiante.objects.filter(nro_registro=nro_registro).exclude(pk=est.pk).exists():
                    return CrearUsuarioResponseType(ok=False, message="Ya existe un estudiante con ese nro. de registro.")
                est.nro_registro = nro_registro
                est.save()
                from accesos.models import PersonaFacultad
                carreras_input = [
                    (id_carrera_1, paralelo_1, modalidad_1, periodo_1),
                    (id_carrera_2, paralelo_2, modalidad_2, periodo_2),
                ]
                ids_nuevos = [id_car for id_car, *_ in carreras_input if id_car]
                PersonaFacultad.objects.filter(usuario=usuario, tipo_vinculo="estudiante").exclude(
                    carrera__id_carrera__in=ids_nuevos
                ).delete()
                for id_car, paralelo, modalidad, periodo in carreras_input:
                    if not id_car:
                        continue
                    try:
                        carrera_obj = Carrera.objects.select_related("facultad").get(id_carrera=id_car)
                    except Carrera.DoesNotExist:
                        return CrearUsuarioResponseType(ok=False, message=f"Carrera con id {id_car} no encontrada.")
                    pf, created = PersonaFacultad.objects.get_or_create(
                        usuario=usuario,
                        facultad=carrera_obj.facultad,
                        carrera=carrera_obj,
                        tipo_vinculo="estudiante",
                        defaults={
                            "paralelo": paralelo or "",
                            "modalidad_ingreso": modalidad or None,
                            "periodo_ingreso": periodo or None,
                        },
                    )
                    if not created:
                        changed = False
                        if pf.paralelo != (paralelo or ""):
                            pf.paralelo = paralelo or ""
                            changed = True
                        if pf.modalidad_ingreso != (modalidad or None):
                            pf.modalidad_ingreso = modalidad or None
                            changed = True
                        if pf.periodo_ingreso != (periodo or None):
                            pf.periodo_ingreso = periodo or None
                            changed = True
                        if changed:
                            pf.save(update_fields=["paralelo", "modalidad_ingreso", "periodo_ingreso"])
            elif tipo_usuario == "docente":
                doc, _ = Docente.objects.get_or_create(usuario=usuario, defaults={"codigo_docente": codigo_docente})
                if doc.codigo_docente != codigo_docente and Docente.objects.filter(codigo_docente=codigo_docente).exclude(pk=doc.pk).exists():
                    return CrearUsuarioResponseType(ok=False, message="Ya existe un docente con ese código.")
                doc.codigo_docente = codigo_docente
                doc.especialidad = especialidad
                doc.categoria = categoria
                doc.save()
                err_sync = _sync_vinculos_docente(usuario, vinculos_docente_parsed)
                if err_sync:
                    return CrearUsuarioResponseType(ok=False, message=err_sync)
            elif tipo_usuario == "administrativo":
                adm, _ = Administrativo.objects.get_or_create(usuario=usuario, defaults={"codigo_admin": codigo_admin})
                if adm.codigo_admin != codigo_admin and Administrativo.objects.filter(codigo_admin=codigo_admin).exclude(pk=adm.pk).exists():
                    return CrearUsuarioResponseType(ok=False, message="Ya existe un administrativo con ese código.")
                adm.codigo_admin = codigo_admin
                adm.nivel_jerarquico = nivel_jerarquico_admin or adm.nivel_jerarquico
                adm.codigo_direccion = codigo_direccion_admin or None
                if id_facultad_admin:
                    try:
                        adm.facultad = Facultad.objects.get(id_facultad=id_facultad_admin)
                    except Facultad.DoesNotExist:
                        return CrearUsuarioResponseType(ok=False, message="Facultad no encontrada.")
                elif id_facultad_admin == 0:
                    adm.facultad = None
                adm.cargo = cargo
                adm.area = area
                adm.save()
            elif tipo_usuario == "personal_externo":
                from accesos.models import Guardia, Ingreso
                try:
                    emp = EmpresaExterna.objects.get(nombre__icontains=empresa)
                except EmpresaExterna.DoesNotExist:
                    return CrearUsuarioResponseType(ok=False, message=f"Empresa '{empresa}' no encontrada.")
                if not emp.activo:
                    return CrearUsuarioResponseType(ok=False, message=f"La empresa '{emp.nombre}' está desactivada.")
                pe, _ = PersonalExterno.objects.get_or_create(
                    usuario=usuario, defaults={"empresa": emp, "cargo": cargo or ""},
                )
                pe.empresa = emp
                pe.cargo = cargo or ("Guardia de seguridad" if nombre_rol == "guardia" else "")
                if nombre_rol == "guardia":
                    pe.horario = "07:00-22:00"
                pe.save()

                if nombre_rol == "guardia":
                    try:
                        ingreso = Ingreso.objects.get(id_ingreso=id_ingreso)
                    except Ingreso.DoesNotExist:
                        return CrearUsuarioResponseType(ok=False, message="Portón de ingreso no encontrado.")
                    g, _ = Guardia.objects.get_or_create(
                        usuario=usuario,
                        defaults={"ingreso": ingreso, "turno": Guardia.TURNO_DEFAULT},
                    )
                    g.ingreso = ingreso
                    g.turno = Guardia.TURNO_DEFAULT
                    g.save()
                else:
                    Guardia.objects.filter(usuario=usuario).delete()

            return CrearUsuarioResponseType(
                ok=True,
                message=f"Usuario {nombres} {apellidos} actualizado correctamente.",
                id_usuario=usuario.id_usuario,
            )
        except Exception as e:
            return CrearUsuarioResponseType(ok=False, message=f"Error al actualizar usuario: {str(e)}")

    @strawberry.mutation
    def desactivar_usuario(self, info, id_usuario: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            if admin.id_usuario == id_usuario:
                return ResponseType(success=False, message="No puedes desactivar tu propia cuenta.")
            try:
                usuario = Usuario.objects.get(id_usuario=id_usuario)
            except Usuario.DoesNotExist:
                return ResponseType(success=False, message="Usuario no encontrado.")
            if not usuario.activo:
                return ResponseType(success=False, message="El usuario ya está inactivo.")
            usuario.activo = False
            usuario.save(update_fields=["activo"])
            return ResponseType(
                success=True,
                message=f"Usuario {usuario.apellidos} {usuario.nombres} desactivado.",
            )
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def activar_usuario(self, info, id_usuario: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                usuario = Usuario.objects.get(id_usuario=id_usuario)
            except Usuario.DoesNotExist:
                return ResponseType(success=False, message="Usuario no encontrado.")
            if usuario.activo:
                return ResponseType(success=False, message="El usuario ya está activo.")
            usuario.activo = True
            usuario.save(update_fields=["activo"])
            return ResponseType(
                success=True,
                message=f"Usuario {usuario.apellidos} {usuario.nombres} activado.",
            )
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def desactivar_empresa(self, info, id_empresa: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                empresa = EmpresaExterna.objects.get(id_empresa=id_empresa)
            except EmpresaExterna.DoesNotExist:
                return ResponseType(success=False, message="Empresa no encontrada.")
            empresa.activo = False
            empresa.save()
            trabajadores = PersonalExterno.objects.filter(empresa=empresa).select_related("usuario")
            count = sum(1 for pe in trabajadores if (pe.usuario.__setattr__('activo', False) or True) and pe.usuario.save() is None)
            return ResponseType(success=True, message=f"Empresa desactivada. {count} trabajador(es) desactivado(s).")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def cambiar_password(self, info, password_actual: str, password_nuevo: str) -> ResponseType:
        try:
            usuario = get_usuario_from_info(info)
            ok_pass, msg_pass = validar_politica_password(password_nuevo)
            if not ok_pass:
                return ResponseType(success=False, message=msg_pass)
            if not verify_password(password_actual, usuario.password_hash):
                return ResponseType(success=False, message="La contraseña actual es incorrecta.")
            if verify_password(password_nuevo, usuario.password_hash):
                return ResponseType(success=False, message="La nueva contraseña debe ser diferente a la actual.")
            usuario.password_hash = hash_password(password_nuevo)
            usuario.intentos_fallidos_login = 0
            usuario.bloqueado_hasta = None
            usuario.save(update_fields=["password_hash", "intentos_fallidos_login", "bloqueado_hasta"])
            return ResponseType(success=True, message="Contraseña actualizada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def registrar_fotos_rostro(
        self,
        info,
        fotos: List[FotoRostroInput],
        descriptor_promedio: Optional[List[float]] = None,
    ) -> RegistroRostroResponseType:
        """Enrolamiento facial fase 1: frente, izquierda y derecha."""
        try:
            usuario = get_usuario_from_info(info)
            if usuario.tipo_usuario == "guardia":
                return RegistroRostroResponseType(
                    ok=False,
                    message="Los guardias no requieren registro de rostro.",
                    fotos=[],
                )
            if not fotos:
                return RegistroRostroResponseType(
                    ok=False, message="Debe enviar al menos una foto.", fotos=[]
                )

            por_angulo: dict[str, str] = {}
            for item in fotos:
                angulo = (item.angulo or "").strip().lower()
                if angulo not in ANGULOS_ROSTRO:
                    return RegistroRostroResponseType(
                        ok=False,
                        message=f"Ángulo inválido: {item.angulo}",
                        fotos=[],
                    )
                if angulo in por_angulo:
                    return RegistroRostroResponseType(
                        ok=False,
                        message=f"Ángulo duplicado: {angulo}",
                        fotos=[],
                    )
                por_angulo[angulo] = item.imagen_base64

            faltantes = [a for a in ANGULOS_ROSTRO if a not in por_angulo]
            if faltantes:
                return RegistroRostroResponseType(
                    ok=False,
                    message=f"Faltan fotos: {', '.join(faltantes)}",
                    fotos=[],
                )

            request = info.context["request"]
            guardadas: list[FotoRostroType] = []

            for angulo in ANGULOS_ROSTRO:
                try:
                    rel_path = guardar_foto_rostro(
                        usuario.id_usuario, angulo, por_angulo[angulo]
                    )
                except ValueError as exc:
                    return RegistroRostroResponseType(
                        ok=False, message=str(exc), fotos=[]
                    )

                existente = FotoRostro.objects.filter(
                    usuario=usuario, angulo=angulo
                ).first()
                if existente and existente.archivo != rel_path:
                    eliminar_archivo_rostro(existente.archivo)

                foto, _ = FotoRostro.objects.update_or_create(
                    usuario=usuario,
                    angulo=angulo,
                    defaults={"archivo": rel_path},
                )
                from django.conf import settings

                url = request.build_absolute_uri(
                    f"{settings.MEDIA_URL}{rel_path}"
                )
                guardadas.append(
                    FotoRostroType(
                        angulo=foto.angulo, url=url, actualizado_en=foto.actualizado_en
                    )
                )

            frente_url = next((f.url for f in guardadas if f.angulo == "frente"), None)
            update_fields: list[str] = []
            if frente_url:
                usuario.foto_url = frente_url
                update_fields.append("foto_url")
            if descriptor_promedio is not None:
                err_desc = validar_descriptor(descriptor_promedio)
                if err_desc:
                    return RegistroRostroResponseType(
                        ok=False, message=err_desc, fotos=[]
                    )
                usuario.rostro_descriptor = [float(x) for x in descriptor_promedio]
                update_fields.append("rostro_descriptor")
            if update_fields:
                usuario.save(update_fields=update_fields)

            return RegistroRostroResponseType(
                ok=True,
                message="Registro de rostro guardado correctamente.",
                fotos=guardadas,
            )
        except Exception as e:
            return RegistroRostroResponseType(
                ok=False, message=f"Error: {str(e)}", fotos=[]
            )

    @strawberry.mutation
    def actualizar_foto_perfil(
        self,
        info,
        imagen_base64: str,
    ) -> FotoPerfilResponseType:
        """Sube o reemplaza la foto de perfil del usuario autenticado."""
        try:
            usuario = get_usuario_from_info(info)
            if not (imagen_base64 or "").strip():
                return FotoPerfilResponseType(
                    ok=False, message="Debe enviar una imagen."
                )

            try:
                rel_path = guardar_foto_perfil(usuario.id_usuario, imagen_base64)
            except ValueError as exc:
                return FotoPerfilResponseType(ok=False, message=str(exc))

            anterior = usuario.foto_url
            if anterior and anterior != rel_path and not anterior.startswith("http"):
                eliminar_archivo_rostro(anterior)

            usuario.foto_url = rel_path
            usuario.save(update_fields=["foto_url", "actualizado_en"])

            from django.conf import settings

            request = info.context["request"]
            foto_abs = request.build_absolute_uri(f"{settings.MEDIA_URL}{rel_path}")

            return FotoPerfilResponseType(
                ok=True,
                message="Foto de perfil actualizada.",
                foto_url=foto_abs,
            )
        except Exception as e:
            return FotoPerfilResponseType(ok=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def solicitar_recuperacion_password(
        self,
        ci: str,
        email: str,
        tipo_usuario: str,
    ) -> PasswordResetResponseType:
        """Envía email con enlace de recuperación (respuesta genérica por seguridad)."""
        try:
            usuario = buscar_usuario_recuperacion(ci, email, tipo_usuario)
            if usuario is None:
                return PasswordResetResponseType(ok=True, message=MENSAJE_SOLICITUD_GENERICO)

            if solicitudes_recientes(usuario) >= MAX_SOLICITUDES_POR_HORA:
                return PasswordResetResponseType(ok=True, message=MENSAJE_SOLICITUD_GENERICO)

            token_plano, _ = crear_solicitud_reset(usuario)
            from django.conf import settings

            enlace = (
                f"{settings.FRONTEND_URL.rstrip('/')}/recuperar-password"
                f"?token={token_plano}"
            )
            nombre = f"{usuario.nombres} {usuario.apellidos}".strip()
            enviado = enviar_email_recuperacion_password(
                email_destino=usuario.email,
                nombre_usuario=nombre,
                enlace_recuperacion=enlace,
                minutos_validez=RESET_TOKEN_MINUTES,
            )
            if not enviado:
                print(
                    f"[RESET PASSWORD] Falló envío a {usuario.email} "
                    f"(usuario id={usuario.id_usuario})"
                )

            return PasswordResetResponseType(ok=True, message=MENSAJE_SOLICITUD_GENERICO)
        except Exception as e:
            return PasswordResetResponseType(
                ok=False,
                message=f"Error al procesar la solicitud: {str(e)}",
            )

    @strawberry.mutation
    def restablecer_password(
        self,
        token: str,
        password_nuevo: str,
    ) -> PasswordResetResponseType:
        """Define nueva contraseña con token del email (público, sin JWT)."""
        try:
            usuario, err = validar_token_recuperacion(token)
            if err or usuario is None:
                return PasswordResetResponseType(ok=False, message=err or "Token inválido.")

            ok_pass, msg_pass = validar_politica_password(password_nuevo)
            if not ok_pass:
                return PasswordResetResponseType(ok=False, message=msg_pass)

            if verify_password(password_nuevo, usuario.password_hash):
                return PasswordResetResponseType(
                    ok=False,
                    message="La nueva contraseña debe ser diferente a la anterior.",
                )

            usuario.password_hash = hash_password(password_nuevo)
            usuario.intentos_fallidos_login = 0
            usuario.bloqueado_hasta = None
            usuario.save(
                update_fields=[
                    "password_hash",
                    "intentos_fallidos_login",
                    "bloqueado_hasta",
                ]
            )
            marcar_token_usado(token)

            return PasswordResetResponseType(
                ok=True,
                message="Contraseña actualizada. Ya puedes iniciar sesión.",
            )
        except Exception as e:
            return PasswordResetResponseType(
                ok=False,
                message=f"Error: {str(e)}",
            )

    @strawberry.mutation
    def desbloquear_cuenta(self, info, id_usuario: int) -> ResponseType:
        """Desbloquea intentos fallidos de login (solo admin)."""
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                usuario = Usuario.objects.get(id_usuario=id_usuario)
            except Usuario.DoesNotExist:
                return ResponseType(success=False, message="Usuario no encontrado.")
            limpiar_bloqueo_login(usuario)
            return ResponseType(
                success=True,
                message=f"Cuenta de {usuario.apellidos} {usuario.nombres} desbloqueada.",
            )
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def crear_empresa(
        self, info, nombre: str, tipo: str = "externa", nit: Optional[str] = None,
        contacto_nombre: Optional[str] = None, contacto_telefono: Optional[str] = None,
        contacto_email: Optional[str] = None, contrato_desde: Optional[str] = None,
        contrato_hasta: Optional[str] = None,
    ) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            if not nombre or not nombre.strip():
                return ResponseType(success=False, message="El nombre de la empresa es requerido.")
            if tipo not in ("externa", "seguridad"):
                return ResponseType(success=False, message="El tipo debe ser 'externa' o 'seguridad'.")
            if EmpresaExterna.objects.filter(nombre__iexact=nombre.strip()).exists():
                return ResponseType(success=False, message=f"Ya existe una empresa con el nombre '{nombre}'.")

            from datetime import date
            desde = date.fromisoformat(contrato_desde) if contrato_desde else None
            hasta = date.fromisoformat(contrato_hasta) if contrato_hasta else None

            EmpresaExterna.objects.create(
                nombre=nombre.strip(), tipo=tipo, nit=nit, contacto_nombre=contacto_nombre,
                contrato_vigente=True, contrato_desde=desde, contrato_hasta=hasta,
            )
            return ResponseType(success=True, message=f"Empresa '{nombre}' creada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error al crear empresa: {str(e)}")

    @strawberry.mutation
    def editar_empresa(
        self, info, id_empresa: int, nombre: str, tipo: str,
        nit: Optional[str] = None, contacto_nombre: Optional[str] = None,
        contrato_vigente: bool = True,
        contrato_desde: Optional[str] = None, contrato_hasta: Optional[str] = None,
    ) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            if not nombre or not nombre.strip():
                return ResponseType(success=False, message="El nombre de la empresa es requerido.")
            if tipo not in ("externa", "seguridad"):
                return ResponseType(success=False, message="El tipo debe ser 'externa' o 'seguridad'.")

            try:
                empresa = EmpresaExterna.objects.get(id_empresa=id_empresa)
            except EmpresaExterna.DoesNotExist:
                return ResponseType(success=False, message="Empresa no encontrada.")

            duplicado = EmpresaExterna.objects.filter(
                nombre__iexact=nombre.strip()
            ).exclude(id_empresa=id_empresa).first()
            if duplicado:
                return ResponseType(success=False, message=f"Ya existe otra empresa con el nombre '{nombre}'.")

            from datetime import date
            empresa.nombre = nombre.strip()
            empresa.tipo = tipo
            empresa.nit = nit or None
            empresa.contacto_nombre = contacto_nombre or None
            empresa.contrato_vigente = contrato_vigente
            empresa.contrato_desde = date.fromisoformat(contrato_desde) if contrato_desde else None
            empresa.contrato_hasta = date.fromisoformat(contrato_hasta) if contrato_hasta else None
            empresa.save()
            return ResponseType(success=True, message=f"Empresa '{empresa.nombre}' actualizada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error al editar empresa: {str(e)}")

    @strawberry.mutation
    def activar_empresa(self, info, id_empresa: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                empresa = EmpresaExterna.objects.get(id_empresa=id_empresa)
            except EmpresaExterna.DoesNotExist:
                return ResponseType(success=False, message="Empresa no encontrada.")
            empresa.activo = True
            empresa.save()
            return ResponseType(success=True, message=f"Empresa '{empresa.nombre}' reactivada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    # ─── Facultades ───────────────────────────────────────────────────────────

    @strawberry.mutation
    def crear_facultad(
        self, info, id_sede: int, nombre: str, descripcion: Optional[str] = None
    ) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            if not nombre.strip():
                return ResponseType(success=False, message="El nombre de la facultad es requerido.")
            try:
                sede = Sede.objects.get(id_sede=id_sede)
            except Sede.DoesNotExist:
                return ResponseType(success=False, message="Sede no encontrada.")
            if Facultad.objects.filter(nombre__iexact=nombre.strip(), sede=sede).exists():
                return ResponseType(success=False, message=f"Ya existe una facultad con ese nombre en la sede '{sede.nombre}'.")
            Facultad.objects.create(sede=sede, nombre=nombre.strip(), descripcion=descripcion or None)
            return ResponseType(success=True, message=f"Facultad '{nombre}' creada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def editar_facultad(
        self, info, id_facultad: int, nombre: str,
        id_sede: Optional[int] = None, descripcion: Optional[str] = None
    ) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                facultad = Facultad.objects.select_related("sede").get(id_facultad=id_facultad)
            except Facultad.DoesNotExist:
                return ResponseType(success=False, message="Facultad no encontrada.")
            if not nombre.strip():
                return ResponseType(success=False, message="El nombre es requerido.")
            sede = facultad.sede
            if id_sede and id_sede != facultad.sede.id_sede:
                try:
                    sede = Sede.objects.get(id_sede=id_sede)
                except Sede.DoesNotExist:
                    return ResponseType(success=False, message="Sede no encontrada.")
            dup = Facultad.objects.filter(nombre__iexact=nombre.strip(), sede=sede).exclude(id_facultad=id_facultad).first()
            if dup:
                return ResponseType(success=False, message=f"Ya existe otra facultad con ese nombre en '{sede.nombre}'.")
            facultad.nombre = nombre.strip()
            facultad.sede = sede
            facultad.descripcion = descripcion or None
            facultad.save()
            return ResponseType(success=True, message=f"Facultad '{facultad.nombre}' actualizada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def desactivar_facultad(self, info, id_facultad: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                facultad = Facultad.objects.get(id_facultad=id_facultad)
            except Facultad.DoesNotExist:
                return ResponseType(success=False, message="Facultad no encontrada.")
            facultad.activo = False
            facultad.save()
            Carrera.objects.filter(facultad=facultad).update(activo=False)
            return ResponseType(success=True, message=f"Facultad '{facultad.nombre}' desactivada.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def activar_facultad(self, info, id_facultad: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                facultad = Facultad.objects.get(id_facultad=id_facultad)
            except Facultad.DoesNotExist:
                return ResponseType(success=False, message="Facultad no encontrada.")
            facultad.activo = True
            facultad.save()
            return ResponseType(success=True, message=f"Facultad '{facultad.nombre}' reactivada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    # ─── Ingresos / Portones ──────────────────────────────────────────────────

    @strawberry.mutation
    def editar_ingreso(
        self, info, id_ingreso: int, nombre: str, id_facultad: int,
        descripcion: Optional[str] = None, ubicacion: Optional[str] = None,
    ) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            from accesos.models import Ingreso
            from accesos.utils import normalizar_nombre_porton
            try:
                ingreso = Ingreso.objects.get(id_ingreso=id_ingreso)
            except Ingreso.DoesNotExist:
                return ResponseType(success=False, message="Portón no encontrado.")
            if not nombre.strip():
                return ResponseType(success=False, message="El nombre es requerido.")
            try:
                facultad = Facultad.objects.get(id_facultad=id_facultad)
            except Facultad.DoesNotExist:
                return ResponseType(success=False, message="Facultad no encontrada.")
            ingreso.nombre = normalizar_nombre_porton(nombre)
            ingreso.facultad = facultad
            ingreso.descripcion = descripcion or None
            ingreso.ubicacion = ubicacion or None
            ingreso.save()
            return ResponseType(success=True, message=f"Portón '{ingreso.nombre}' actualizado correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def desactivar_ingreso(self, info, id_ingreso: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            from accesos.models import Ingreso
            try:
                ingreso = Ingreso.objects.get(id_ingreso=id_ingreso)
            except Ingreso.DoesNotExist:
                return ResponseType(success=False, message="Portón no encontrado.")
            ingreso.activo = False
            ingreso.save()
            return ResponseType(success=True, message=f"Portón '{ingreso.nombre}' desactivado.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def activar_ingreso(self, info, id_ingreso: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            from accesos.models import Ingreso
            try:
                ingreso = Ingreso.objects.get(id_ingreso=id_ingreso)
            except Ingreso.DoesNotExist:
                return ResponseType(success=False, message="Portón no encontrado.")
            ingreso.activo = True
            ingreso.save()
            return ResponseType(success=True, message=f"Portón '{ingreso.nombre}' reactivado correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    # ─── Carreras ─────────────────────────────────────────────────────────────

    @strawberry.mutation
    def crear_carrera(
        self, info, id_facultad: int, nombre: str,
        codigo: str, duracion_anios: Optional[int] = None,
    ) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            if not nombre.strip():
                return ResponseType(success=False, message="El nombre de la carrera es requerido.")
            if not codigo.strip():
                return ResponseType(success=False, message="El código es requerido.")
            try:
                facultad = Facultad.objects.get(id_facultad=id_facultad)
            except Facultad.DoesNotExist:
                return ResponseType(success=False, message="Facultad no encontrada.")
            if not facultad.activo:
                return ResponseType(success=False, message="La facultad está inactiva.")
            if Carrera.objects.filter(codigo__iexact=codigo.strip()).exists():
                return ResponseType(success=False, message=f"Ya existe una carrera con el código '{codigo}'.")
            if Carrera.objects.filter(nombre__iexact=nombre.strip(), facultad=facultad).exists():
                return ResponseType(success=False, message="Ya existe una carrera con ese nombre en esta facultad.")
            Carrera.objects.create(
                facultad=facultad,
                nombre=nombre.strip(),
                codigo=codigo.strip().upper(),
                duracion_anios=duracion_anios,
            )
            return ResponseType(success=True, message=f"Carrera '{nombre}' creada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def editar_carrera(
        self, info, id_carrera: int, nombre: str,
        codigo: str, id_facultad: Optional[int] = None,
        duracion_anios: Optional[int] = None,
    ) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                carrera = Carrera.objects.select_related("facultad").get(id_carrera=id_carrera)
            except Carrera.DoesNotExist:
                return ResponseType(success=False, message="Carrera no encontrada.")
            if not nombre.strip():
                return ResponseType(success=False, message="El nombre es requerido.")
            if not codigo.strip():
                return ResponseType(success=False, message="El código es requerido.")
            facultad = carrera.facultad
            if id_facultad and id_facultad != carrera.facultad.id_facultad:
                try:
                    facultad = Facultad.objects.get(id_facultad=id_facultad)
                except Facultad.DoesNotExist:
                    return ResponseType(success=False, message="Facultad no encontrada.")
            if Carrera.objects.filter(codigo__iexact=codigo.strip()).exclude(id_carrera=id_carrera).exists():
                return ResponseType(success=False, message=f"El código '{codigo}' ya lo usa otra carrera.")
            if Carrera.objects.filter(nombre__iexact=nombre.strip(), facultad=facultad).exclude(id_carrera=id_carrera).exists():
                return ResponseType(success=False, message="Ya existe otra carrera con ese nombre en esta facultad.")
            carrera.nombre = nombre.strip()
            carrera.codigo = codigo.strip().upper()
            carrera.facultad = facultad
            carrera.duracion_anios = duracion_anios
            carrera.save()
            return ResponseType(success=True, message=f"Carrera '{carrera.nombre}' actualizada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def desactivar_carrera(self, info, id_carrera: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                carrera = Carrera.objects.get(id_carrera=id_carrera)
            except Carrera.DoesNotExist:
                return ResponseType(success=False, message="Carrera no encontrada.")
            carrera.activo = False
            carrera.save()
            return ResponseType(success=True, message=f"Carrera '{carrera.nombre}' desactivada.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def activar_carrera(self, info, id_carrera: int) -> ResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return ResponseType(success=False, message="No tienes permiso para esta acción.")
            try:
                carrera = Carrera.objects.get(id_carrera=id_carrera)
            except Carrera.DoesNotExist:
                return ResponseType(success=False, message="Carrera no encontrada.")
            if not carrera.facultad.activo:
                return ResponseType(success=False, message="No se puede activar una carrera de una facultad inactiva.")
            carrera.activo = True
            carrera.save()
            return ResponseType(success=True, message=f"Carrera '{carrera.nombre}' reactivada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")

    @strawberry.mutation
    def sincronizar_dtic(self, info, simulado: bool = False) -> str:
        """
        Ejecuta la sincronización con la API DTIC.
        Si simulado=True (o la API no está configurada), usa datos de prueba.
        Retorna un JSON con el resultado de la sincronización.
        """
        import json
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return json.dumps({"error": "No tienes permiso para esta acción."})

            from usuarios.dtic_service import ejecutar_sincronizacion, api_dtic_disponible
            usar_simulado = simulado or not api_dtic_disponible()
            resultado = ejecutar_sincronizacion(iniciado_por=admin, simulado=usar_simulado)
            return json.dumps(resultado, ensure_ascii=False)

        except Exception as e:
            return json.dumps({"error": str(e)})
