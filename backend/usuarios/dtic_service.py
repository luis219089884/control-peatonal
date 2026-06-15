"""
Servicio de integración con la API DTIC de la UAGRM.

Cuando la DTIC entregue el acceso a su API, configurar en .env:
    DTIC_API_URL=https://api.dtic.uagrm.edu.bo/v1
    DTIC_API_KEY=<clave_provista_por_dtic>

Mientras no esté configurada, el servicio corre en modo SIMULADO
usando datos de prueba para validar el flujo completo.

Formato esperado de la API DTIC (adaptable según documentación real):
[
  {
    "tipo": "estudiante" | "docente" | "administrativo",
    "ci": "12345678",
    "nombres": "Juan Carlos",
    "apellidos": "Pérez López",
    "email": "juan.perez@est.uagrm.edu.bo",
    "celular": "70123456",            # opcional
    "codigo_registro": "201612345",   # matrícula o código docente
    "facultad_codigo": "FCET",        # código de facultad
    "carrera_codigo": "INF",          # solo para estudiantes
    "paralelo": "A",                  # solo para estudiantes
    "modalidad_ingreso": "regular",   # solo para estudiantes
    "periodo_ingreso": "2024-1"       # solo para estudiantes
  },
  ...
]
"""

import os
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

DTIC_API_URL     = os.getenv("DTIC_API_URL", "").strip()
DTIC_API_KEY     = os.getenv("DTIC_API_KEY", "").strip()
DTIC_API_TIMEOUT = int(os.getenv("DTIC_API_TIMEOUT", "30"))


def api_dtic_disponible() -> bool:
    """Retorna True si la API DTIC está configurada en las variables de entorno."""
    return bool(DTIC_API_URL and DTIC_API_KEY)


