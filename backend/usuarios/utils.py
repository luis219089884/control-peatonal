import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from decouple import config

from usuarios.models import Usuario

JWT_SECRET = config("JWT_SECRET", default="uagrm-jwt-secret-changeme")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = config("JWT_EXPIRATION_HOURS", cast=int, default=8)

_PBKDF2_ITERATIONS = 260_000
_PBKDF2_PREFIX = "pbkdf2_sha256$"


def hash_password(password: str) -> str:
    """Hash unidireccional PBKDF2-SHA256 (no reversible)."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        _PBKDF2_ITERATIONS,
    )
    digest = base64.b64encode(dk).decode("ascii")
    return f"{_PBKDF2_PREFIX}{_PBKDF2_ITERATIONS}${salt}${digest}"


def _verify_pbkdf2(password: str, stored: str) -> bool:
    try:
        _, iterations_s, salt, digest = stored.split("$", 3)
        iterations = int(iterations_s)
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        return secrets.compare_digest(base64.b64encode(dk).decode("ascii"), digest)
    except (ValueError, TypeError):
        return False


def _verify_legacy_sha256(password: str, stored: str) -> bool:
    return hashlib.sha256(password.encode("utf-8")).hexdigest() == stored


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    if hashed.startswith(_PBKDF2_PREFIX):
        return _verify_pbkdf2(password, hashed)
    return _verify_legacy_sha256(password, hashed)


def password_needs_rehash(hashed: str) -> bool:
    return not hashed.startswith(_PBKDF2_PREFIX)


def usuario_puede_registrar_invitados(usuario: Usuario) -> bool:
    """Devuelve True si el usuario tiene permiso para registrar invitados."""
    if usuario.tipo_usuario == "docente":
        return True
    if usuario.tipo_usuario == "administrativo":
        try:
            from usuarios.models import Administrativo
            adm = Administrativo.objects.get(usuario=usuario)
            return adm.puede_registrar_invitados
        except Exception:
            return False
    return False


def generate_token(usuario: Usuario) -> str:
    ahora = datetime.now(tz=timezone.utc)
    payload = {
        "id_usuario": usuario.id_usuario,
        "tipo_usuario": usuario.tipo_usuario,
        "rol": usuario.rol.nombre,
        "nombres": usuario.nombres,
        "apellidos": usuario.apellidos,
        "puede_registrar_invitados": usuario_puede_registrar_invitados(usuario),
        "exp": ahora + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": ahora,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise Exception("Sesión expirada, inicie sesión nuevamente.")
    except jwt.InvalidTokenError:
        raise Exception("Token inválido.")


def generate_partial_token(usuario: Usuario) -> str:
    """Token temporal de 5 minutos usado solo durante el paso 2 del login 2FA."""
    ahora = datetime.now(tz=timezone.utc)
    payload = {
        "id_usuario": usuario.id_usuario,
        "tipo": "2fa_pending",
        "exp": ahora + timedelta(minutes=5),
        "iat": ahora,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_partial_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("tipo") != "2fa_pending":
            raise Exception("Token de verificación inválido.")
        return payload
    except jwt.ExpiredSignatureError:
        raise Exception("El código de verificación expiró. Inicie sesión nuevamente.")
    except jwt.InvalidTokenError:
        raise Exception("Token de verificación inválido.")


def get_usuario_from_info(info) -> Usuario:
    request = info.context["request"]
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise Exception("No autenticado. Proporcione un token Bearer válido.")
    token = auth_header.split(" ", 1)[1]
    payload = decode_token(token)
    try:
        return Usuario.objects.select_related("rol").get(
            id_usuario=payload["id_usuario"], activo=True
        )
    except Usuario.DoesNotExist:
        raise Exception("Usuario no encontrado o inactivo.")


def require_rol(*roles: str):
    def decorator(func):
        @wraps(func)
        def wrapper(self, info, *args, **kwargs):
            usuario = get_usuario_from_info(info)
            if usuario.rol.nombre not in roles:
                raise Exception("No tienes permiso para esta acción.")
            return func(self, info, *args, **kwargs)
        return wrapper
    return decorator
