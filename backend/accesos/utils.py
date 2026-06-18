"""
Utilidades de lógica de negocio para el módulo de accesos.
"""
from __future__ import annotations

import re
from typing import Optional

# Solo estos perfiles pueden entrar/salir por cualquier sede de la UAGRM.
TIPOS_ACCESO_LIBRE_SEDE = frozenset({"estudiante", "docente", "administrativo"})


def normalizar_nombre_porton(nombre: str) -> str:
    """
    Unifica el nombre de un punto de acceso con el prefijo institucional 'Portón'.
    Convierte variantes como 'puerta', 'porton' o 'Porton' al formato estándar.
    """
    texto = " ".join(nombre.strip().split())
    if not texto:
        return texto
    cuerpo = re.sub(r"^(puerta|portón|porton)\s+", "", texto, flags=re.IGNORECASE)
    palabras = []
    for palabra in cuerpo.split():
        if palabra.isupper():
            palabras.append(palabra)
        else:
            palabras.append(palabra.capitalize())
    cuerpo = " ".join(palabras)
    return f"Portón {cuerpo}" if cuerpo else "Portón"


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


def esta_adentro_logistico(ci: str, sede_id: int) -> bool:
    """Determina si una persona logística está adentro de la sede según su CI."""
    from accesos.models import RegistroIngreso
    ci = (ci or "").strip()
    if not ci:
        return False
    ultimo = (
        RegistroIngreso.objects
        .filter(
            ci_logistico=ci,
            sede_acceso_id=sede_id,
            acceso_permitido=True,
            metodo="logistico",
            tipo_persona="logistico",
        )
        .order_by("-fecha_hora")
        .values("tipo_movimiento")
        .first()
    )
    return ultimo is not None and ultimo["tipo_movimiento"] == "entrada"


def datos_logistico_adentro(ci: str, sede_id: int) -> Optional[dict]:
    """
    Si la persona logística está adentro de la sede, devuelve nombre y motivo
    del registro de entrada vigente.
    """
    from accesos.models import RegistroIngreso
    ci = (ci or "").strip()
    if not ci or not esta_adentro_logistico(ci, sede_id):
        return None
    ultimo = (
        RegistroIngreso.objects
        .filter(
            ci_logistico=ci,
            sede_acceso_id=sede_id,
            acceso_permitido=True,
            metodo="logistico",
            tipo_persona="logistico",
        )
        .order_by("-fecha_hora")
        .first()
    )
    if not ultimo or ultimo.tipo_movimiento != "entrada":
        return None
    return {
        "nombre": ultimo.nombre_completo,
        "motivo": ultimo.motivo_logistico or "",
    }


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


def sede_id_de_invitado(invitado) -> Optional[int]:
    """Sede autorizada para un invitado (la de su facultad destino)."""
    if invitado.facultad_destino_id and invitado.facultad_destino.sede_id:
        return invitado.facultad_destino.sede_id
    return None


def invitado_puede_acceder_sede(invitado, sede_id: int) -> bool:
    """Invitado solo puede acceder por portones de la sede de su facultad destino."""
    destino = sede_id_de_invitado(invitado)
    return destino is not None and destino == sede_id


def usuario_puede_acceder_sede(usuario, sede_id: int) -> bool:
    """
    Estudiantes, docentes y administrativos: cualquier sede.
    Personal externo: solo sedes de sus facultades vinculadas (PersonaFacultad).
    """
    if usuario.tipo_usuario in TIPOS_ACCESO_LIBRE_SEDE:
        return True
    if usuario.tipo_usuario == "personal_externo":
        from accesos.models import PersonaFacultad
        return PersonaFacultad.objects.filter(
            usuario=usuario,
            activo=True,
            facultad__sede_id=sede_id,
        ).exists()
    return False


def nombres_sedes_autorizadas_usuario(usuario) -> list[str]:
    """Sedes donde un usuario puede acceder (solo aplica a personal externo)."""
    if usuario.tipo_usuario != "personal_externo":
        return []
    from accesos.models import PersonaFacultad
    return list(
        PersonaFacultad.objects.filter(
            usuario=usuario,
            activo=True,
            facultad__sede__isnull=False,
        )
        .values_list("facultad__sede__nombre", flat=True)
        .distinct()
        .order_by("facultad__sede__nombre")
    )


def mensaje_rechazo_sede_invitado(invitado) -> str:
    """Mensaje cuando un invitado escanea en una sede distinta a la autorizada."""
    if invitado.facultad_destino_id and invitado.facultad_destino.sede_id:
        sede_nombre = invitado.facultad_destino.sede.nombre
        return f"Acceso no válido en esta sede. Debe presentarse en: {sede_nombre}."
    return "Acceso no válido en esta sede. No tiene sede de destino asignada."


def mensaje_rechazo_sede_usuario(usuario) -> str:
    """Mensaje cuando un usuario no puede acceder en la sede del portón."""
    nombres = nombres_sedes_autorizadas_usuario(usuario)
    if not nombres:
        return "Acceso no válido en esta sede. No tiene sedes autorizadas para su perfil."
    lista = ", ".join(nombres)
    return f"Acceso no válido en esta sede. Debe presentarse en: {lista}."


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