def _obtener_datos_dtic() -> list[dict]:
    """
    Llama a la API DTIC y retorna la lista de usuarios.
    Si la API no está configurada, lanza un error descriptivo.
    """
    import requests  # type: ignore

    headers = {
        "Authorization": f"Bearer {DTIC_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    url = f"{DTIC_API_URL.rstrip('/')}/usuarios"
    logger.info(f"[DTIC] Llamando a {url}")

    response = requests.get(url, headers=headers, timeout=DTIC_API_TIMEOUT)
    response.raise_for_status()

    data = response.json()
    # La API puede devolver un objeto con lista dentro o directamente una lista
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("data", "usuarios", "results", "items"):
            if key in data and isinstance(data[key], list):
                return data[key]
    raise ValueError(f"Formato de respuesta DTIC no reconocido: {type(data)}")


def _datos_simulados() -> list[dict]:
    """Datos de prueba que imitan la estructura esperada de la API DTIC."""
    return [
        # Estudiantes
        {"tipo": "estudiante", "ci": "9001001", "nombres": "Carlos Andrés", "apellidos": "Gutiérrez Rojas",
         "email": "carlos.gutierrez@est.uagrm.edu.bo", "codigo_registro": "201901001",
         "facultad_codigo": "FCET", "carrera_codigo": "INF", "paralelo": "A",
         "modalidad_ingreso": "regular", "periodo_ingreso": "2019-1"},
        {"tipo": "estudiante", "ci": "9001002", "nombres": "María Fernanda", "apellidos": "López Castro",
         "email": "maria.lopez@est.uagrm.edu.bo", "codigo_registro": "202001002",
         "facultad_codigo": "FCET", "carrera_codigo": "SIS", "paralelo": "B",
         "modalidad_ingreso": "regular", "periodo_ingreso": "2020-1"},
        {"tipo": "estudiante", "ci": "9001003", "nombres": "Diego Alejandro", "apellidos": "Ríos Méndez",
         "email": "diego.rios@est.uagrm.edu.bo", "codigo_registro": "202101003",
         "facultad_codigo": "FCEA", "carrera_codigo": "ADM", "paralelo": "A",
         "modalidad_ingreso": "regular", "periodo_ingreso": "2021-1"},
        # Docentes
        {"tipo": "docente", "ci": "5001001", "nombres": "Roberto", "apellidos": "Vásquez Peña",
         "email": "roberto.vasquez@uagrm.edu.bo", "codigo_registro": "DOC-001",
         "facultad_codigo": "FCET"},
        {"tipo": "docente", "ci": "5001002", "nombres": "Ana Patricia", "apellidos": "Montero Suárez",
         "email": "ana.montero@uagrm.edu.bo", "codigo_registro": "DOC-002",
         "facultad_codigo": "FCEA"},
        # Administrativos
        {"tipo": "administrativo", "ci": "4001001", "nombres": "Jorge Luis", "apellidos": "Barba Torres",
         "email": "jorge.barba@uagrm.edu.bo", "codigo_registro": "ADM-001",
         "facultad_codigo": "FCET"},
    ]


def _obtener_o_crear_rol(nombre: str):
    from usuarios.models import Rol
    rol, _ = Rol.objects.get_or_create(nombre=nombre)
    return rol


def _buscar_facultad(codigo: str):
    from usuarios.models import Facultad
    # Intentar por código en el nombre o descripción
    fac = Facultad.objects.filter(nombre__icontains=codigo, activo=True).first()
    return fac


def _buscar_carrera(codigo: str, facultad):
    from usuarios.models import Carrera
    if not facultad:
        return None
    car = Carrera.objects.filter(codigo__iexact=codigo, facultad=facultad, activo=True).first()
    if not car:
        # Buscar sin restricción de facultad
        car = Carrera.objects.filter(codigo__iexact=codigo, activo=True).first()
    return car


def _importar_usuario(item: dict, password_default: str) -> tuple[str, str]:
    """
    Crea o actualiza un usuario a partir de un registro DTIC.
    Retorna (accion, detalle) donde accion es 'creado'|'actualizado'|'omitido'|'error'.
    """
    from usuarios.models import (
        Usuario, Estudiante, Docente, Administrativo,
        PersonaFacultad,
    )

    tipo = item.get("tipo", "").lower()
    ci   = str(item.get("ci", "")).strip()

    if not ci or tipo not in ("estudiante", "docente", "administrativo"):
        return "omitido", f"CI o tipo inválido: ci={ci!r} tipo={tipo!r}"

    nombres   = item.get("nombres", "").strip()
    apellidos = item.get("apellidos", "").strip()
    email     = item.get("email", f"{ci}@uagrm.edu.bo").strip()

    if not nombres or not apellidos:
        return "omitido", f"Nombres/apellidos vacíos para CI {ci}"

    rol = _obtener_o_crear_rol("usuario")
    facultad = _buscar_facultad(item.get("facultad_codigo", ""))

    try:
        usuario, created = Usuario.objects.get_or_create(
            ci=ci,
            defaults={
                "nombres": nombres,
                "apellidos": apellidos,
                "email": email,
                "celular": item.get("celular", ""),
                "tipo_usuario": tipo,
                "rol": rol,
                "activo": True,
            },
        )

        if not created:
            # Actualizar campos que pueden haber cambiado
            changed = False
            for field, val in [("nombres", nombres), ("apellidos", apellidos), ("email", email)]:
                if getattr(usuario, field) != val:
                    setattr(usuario, field, val)
                    changed = True
            if changed:
                usuario.save(update_fields=["nombres", "apellidos", "email"])

        # Establecer password por defecto solo en usuarios nuevos
        if created:
            usuario.set_password(password_default)
            usuario.save(update_fields=["password"])

        # Crear perfil específico si no existe
        if tipo == "estudiante" and not hasattr(usuario, "estudiante_set"):
            Estudiante.objects.get_or_create(
                usuario=usuario,
                defaults={"codigo_matricula": item.get("codigo_registro", ci)},
            )
        elif tipo == "docente":
            Docente.objects.get_or_create(
                usuario=usuario,
                defaults={"codigo_docente": item.get("codigo_registro", f"DOC-{ci}")},
            )
        elif tipo == "administrativo":
            Administrativo.objects.get_or_create(
                usuario=usuario,
                defaults={"codigo_admin": item.get("codigo_registro", f"ADM-{ci}")},
            )

        # Vincular a facultad/carrera si aplica y no existe vínculo previo
        if facultad and not PersonaFacultad.objects.filter(usuario=usuario, facultad=facultad).exists():
            carrera = None
            if tipo == "estudiante":
                carrera = _buscar_carrera(item.get("carrera_codigo", ""), facultad)
            PersonaFacultad.objects.create(
                usuario=usuario,
                facultad=facultad,
                carrera=carrera,
                tipo_vinculo=tipo,
                paralelo=item.get("paralelo", "") if tipo == "estudiante" else "",
                modalidad_ingreso=item.get("modalidad_ingreso", "") if tipo == "estudiante" else "",
                periodo_ingreso=item.get("periodo_ingreso", "") if tipo == "estudiante" else "",
                activo=True,
            )

        accion = "creado" if created else "actualizado"
        return accion, f"{apellidos} {nombres} (CI {ci})"

    except Exception as e:
        logger.error(f"[DTIC] Error importando CI {ci}: {e}")
        return "error", f"CI {ci}: {str(e)}"


def ejecutar_sincronizacion(iniciado_por, simulado: bool = False) -> dict[str, Any]:
    """
    Punto de entrada principal. Ejecuta la sincronización completa.

    Args:
        iniciado_por: instancia de Usuario que disparó la sync
        simulado: forzar modo simulado aunque la API esté configurada

    Returns:
        dict con estadísticas y detalles de la sincronización
    """
    from usuarios.models import SincronizacionDTIC
    from django.utils import timezone as dj_tz

    usa_api_real = api_dtic_disponible() and not simulado

    sync = SincronizacionDTIC.objects.create(
        iniciado_por=iniciado_por,
        estado="exitoso",
        api_url_usada=DTIC_API_URL if usa_api_real else "SIMULADO",
    )

    creados = actualizados = omitidos = errores = 0
    detalles: list[str] = []
    password_default = "UAGRM2025!"   # temporal; el usuario debe cambiarlo al primer login

    try:
        if usa_api_real:
            datos = _obtener_datos_dtic()
        else:
            datos = _datos_simulados()

        for item in datos:
            accion, detalle = _importar_usuario(item, password_default)
            if accion == "creado":
                creados += 1
            elif accion == "actualizado":
                actualizados += 1
            elif accion == "omitido":
                omitidos += 1
            else:
                errores += 1
            detalles.append(f"[{accion.upper()}] {detalle}")

        estado = "simulado" if not usa_api_real else ("parcial" if errores else "exitoso")

    except Exception as e:
        estado = "fallido"
        errores += 1
        detalles.append(f"[ERROR FATAL] {str(e)}")
        logger.error(f"[DTIC] Sincronización fallida: {e}")

    sync.finalizado_en      = dj_tz.now()
    sync.estado             = estado
    sync.usuarios_creados   = creados
    sync.usuarios_actualizados = actualizados
    sync.usuarios_omitidos  = omitidos
    sync.errores_count      = errores
    sync.detalle            = {"log": detalles[:200]}  # limitar a 200 líneas
    sync.save()

    return {
        "id_sync": sync.id_sync,
        "estado": estado,
        "creados": creados,
        "actualizados": actualizados,
        "omitidos": omitidos,
        "errores": errores,
        "total_procesados": creados + actualizados + omitidos + errores,
        "simulado": not usa_api_real,
        "iniciado_en": sync.iniciado_en.isoformat(),
        "finalizado_en": sync.finalizado_en.isoformat() if sync.finalizado_en else None,
        "log": detalles[:50],  # primeras 50 líneas para la respuesta inmediata
    }
