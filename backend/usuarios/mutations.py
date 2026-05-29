import re
from typing import Optional

import pyotp
import strawberry

from usuarios.models import (
    Administrativo,
    Carrera,
    Docente,
    Estudiante,
    EmpresaExterna,
    Facultad,
    PersonalExterno,
    Rol,
    Sede,
    Usuario,
)
from usuarios.types import (
    Activar2FAType,
    AuthType,
    CrearUsuarioResponseType,
    ResponseType,
    Verificar2FAResponseType,
)
from usuarios.utils import (
    decode_partial_token,
    generate_partial_token,
    generate_token,
    get_usuario_from_info,
    hash_password,
    verify_password,
)

def _validar_email(email: str) -> bool:
    return bool(re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email))


def _auth_vacio(**kwargs) -> AuthType:
    return AuthType(token="", tipo_usuario="", rol="", nombres="", apellidos="",
                    needs2fa=False, partial_token=None, **kwargs)


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
                return _auth_vacio(message="CI o contraseña incorrectos.")

            if not usuario.activo:
                return _auth_vacio(message="Usuario desactivado. Contacte al administrador.")

            if not verify_password(password, usuario.password_hash):
                return _auth_vacio(message="CI o contraseña incorrectos.")

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
        modalidad_ingreso: Optional[str] = None, periodo_ingreso: Optional[str] = None,
        codigo_docente: Optional[str] = None, especialidad: Optional[str] = None,
        categoria: Optional[str] = None, codigo_admin: Optional[str] = None,
        cargo: Optional[str] = None, area: Optional[str] = None,
        empresa: Optional[str] = None, turno: Optional[str] = None,
        id_ingreso: Optional[int] = None,
    ) -> CrearUsuarioResponseType:
        try:
            admin = get_usuario_from_info(info)
            if admin.rol.nombre != "admin":
                return CrearUsuarioResponseType(ok=False, message="No tienes permiso para esta acción.")

            if not ci or len(ci.strip()) < 6:
                return CrearUsuarioResponseType(ok=False, message="El CI debe tener al menos 6 caracteres.")
            if not password or len(password) < 6:
                return CrearUsuarioResponseType(ok=False, message="La contraseña debe tener al menos 6 caracteres.")
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
                    return CrearUsuarioResponseType(ok=False, message="La puerta de ingreso es obligatoria para guardias.")

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
                Estudiante.objects.create(usuario=usuario, nro_registro=nro_registro,
                    modalidad_ingreso=modalidad_ingreso, periodo_ingreso=periodo_ingreso)
            elif tipo_usuario == "docente":
                Docente.objects.create(usuario=usuario, codigo_docente=codigo_docente,
                    especialidad=especialidad, categoria=categoria)
            elif tipo_usuario == "administrativo":
                Administrativo.objects.create(usuario=usuario, codigo_admin=codigo_admin,
                    cargo=cargo, area=area)
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
                            return CrearUsuarioResponseType(ok=False, message="Puerta de ingreso no encontrada.")
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
        nro_registro: Optional[str] = None, modalidad_ingreso: Optional[str] = None,
        periodo_ingreso: Optional[str] = None, codigo_docente: Optional[str] = None,
        especialidad: Optional[str] = None, categoria: Optional[str] = None,
        codigo_admin: Optional[str] = None, cargo: Optional[str] = None,
        area: Optional[str] = None, empresa: Optional[str] = None,
        turno: Optional[str] = None, id_ingreso: Optional[int] = None,
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
            if password and len(password) < 6:
                return CrearUsuarioResponseType(ok=False, message="La contraseña debe tener al menos 6 caracteres.")
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
                    return CrearUsuarioResponseType(ok=False, message="La puerta de ingreso es obligatoria para guardias.")

            if tipo_usuario == "estudiante" and not nro_registro:
                return CrearUsuarioResponseType(ok=False, message="El número de registro es obligatorio.")
            if tipo_usuario == "docente" and not codigo_docente:
                return CrearUsuarioResponseType(ok=False, message="El código de docente es obligatorio.")
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
                est.modalidad_ingreso = modalidad_ingreso
                est.periodo_ingreso = periodo_ingreso
                est.save()
            elif tipo_usuario == "docente":
                doc, _ = Docente.objects.get_or_create(usuario=usuario, defaults={"codigo_docente": codigo_docente})
                if doc.codigo_docente != codigo_docente and Docente.objects.filter(codigo_docente=codigo_docente).exclude(pk=doc.pk).exists():
                    return CrearUsuarioResponseType(ok=False, message="Ya existe un docente con ese código.")
                doc.codigo_docente = codigo_docente
                doc.especialidad = especialidad
                doc.categoria = categoria
                doc.save()
            elif tipo_usuario == "administrativo":
                adm, _ = Administrativo.objects.get_or_create(usuario=usuario, defaults={"codigo_admin": codigo_admin})
                if adm.codigo_admin != codigo_admin and Administrativo.objects.filter(codigo_admin=codigo_admin).exclude(pk=adm.pk).exists():
                    return CrearUsuarioResponseType(ok=False, message="Ya existe un administrativo con ese código.")
                adm.codigo_admin = codigo_admin
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
                        return CrearUsuarioResponseType(ok=False, message="Puerta de ingreso no encontrada.")
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
            if not password_nuevo or len(password_nuevo) < 6:
                return ResponseType(success=False, message="La nueva contraseña debe tener al menos 6 caracteres.")
            if not verify_password(password_actual, usuario.password_hash):
                return ResponseType(success=False, message="La contraseña actual es incorrecta.")
            usuario.password_hash = hash_password(password_nuevo)
            usuario.save()
            return ResponseType(success=True, message="Contraseña actualizada correctamente.")
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

    # ─── Ingresos / Puertas ───────────────────────────────────────────────────

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
            try:
                ingreso = Ingreso.objects.get(id_ingreso=id_ingreso)
            except Ingreso.DoesNotExist:
                return ResponseType(success=False, message="Puerta de ingreso no encontrada.")
            if not nombre.strip():
                return ResponseType(success=False, message="El nombre es requerido.")
            try:
                facultad = Facultad.objects.get(id_facultad=id_facultad)
            except Facultad.DoesNotExist:
                return ResponseType(success=False, message="Facultad no encontrada.")
            ingreso.nombre = nombre.strip()
            ingreso.facultad = facultad
            ingreso.descripcion = descripcion or None
            ingreso.ubicacion = ubicacion or None
            ingreso.save()
            return ResponseType(success=True, message=f"Puerta '{ingreso.nombre}' actualizada correctamente.")
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
                return ResponseType(success=False, message="Puerta no encontrada.")
            ingreso.activo = False
            ingreso.save()
            return ResponseType(success=True, message=f"Puerta '{ingreso.nombre}' desactivada.")
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
                return ResponseType(success=False, message="Puerta no encontrada.")
            ingreso.activo = True
            ingreso.save()
            return ResponseType(success=True, message=f"Puerta '{ingreso.nombre}' reactivada correctamente.")
        except Exception as e:
            return ResponseType(success=False, message=f"Error: {str(e)}")
