"""Resolución de operador (guardia o admin) para registro de accesos."""
from dataclasses import dataclass
from typing import Optional, Tuple

from accesos.models import Guardia, Ingreso


@dataclass
class OperadorAcceso:
    usuario: object
    ingreso: Ingreso
    guardia: Optional[Guardia]


def resolver_operador_acceso(
    usuario,
    id_ingreso: int,
) -> Tuple[Optional[OperadorAcceso], Optional[str]]:
    """
    Valida permisos y devuelve el operador, portón e (opcional) guardia asignado al portón.
    Guardia: portón fijo de su asignación.
    Admin: cualquier portón activo; guardia puede ser None si no hay asignación.
    """
    rol = usuario.rol.nombre

    if rol not in ("guardia", "admin"):
        return None, "No tienes permiso para registrar accesos."

    if not usuario.activo:
        return None, "Usuario desactivado."

    try:
        ingreso = Ingreso.objects.select_related(
            "sede", "facultad__sede"
        ).get(id_ingreso=id_ingreso)
    except Ingreso.DoesNotExist:
        return None, "Punto de acceso no encontrado."

    if rol == "admin":
        if not ingreso.activo:
            return None, "Este portón está inactivo."
        guardia = (
            Guardia.objects
            .select_related("ingreso__sede", "ingreso__facultad__sede")
            .filter(ingreso=ingreso)
            .first()
        )
        return OperadorAcceso(usuario=usuario, ingreso=ingreso, guardia=guardia), None

    try:
        guardia = Guardia.objects.select_related(
            "ingreso__sede", "ingreso__facultad__sede"
        ).get(usuario=usuario)
    except Guardia.DoesNotExist:
        return None, "No se encontró un guardia asociado a este usuario."

    if guardia.ingreso.id_ingreso != id_ingreso:
        return None, "No estás asignado a este portón."

    return OperadorAcceso(usuario=usuario, ingreso=ingreso, guardia=guardia), None
