import json
from typing import List, Optional

import strawberry

from usuarios.models import (
    Administrativo,
    Carrera,
    Docente,
    Estudiante,
    Facultad,
    PersonalExterno,
    Sede,
    Usuario,
)
from usuarios.types import CarreraType, FacultadType, ResponseType, SedeType, UsuarioType
from usuarios.utils import get_usuario_from_info


def _model_to_usuario_type(u: Usuario) -> UsuarioType:
    return UsuarioType(
        id_usuario=u.id_usuario,
        tipo_usuario=u.tipo_usuario,
        nombres=u.nombres,
        apellidos=u.apellidos,
        ci=u.ci,
        email=u.email,
        celular=u.celular,
        foto_url=u.foto_url,
        activo=u.activo,
        creado_en=u.creado_en,
        rol=u.rol,
    )


@strawberry.type
class UsuarioQuery:

    @strawberry.field
    def mi_perfil(self, info) -> UsuarioType:
        usuario = get_usuario_from_info(info)
        return _model_to_usuario_type(usuario)

    @strawberry.field
    def mi_perfil_extendido(self, info) -> str:
        usuario = get_usuario_from_info(info)
        from usuarios.utils import usuario_puede_registrar_invitados
        data: dict = {
            "id_usuario": usuario.id_usuario,
            "nombres": usuario.nombres,
            "apellidos": usuario.apellidos,
            "ci": usuario.ci,
            "email": usuario.email,
            "tipo_usuario": usuario.tipo_usuario,
            "puede_registrar_invitados": usuario_puede_registrar_invitados(usuario),
        }

        if usuario.tipo_usuario == "estudiante":
            try:
                est = Estudiante.objects.get(usuario=usuario)
                data["nro_registro"] = est.nro_registro
                data["modalidad_ingreso"] = est.modalidad_ingreso
                data["periodo_ingreso"] = est.periodo_ingreso
                data["tipo_sangre"] = est.tipo_sangre
            except Estudiante.DoesNotExist:
                pass
            from accesos.models import PersonaFacultad
            pfs = PersonaFacultad.objects.filter(
                usuario=usuario, activo=True
            ).select_related("facultad__sede", "carrera")
            data["facultades"] = [
                {
                    "facultad": pf.facultad.nombre,
                    "sede": pf.facultad.sede.nombre,
                    "carrera": pf.carrera.nombre if pf.carrera else None,
                }
                for pf in pfs
            ]

        elif usuario.tipo_usuario == "docente":
            try:
                doc = Docente.objects.get(usuario=usuario)
                data["codigo_docente"] = doc.codigo_docente
                data["especialidad"] = doc.especialidad
                data["categoria"] = doc.categoria
            except Docente.DoesNotExist:
                pass
            from accesos.models import PersonaFacultad
            pfs = PersonaFacultad.objects.filter(
                usuario=usuario, tipo_vinculo="docente", activo=True
            ).select_related("facultad__sede", "carrera")
            data["facultades"] = [
                {
                    "facultad": pf.facultad.nombre,
                    "sede": pf.facultad.sede.nombre,
                    "carrera": pf.carrera.nombre if pf.carrera else None,
                }
                for pf in pfs
            ]

        elif usuario.tipo_usuario == "administrativo":
            try:
                adm = Administrativo.objects.get(usuario=usuario)
                data["codigo_admin"] = adm.codigo_admin
                data["cargo"] = adm.cargo
                data["area"] = adm.area
            except Administrativo.DoesNotExist:
                pass

        elif usuario.tipo_usuario == "personal_externo":
            try:
                pe = PersonalExterno.objects.select_related("empresa").get(usuario=usuario)
                data["cargo"] = pe.cargo
                data["empresa"] = pe.empresa.nombre
                data["contrato_vigente"] = pe.empresa.contrato_vigente
            except PersonalExterno.DoesNotExist:
                pass

        return json.dumps(data, default=str, ensure_ascii=False)

    @strawberry.field
    def detalle_usuario(self, info, id_usuario: int) -> str:
        admin = get_usuario_from_info(info)
        if admin.rol.nombre != "admin":
            raise Exception("No tienes permiso para esta acción.")
        try:
            usuario = Usuario.objects.select_related("rol").get(id_usuario=id_usuario)
        except Usuario.DoesNotExist:
            raise Exception("Usuario no encontrado.")

        data: dict = {
            "id_usuario": usuario.id_usuario,
            "tipo_usuario": usuario.tipo_usuario,
            "nombres": usuario.nombres,
            "apellidos": usuario.apellidos,
            "ci": usuario.ci,
            "email": usuario.email or "",
            "celular": usuario.celular or "",
            "activo": usuario.activo,
            "rol": usuario.rol.nombre,
        }

        if usuario.tipo_usuario == "estudiante":
            try:
                est = Estudiante.objects.get(usuario=usuario)
                data["nro_registro"] = est.nro_registro
                data["modalidad_ingreso"] = est.modalidad_ingreso or ""
                data["periodo_ingreso"] = est.periodo_ingreso or ""
            except Estudiante.DoesNotExist:
                pass
            from accesos.models import PersonaFacultad
            pfs = list(
                PersonaFacultad.objects.filter(usuario=usuario, tipo_vinculo="estudiante", activo=True)
                .select_related("facultad", "carrera")
                .order_by("id_persona_facultad")
            )
            data["carreras"] = [
                {
                    "id_carrera": pf.carrera.id_carrera if pf.carrera else None,
                    "carrera_nombre": pf.carrera.nombre if pf.carrera else "",
                    "id_facultad": pf.facultad.id_facultad,
                    "facultad_nombre": pf.facultad.nombre,
                    "paralelo": pf.paralelo or "",
                    "modalidad_ingreso": pf.modalidad_ingreso or "",
                    "periodo_ingreso": pf.periodo_ingreso or "",
                }
                for pf in pfs
            ]
        elif usuario.tipo_usuario == "docente":
            try:
                doc = Docente.objects.get(usuario=usuario)
                data["codigo_docente"] = doc.codigo_docente
                data["especialidad"] = doc.especialidad or ""
                data["categoria"] = doc.categoria or ""
            except Docente.DoesNotExist:
                pass
            from accesos.models import PersonaFacultad
            pfs = list(
                PersonaFacultad.objects.filter(
                    usuario=usuario, tipo_vinculo="docente", activo=True
                )
                .select_related("facultad", "carrera")
                .order_by("id_persona_facultad")
            )
            data["vinculos"] = [
                {
                    "id_facultad": pf.facultad.id_facultad,
                    "facultad_nombre": pf.facultad.nombre,
                    "id_carrera": pf.carrera.id_carrera if pf.carrera else None,
                    "carrera_nombre": pf.carrera.nombre if pf.carrera else "",
                }
                for pf in pfs
            ]
        elif usuario.tipo_usuario == "administrativo":
            try:
                adm = Administrativo.objects.select_related("facultad").get(usuario=usuario)
                data["codigo_admin"] = adm.codigo_admin
                data["nivel_jerarquico_admin"] = adm.nivel_jerarquico
                data["codigo_direccion_admin"] = adm.codigo_direccion or ""
                data["id_facultad_admin"] = adm.facultad.id_facultad if adm.facultad else None
                data["facultad_admin_nombre"] = adm.facultad.nombre if adm.facultad else ""
                data["cargo"] = adm.cargo or ""
                data["area"] = adm.area or ""
                data["puede_registrar_invitados"] = adm.puede_registrar_invitados
            except Administrativo.DoesNotExist:
                pass
        elif usuario.tipo_usuario == "personal_externo":
            try:
                pe = PersonalExterno.objects.select_related("empresa").get(usuario=usuario)
                data["empresa"] = pe.empresa.nombre
                data["cargo"] = pe.cargo or ""
            except PersonalExterno.DoesNotExist:
                pass
            if usuario.rol.nombre == "guardia":
                from accesos.models import Guardia
                try:
                    g = Guardia.objects.get(usuario=usuario)
                    data["id_ingreso"] = g.ingreso_id
                    data["turno"] = g.turno
                except Guardia.DoesNotExist:
                    pass

        return json.dumps(data, default=str, ensure_ascii=False)

    @strawberry.field
    def listar_usuarios(
        self,
        info,
        tipo_usuario: Optional[str] = None,
        activo: Optional[bool] = None,
    ) -> List[UsuarioType]:
        admin = get_usuario_from_info(info)
        if admin.rol.nombre != "admin":
            raise Exception("No tienes permiso para esta acción.")
        qs = Usuario.objects.select_related("rol").all()
        if tipo_usuario:
            qs = qs.filter(tipo_usuario=tipo_usuario)
        if activo is not None:
            qs = qs.filter(activo=activo)
        return [_model_to_usuario_type(u) for u in qs]

    @strawberry.field
    def listar_direcciones_uagrm(self) -> str:
        """Lista fija de direcciones/unidades centrales de la UAGRM."""
        DIRECCIONES = [
            {"codigo": "RECTORIA",      "nombre": "Rectoría"},
            {"codigo": "VICERRECTORIA", "nombre": "Vicerrectoría"},
            {"codigo": "SEC_GRAL",      "nombre": "Secretaría General"},
            {"codigo": "RRPPNII",       "nombre": "Relaciones Públicas, Nacionales e Internacionales"},
            {"codigo": "DICIT",         "nombre": "Dirección de Investigación, Ciencia, Innovación y Tecnología"},
            {"codigo": "DAEF",          "nombre": "Dirección Administrativa Económica y Financiera"},
            {"codigo": "DH",            "nombre": "Dirección de Desarrollo Humano"},
            {"codigo": "DTIC",          "nombre": "Dirección de Tecnología de la Información"},
            {"codigo": "DUBS",          "nombre": "Dirección de Bienestar Social"},
            {"codigo": "DAJ",           "nombre": "Dirección de Asesoría Jurídica"},
            {"codigo": "CONTABILIDAD",  "nombre": "Departamento de Contabilidad"},
            {"codigo": "PRESUPUESTO",   "nombre": "Departamento de Presupuesto"},
            {"codigo": "PERSONAL",      "nombre": "Departamento de Personal"},
            {"codigo": "ACTIVO_FIJO",   "nombre": "Jefatura de Activo Fijo"},
            {"codigo": "ALMACEN",       "nombre": "Unidad de Almacén"},
            {"codigo": "OTRO",          "nombre": "Otra unidad / dirección"},
        ]
        return json.dumps(DIRECCIONES, ensure_ascii=False)

    @strawberry.field
    def listar_niveles_admin(self) -> str:
        """Lista de niveles jerárquicos administrativos con info de permiso."""
        NIVELES = [
            {"valor": "autoridad_ejecutiva", "label": "Autoridad Ejecutiva (Rector, Vicerrector, Decano, Vicedecano)", "puede_invitar": True},
            {"valor": "direccion",           "label": "Dirección / Secretaría General", "puede_invitar": True},
            {"valor": "jefatura",            "label": "Jefatura / Encargado de Unidad", "puede_invitar": True},
            {"valor": "profesional_tecnico", "label": "Profesional Técnico (Analista, Auditor, Contador...)", "puede_invitar": False},
            {"valor": "apoyo_secretarial",   "label": "Apoyo Secretarial y Administrativo", "puede_invitar": False},
            {"valor": "operativo",           "label": "Operativo / Servicios Generales", "puede_invitar": False},
        ]
        return json.dumps(NIVELES, ensure_ascii=False)

    @strawberry.field
    def listar_sedes(self, info) -> List[SedeType]:
        usuario = get_usuario_from_info(info)
        if usuario.rol.nombre != "admin":
            raise Exception("No tienes permiso para esta acción.")
        return list(Sede.objects.filter(activo=True).order_by("nombre"))

    @strawberry.field
    def listar_facultades(self, solo_activas: bool = True) -> List[FacultadType]:
        qs = Facultad.objects.select_related("sede")
        if solo_activas:
            qs = qs.filter(activo=True)
        return list(qs.order_by("sede__nombre", "nombre"))

    @strawberry.field
    def listar_carreras(
        self, id_facultad: Optional[int] = None, solo_activas: bool = True
    ) -> List[CarreraType]:
        qs = Carrera.objects.select_related("facultad__sede")
        if solo_activas:
            qs = qs.filter(activo=True)
        if id_facultad:
            qs = qs.filter(facultad__id_facultad=id_facultad)
        return list(qs.order_by("facultad__nombre", "nombre"))

    @strawberry.field
    def listar_sincronizaciones_dtic(self, info) -> str:
        """Lista el historial de sincronizaciones con la API DTIC."""
        admin = get_usuario_from_info(info)
        if admin.rol.nombre != "admin":
            raise Exception("No tienes permiso para esta acción.")

        from usuarios.models import SincronizacionDTIC
        syncs = SincronizacionDTIC.objects.select_related("iniciado_por").order_by("-iniciado_en")[:50]
        result = []
        for s in syncs:
            result.append({
                "id_sync": s.id_sync,
                "estado": s.estado,
                "creados": s.usuarios_creados,
                "actualizados": s.usuarios_actualizados,
                "omitidos": s.usuarios_omitidos,
                "errores": s.errores_count,
                "total": s.usuarios_creados + s.usuarios_actualizados + s.usuarios_omitidos + s.errores_count,
                "simulado": s.api_url_usada == "SIMULADO",
                "iniciado_en": s.iniciado_en.isoformat(),
                "finalizado_en": s.finalizado_en.isoformat() if s.finalizado_en else None,
                "iniciado_por": f"{s.iniciado_por.apellidos} {s.iniciado_por.nombres}" if s.iniciado_por else "Sistema",
                "log": s.detalle.get("log", [])[:20],
            })
        return json.dumps(result, ensure_ascii=False)

    @strawberry.field
    def estado_dtic_api(self, info) -> str:
        """Devuelve si la API DTIC está configurada y disponible."""
        admin = get_usuario_from_info(info)
        if admin.rol.nombre != "admin":
            raise Exception("No tienes permiso.")
        from usuarios.dtic_service import api_dtic_disponible, DTIC_API_URL
        return json.dumps({
            "configurada": api_dtic_disponible(),
            "url": DTIC_API_URL if api_dtic_disponible() else None,
        }, ensure_ascii=False)
