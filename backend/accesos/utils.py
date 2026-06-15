"""
Utilidades de lógica de negocio para el módulo de accesos.
"""
from __future__ import annotations

from typing import Optional


def esta_adentro_sede(usuario_id: int, sede_id: int) -> bool:
    """
    Determina si un usuario UAGRM está actualmente dentro de una sede.

    Regla: el último registro de acceso PERMITIDO para (usuario, sede)
    es de tipo 'entrada' → está adentro.
    Si no hay registros, o el último es 'salida' → está afuera.
    """
    from accesos.models import RegistroIngreso
    ultimo = (
        RegistroIngreso.objects
        .filter(
            usuario_id=usuario_id,
            sede_acceso_id=sede_id,
            acceso_permitido=True,
            tipo_persona__in=("estudiante", "docente", "administrativo", "personal_externo"),
        )
        .order_by("-fecha_hora")
        .values("tipo_movimiento")
        .first()
    )
    return ultimo is not None and ultimo["tipo_movimiento"] == "entrada"


def esta_adentro_sede_invitado(invitado_id: int, sede_id: int) -> bool:
    """
    Determina si un invitado está actualmente dentro de una sede.
    Misma regla: último registro permitido de (invitado, sede).
    """
    from accesos.models import RegistroIngreso
    ultimo = (
        RegistroIngreso.objects
        .filter(
            invitado_id=invitado_id,
            sede_acceso_id=sede_id,
            acceso_permitido=True,
        )
        .order_by("-fecha_hora")
        .values("tipo_movimiento")
        .first()
    )
    return ultimo is not None and ultimo["tipo_movimiento"] == "entrada"


def obtener_sede_de_ingreso(ingreso) -> Optional[object]:
    """
    Devuelve la sede efectiva de un portón (Ingreso).
    Primero usa la FK directa a Sede; si no, usa la sede de su facultad.
    """
    if ingreso.sede_id:
        return ingreso.sede
    if ingreso.facultad_id and ingreso.facultad.sede_id:
        return ingreso.facultad.sede
    return None


def invitado_visita_completada(invitado_id: int, sede_id: int) -> bool:
    """True si el invitado ya registró entrada y salida en la sede."""
    from accesos.models import RegistroIngreso
    base = RegistroIngreso.objects.filter(
        invitado_id=invitado_id,
        sede_acceso_id=sede_id,
        acceso_permitido=True,
    )
    return (
        base.filter(tipo_movimiento="entrada").exists()
        and base.filter(tipo_movimiento="salida").exists()
    )


def tokens_invitado_usados(invitado_id: int) -> dict:
    """
    Retorna cuántos QR de entrada y salida ya fueron usados por un invitado.
    Invitado solo puede tener 1 QR de entrada y 1 de salida.
    """
    from accesos.models import QrToken
    qs = QrToken.objects.filter(invitado_id=invitado_id, usado=True)
    return {
        "entradas_usadas": qs.filter(tipo_movimiento="entrada").count(),
        "salidas_usadas": qs.filter(tipo_movimiento="salida").count(),
    }


def puede_generar_qr_invitado(invitado_id: int, tipo_movimiento: str) -> tuple[bool, str]:
    """
    Verifica si un invitado puede generar un QR del tipo solicitado.
    Reglas:
    - Entrada: solo 1 permitida; no puede generar si ya tiene 1 usado o pendiente.
    - Salida:  solo 1 permitida; solo si ya tiene entrada registrada.
    """
    from accesos.models import QrToken
    from datetime import datetime, timezone

    ahora = datetime.now(tz=timezone.utc)

    if tipo_movimiento == "entrada":
        ya_usado = QrToken.objects.filter(
            invitado_id=invitado_id,
            tipo_movimiento="entrada",
            usado=True,
        ).exists()
        if ya_usado:
            return False, "El invitado ya utilizó su acceso de entrada."

        pendiente = QrToken.objects.filter(
            invitado_id=invitado_id,
            tipo_movimiento="entrada",
            usado=False,
            expira_en__gt=ahora,
        ).exists()
        if pendiente:
            return False, "Ya existe un QR de entrada vigente para este invitado."

    elif tipo_movimiento == "salida":
        ya_usado = QrToken.objects.filter(
            invitado_id=invitado_id,
            tipo_movimiento="salida",
            usado=True,
        ).exists()
        if ya_usado:
            return False, "El invitado ya utilizó su acceso de salida."

        entrada_registrada = QrToken.objects.filter(
            invitado_id=invitado_id,
            tipo_movimiento="entrada",
            usado=True,
        ).exists()
        if not entrada_registrada:
            return False, "El invitado aún no registró su entrada."

    return True, ""
