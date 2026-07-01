"""Tokens y lógica de recuperación de contraseña."""
from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone as dj_tz

from usuarios.models import TokenRecuperacionPassword, Usuario

RESET_TOKEN_MINUTES = 30
MAX_SOLICITUDES_POR_HORA = 3

MENSAJE_SOLICITUD_GENERICO = (
    "Si los datos son correctos, recibirás un correo con instrucciones "
    "para restablecer tu contraseña."
)


def hash_token(token_plano: str) -> str:
    return hashlib.sha256(token_plano.encode("utf-8")).hexdigest()


def generar_token_plano() -> str:
    return secrets.token_urlsafe(32)


def solicitudes_recientes(usuario: Usuario) -> int:
    desde = dj_tz.now() - timedelta(hours=1)
    return TokenRecuperacionPassword.objects.filter(
        usuario=usuario,
        creado_en__gte=desde,
    ).count()


def crear_solicitud_reset(usuario: Usuario) -> tuple[str, TokenRecuperacionPassword]:
    """Invalida tokens activos previos y crea uno nuevo. Retorna (token_plano, registro)."""
    TokenRecuperacionPassword.objects.filter(
        usuario=usuario,
        usado=False,
        expira_en__gt=dj_tz.now(),
    ).update(usado=True)

    token_plano = generar_token_plano()
    registro = TokenRecuperacionPassword.objects.create(
        usuario=usuario,
        token_hash=hash_token(token_plano),
        expira_en=dj_tz.now() + timedelta(minutes=RESET_TOKEN_MINUTES),
    )
    return token_plano, registro


def buscar_usuario_recuperacion(
    ci: str,
    email: str,
    tipo_usuario: str,
) -> Usuario | None:
    ci = (ci or "").strip()
    email = (email or "").strip().lower()
    tipo = (tipo_usuario or "").strip().lower()
    if not ci or not email or not tipo:
        return None
    if tipo == "guardia":
        return None
    try:
        return Usuario.objects.select_related("rol").get(
            ci=ci,
            email__iexact=email,
            tipo_usuario=tipo,
            activo=True,
        )
    except Usuario.DoesNotExist:
        return None
    except Usuario.MultipleObjectsReturned:
        return None


def validar_token_recuperacion(token_plano: str) -> tuple[Usuario | None, str | None]:
    if not token_plano or not token_plano.strip():
        return None, "El enlace de recuperación no es válido."
    token_hash = hash_token(token_plano.strip())
    try:
        registro = TokenRecuperacionPassword.objects.select_related("usuario").get(
            token_hash=token_hash
        )
    except TokenRecuperacionPassword.DoesNotExist:
        return None, "El enlace de recuperación no es válido o ya expiró."

    if registro.usado:
        return None, "Este enlace ya fue utilizado. Solicite uno nuevo."
    if registro.expira_en < dj_tz.now():
        return None, "El enlace expiró. Solicite uno nuevo desde el inicio de sesión."
    if not registro.usuario.activo:
        return None, "La cuenta no está activa. Contacte al administrador."

    return registro.usuario, None


def marcar_token_usado(token_plano: str) -> None:
    token_hash = hash_token(token_plano.strip())
    TokenRecuperacionPassword.objects.filter(token_hash=token_hash).update(usado=True)
