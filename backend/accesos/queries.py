import json
from datetime import date, datetime, timezone
from typing import List, Optional

import strawberry

from accesos.models import Guardia, Ingreso, Invitado, RegistroIngreso
from accesos.types import (
    GuardiaPanelType,
    IngresoConGuardiaType,
    InvitadoType,
    RegistroIngresoType,
)
from usuarios.utils import get_usuario_from_info


def _ingreso_type_from_model(ing: Ingreso) -> "IngresoType":
    from accesos.types import IngresoType
    from accesos.utils import obtener_sede_de_ingreso
    sede = obtener_sede_de_ingreso(ing)
    return IngresoType(
        id_ingreso=ing.id_ingreso,
        nombre=ing.nombre,
        descripcion=ing.descripcion,
        ubicacion=ing.ubicacion,
        activo=ing.activo,
        sede_nombre=sede.nombre if sede else None,
        facultad=ing.facultad if ing.facultad_id else None,
    )


def _select_related_registros():
    return RegistroIngreso.objects.select_related(
        "ingreso__sede",
        "ingreso__facultad__sede",
        "guardia__usuario__rol",
        "guardia__ingreso__sede",
        "guardia__ingreso__facultad__sede",
    )


@strawberry.type
class AccesoQuery:

    @strawberry.field
    def mis_invitados(self, info) -> List[InvitadoType]:
        """Devuelve todos los invitados registrados por el usuario autenticado."""
        usuario = get_usuario_from_info(info)
        from usuarios.utils import usuario_puede_registrar_invitados
        if not usuario_puede_registrar_invitados(usuario):
            raise Exception("No tienes permiso para ver invitados. Solo docentes y administrativos autorizados.")
        return list(
            Invitado.objects
            .select_related("facultad_destino__sede", "registrado_por")
            .filter(registrado_por=usuario)
            .order_by("-creado_en")
        )

    @strawberry.field
    def mis_registros_hoy(self, info) -> List[RegistroIngresoType]:
        guardia_usuario = get_usuario_from_info(info)
        if guardia_usuario.rol.nombre != "guardia":
            raise Exception("Solo los guardias pueden consultar sus registros.")
        try:
            guardia = Guardia.objects.get(usuario=guardia_usuario)
        except Guardia.DoesNotExist:
            raise Exception("No se encontró guardia asociado a este usuario.")

        hoy = date.today()
        return list(
            _select_related_registros().filter(guardia=guardia, fecha_hora__date=hoy)
        )

    @strawberry.field
    def mi_panel_guardia(self, info) -> GuardiaPanelType:
        guardia_usuario = get_usuario_from_info(info)
        if guardia_usuario.rol.nombre != "guardia":
            raise Exception("Solo los guardias pueden acceder al panel.")
        try:
            guardia = Guardia.objects.select_related(
                "ingreso__sede",
                "ingreso__facultad__sede",
            ).get(usuario=guardia_usuario)
        except Guardia.DoesNotExist:
            raise Exception("No se encontró guardia asociado a este usuario.")

        from accesos.utils import obtener_sede_de_ingreso
        from usuarios.models import PersonalExterno
        horario = "07:00-22:00"
        try:
            pe = PersonalExterno.objects.get(usuario=guardia_usuario)
            if pe.horario:
                horario = pe.horario
        except PersonalExterno.DoesNotExist:
            pass

        sede = obtener_sede_de_ingreso(guardia.ingreso)
        sede_nombre = sede.nombre if sede else "—"
        sede_id = sede.id_sede if sede else 0
        facultad_nombre = guardia.ingreso.facultad.nombre if guardia.ingreso.facultad_id else sede_nombre

        hoy = date.today()
        registros = list(
            _select_related_registros().filter(guardia=guardia, fecha_hora__date=hoy)
        )

        return GuardiaPanelType(
            nombre_completo=f"{guardia_usuario.apellidos} {guardia_usuario.nombres}",
            turno=guardia.turno,
            horario=horario,
            ingreso_id=guardia.ingreso.id_ingreso,
            ingreso_nombre=guardia.ingreso.nombre,
            facultad_nombre=facultad_nombre,
            sede_nombre=sede_nombre,
            sede_id=sede_id,
            registros_hoy=registros,
        )

    @strawberry.field
    def mis_registros(self, info, limite: int = 20) -> List[RegistroIngresoType]:
        usuario = get_usuario_from_info(info)
        if usuario.rol.nombre == "guardia":
            raise Exception("Los guardias usan mis_registros_hoy.")
        return list(
            _select_related_registros()
            .filter(usuario=usuario)
            .order_by("-fecha_hora")[:limite]
        )

    @strawberry.field
    def listar_registros(
        self,
        info,
        fecha_inicio: Optional[date] = None,
        fecha_fin: Optional[date] = None,
        id_sede: Optional[int] = None,
        id_facultad: Optional[int] = None,
        tipo_persona: Optional[str] = None,
        tipo_movimiento: Optional[str] = None,
        metodo: Optional[str] = None,
    ) -> List[RegistroIngresoType]:
        admin = get_usuario_from_info(info)
        if admin.rol.nombre != "admin":
            raise Exception("No tienes permiso para esta acción.")

        qs = _select_related_registros().all()

        if fecha_inicio:
            qs = qs.filter(fecha_hora__date__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(fecha_hora__date__lte=fecha_fin)
        if id_sede:
            qs = qs.filter(sede_acceso_id=id_sede)
        if id_facultad:
            qs = qs.filter(ingreso__facultad__id_facultad=id_facultad)
        if tipo_persona:
            qs = qs.filter(tipo_persona=tipo_persona)
        if tipo_movimiento:
            qs = qs.filter(tipo_movimiento=tipo_movimiento)
        if metodo:
            qs = qs.filter(metodo=metodo)

        return list(qs.order_by("-fecha_hora")[:500])

    @strawberry.field
    def estadisticas_hoy(self, info) -> str:
        admin = get_usuario_from_info(info)
        if admin.rol.nombre != "admin":
            raise Exception("No tienes permiso para esta acción.")

        hoy = date.today()
        qs = RegistroIngreso.objects.filter(fecha_hora__date=hoy)

        total = qs.count()
        entradas = qs.filter(tipo_movimiento="entrada", acceso_permitido=True).count()
        salidas = qs.filter(tipo_movimiento="salida", acceso_permitido=True).count()
        rechazados = qs.filter(acceso_permitido=False).count()

        por_tipo: dict = {}
        for r in qs.values("tipo_persona"):
            tp = r["tipo_persona"]
            por_tipo[tp] = por_tipo.get(tp, 0) + 1

        por_sede: dict = {}
        for r in qs.select_related("sede_acceso").values("sede_acceso__nombre"):
            sede = r["sede_acceso__nombre"] or "Sin sede"
            por_sede[sede] = por_sede.get(sede, 0) + 1

        data = {
            "fecha": str(hoy),
            "total": total,
            "entradas": entradas,
            "salidas": salidas,
            "rechazados": rechazados,
            "por_tipo_persona": por_tipo,
            "por_sede": por_sede,
        }
        return json.dumps(data, ensure_ascii=False)

    @strawberry.field
    def listar_empresas(self, info) -> str:
        admin = get_usuario_from_info(info)
        if admin.rol.nombre != "admin":
            raise Exception("No tienes permiso para esta acción.")
        from usuarios.models import EmpresaExterna, PersonalExterno
        empresas = EmpresaExterna.objects.all().order_by("tipo", "nombre")
        result = []
        for e in empresas:
            trabajadores = PersonalExterno.objects.filter(empresa=e, usuario__activo=True).count()
            result.append({
                "id_empresa": e.id_empresa,
                "nombre": e.nombre,
                "tipo": e.tipo,
                "nit": e.nit or "",
                "contacto_nombre": e.contacto_nombre or "",
                "contrato_vigente": e.contrato_vigente,
                "contrato_desde": str(e.contrato_desde) if e.contrato_desde else "",
                "contrato_hasta": str(e.contrato_hasta) if e.contrato_hasta else "",
                "activo": e.activo,
                "trabajadores_activos": trabajadores,
            })
        return json.dumps(result, ensure_ascii=False)

    @strawberry.field
    def listar_empresas_selector(self, info, tipo: Optional[str] = None) -> str:
        """Lista simplificada de empresas activas para selects en formularios."""
        admin = get_usuario_from_info(info)
        if admin.rol.nombre != "admin":
            raise Exception("No tienes permiso para esta acción.")
        from usuarios.models import EmpresaExterna
        qs = EmpresaExterna.objects.filter(activo=True)
        if tipo:
            qs = qs.filter(tipo=tipo)
        result = [
            {"id_empresa": e.id_empresa, "nombre": e.nombre, "tipo": e.tipo,
             "contrato_vigente": e.contrato_vigente}
            for e in qs.order_by("nombre")
        ]
        return json.dumps(result, ensure_ascii=False)

    @strawberry.field
    def listar_ingresos(self, info, solo_activos: bool = False) -> List[IngresoConGuardiaType]:
        admin = get_usuario_from_info(info)
        if admin.rol.nombre != "admin":
            raise Exception("No tienes permiso para esta acción.")

        qs = Ingreso.objects.select_related("sede", "facultad__sede")
        if solo_activos:
            qs = qs.filter(activo=True)
        ingresos = qs.order_by("sede__nombre", "nombre")

        from accesos.utils import obtener_sede_de_ingreso
        result = []
        for ing in ingresos:
            try:
                g = Guardia.objects.select_related("usuario").get(ingreso=ing)
                guardia_nombre = f"{g.usuario.apellidos} {g.usuario.nombres}"
                turno = g.turno
            except Guardia.DoesNotExist:
                guardia_nombre = None
                turno = None

            sede = obtener_sede_de_ingreso(ing)
            sede_nombre = sede.nombre if sede else "—"
            sede_id = sede.id_sede if sede else 0
            facultad_nombre = ing.facultad.nombre if ing.facultad_id else sede_nombre

            result.append(IngresoConGuardiaType(
                id_ingreso=ing.id_ingreso,
                nombre=ing.nombre,
                descripcion=ing.descripcion,
                ubicacion=ing.ubicacion,
                sede_nombre=sede_nombre,
                facultad_nombre=facultad_nombre,
                guardia_nombre=guardia_nombre,
                turno=turno,
                activo=ing.activo,
                id_facultad=ing.facultad.id_facultad if ing.facultad_id else 0,
                id_sede=sede_id,
            ))
        return result
