"""Política de contraseñas institucional UAGRM Control Peatonal."""
from __future__ import annotations

import re
from datetime import timedelta

from django.utils import timezone as dj_tz

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 15

_SPECIAL_CHARS = re.compile(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]")


def validar_politica_password(password: str) -> tuple[bool, str]:
  """
  Reglas: longitud mínima, mayúscula, minúscula, dígito y carácter especial.
  Retorna (ok, mensaje_error).
  """
  if not password:
    return False, "La contraseña es requerida."

  if len(password) < MIN_PASSWORD_LENGTH:
    return False, f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres."

  if len(password) > MAX_PASSWORD_LENGTH:
    return False, f"La contraseña no puede superar {MAX_PASSWORD_LENGTH} caracteres."

  if not re.search(r"[A-Z]", password):
    return False, "Debe incluir al menos una letra mayúscula."

  if not re.search(r"[a-z]", password):
    return False, "Debe incluir al menos una letra minúscula."

  if not re.search(r"\d", password):
    return False, "Debe incluir al menos un número."

  if not _SPECIAL_CHARS.search(password):
    return False, "Debe incluir al menos un carácter especial (!@#$%...)."

  return True, ""


def segundos_bloqueo_restante(usuario) -> int | None:
    if usuario.bloqueado_hasta and usuario.bloqueado_hasta > dj_tz.now():
        return max(1, int((usuario.bloqueado_hasta - dj_tz.now()).total_seconds()))
    return None


def cuenta_esta_bloqueada(usuario) -> bool:
    return segundos_bloqueo_restante(usuario) is not None


def intentos_restantes_login(usuario) -> int:
    usados = usuario.intentos_fallidos_login or 0
    return max(0, MAX_LOGIN_ATTEMPTS - usados)


def mensaje_cuenta_bloqueada(usuario) -> str | None:
    restante = segundos_bloqueo_restante(usuario)
    if restante is not None:
        return (
            f"Cuenta bloqueada por seguridad. Intente en {restante} segundo(s) "
            "o contacte al administrador."
        )
    return None


def registrar_fallo_login(usuario) -> bool:
    """Registra fallo. Retorna True si la cuenta quedó bloqueada."""
    usuario.intentos_fallidos_login = (usuario.intentos_fallidos_login or 0) + 1
    updates = ["intentos_fallidos_login"]
    bloqueada = False
    if usuario.intentos_fallidos_login >= MAX_LOGIN_ATTEMPTS:
        usuario.bloqueado_hasta = dj_tz.now() + timedelta(seconds=LOCKOUT_SECONDS)
        usuario.intentos_fallidos_login = 0
        updates.append("bloqueado_hasta")
        bloqueada = True
    usuario.save(update_fields=updates)
    return bloqueada


def limpiar_bloqueo_login(usuario) -> None:
    usuario.intentos_fallidos_login = 0
    usuario.bloqueado_hasta = None
    usuario.save(update_fields=["intentos_fallidos_login", "bloqueado_hasta"])
