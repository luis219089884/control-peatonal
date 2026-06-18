"""
Inserta registros de acceso de demostración sin borrar datos existentes.
Uso: python manage.py seed_accesos_demo
"""
from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone as dj_tz

from accesos.models import Guardia, Invitado, RegistroIngreso
from accesos.utils import obtener_sede_de_ingreso
from usuarios.models import Usuario

DISTRIBUCION = (
    ("estudiante", 28),
    ("docente", 10),
    ("administrativo", 5),
    ("personal_externo", 4),
    ("invitado", 2),
    ("logistico", 1),
)

NOMBRES_INVITADO_DEMO = [
    ("García López", "María Elena"),
    ("Rojas Vega", "Carlos Alberto"),
]

NOMBRES_LOGISTICO_DEMO = [
    ("Mendoza", "Juan Delivery", "8912345", "Delivery"),
]


def _nombre_usuario(u: Usuario) -> str:
    return f"{u.apellidos} {u.nombres}"


def _datos_vinculo(u: Usuario) -> tuple[str, str, str]:
    from accesos.models import PersonaFacultad

    pf = (
        PersonaFacultad.objects
        .select_related("facultad__sede", "carrera")
        .filter(usuario=u, activo=True)
        .first()
    )
    if not pf:
        return "", "", ""
    sede = pf.facultad.sede.nombre if pf.facultad.sede_id else ""
    carrera = pf.carrera.nombre if pf.carrera_id else ""
    return sede, pf.facultad.nombre, carrera


def _fechas_en_rango(inicio: date, fin: date, total: int) -> list[date]:
    dias = []
    d = inicio
    while d <= fin:
        dias.append(d)
        d += timedelta(days=1)
    if not dias:
        return []
    random.shuffle(dias)
    out: list[date] = []
    for i in range(total):
        out.append(dias[i % len(dias)])
    random.shuffle(out)
    return out


def _hora_aleatoria() -> time:
    h = random.randint(7, 21)
    m = random.choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    return time(h, m)


def _metodo_para(tipo: str) -> str:
    if tipo == "logistico":
        return "logistico"
    if tipo == "invitado":
        return "qr"
    if tipo == "personal_externo":
        return random.choices(["qr", "manual"], weights=[70, 30])[0]
    return random.choices(["qr", "manual"], weights=[85, 15])[0]


class Command(BaseCommand):
    help = "Inserta registros de acceso demo (solo INSERT, no borra datos)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--fecha-inicio",
            default="2026-06-01",
            help="Primera fecha inclusive (YYYY-MM-DD).",
        )
        parser.add_argument(
            "--fecha-fin",
            default="2026-06-17",
            help="Última fecha inclusive (YYYY-MM-DD).",
        )
        parser.add_argument(
            "--total",
            type=int,
            default=50,
            help="Cantidad total de registros a crear.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula sin escribir en la base de datos.",
        )

    def handle(self, *args, **options):
        random.seed(20260617)

        try:
            fecha_inicio = date.fromisoformat(options["fecha_inicio"])
            fecha_fin = date.fromisoformat(options["fecha_fin"])
        except ValueError as e:
            raise CommandError(f"Fecha inválida: {e}") from e

        total_pedido = options["total"]
        esperado = sum(n for _, n in DISTRIBUCION)
        if total_pedido != esperado:
            self.stdout.write(
                self.style.WARNING(
                    f"AVISO: --total={total_pedido} pero la distribución fija suma {esperado}. "
                    f"Se usarán {esperado} registros."
                )
            )

        guardias = list(
            Guardia.objects.select_related(
                "usuario", "ingreso__sede", "ingreso__facultad__sede"
            )
        )
        if not guardias:
            raise CommandError("No hay guardias con portón asignado en la base de datos.")

        tz = dj_tz.get_current_timezone()
        fechas = _fechas_en_rango(fecha_inicio, fecha_fin, esperado)
        creados = 0
        invitados_qs = list(Invitado.objects.filter(activo=True)[:5])

        for tipo, cantidad in DISTRIBUCION:
            usuarios = list(
                Usuario.objects.filter(tipo_usuario=tipo, activo=True)
                .exclude(rol__nombre="guardia")
                .order_by("id_usuario")
            )
            for i in range(cantidad):
                guardia = random.choice(guardias)
                ingreso = guardia.ingreso
                sede_obj = obtener_sede_de_ingreso(ingreso)
                if not sede_obj:
                    raise CommandError(f"El portón {ingreso.nombre} no tiene sede asignada.")

                f = fechas[creados]
                hora = _hora_aleatoria()
                naive = datetime.combine(f, hora)
                fecha_hora = dj_tz.make_aware(naive, tz)

                metodo = _metodo_para(tipo)
                tipo_mov = random.choice(["entrada", "salida"])

                usuario_obj = None
                invitado_obj = None
                ci_log = None
                motivo_log = None

                if tipo == "logistico":
                    _, nombre, ci, motivo = NOMBRES_LOGISTICO_DEMO[0]
                    nombre_completo = nombre
                    ci_log = ci
                    motivo_log = motivo
                    sede_p, fac_p, car_p = sede_obj.nombre, "", ""
                elif tipo == "invitado":
                    if invitados_qs:
                        inv = invitados_qs[i % len(invitados_qs)]
                        invitado_obj = inv
                        nombre_completo = f"{inv.apellidos} {inv.nombres}"
                        sede_p = inv.facultad_destino.sede.nombre if inv.facultad_destino.sede_id else ""
                        fac_p = inv.facultad_destino.nombre
                        car_p = ""
                    else:
                        ap, nom = NOMBRES_INVITADO_DEMO[i % len(NOMBRES_INVITADO_DEMO)]
                        nombre_completo = f"{ap} {nom}"
                        sede_p = sede_obj.nombre
                        fac_p = ingreso.facultad.nombre if ingreso.facultad_id else sede_obj.nombre
                        car_p = ""
                else:
                    if not usuarios:
                        raise CommandError(
                            f"No hay usuarios activos de tipo '{tipo}' en la base de datos."
                        )
                    u = usuarios[i % len(usuarios)]
                    usuario_obj = u
                    nombre_completo = _nombre_usuario(u)
                    sede_p, fac_p, car_p = _datos_vinculo(u)
                    if not sede_p:
                        sede_p = sede_obj.nombre

                if options["dry_run"]:
                    self.stdout.write(
                        f"  [dry-run] {f} {hora} | {tipo_mov} | {tipo} | {nombre_completo}"
                    )
                    creados += 1
                    continue

                RegistroIngreso.objects.create(
                    token=None,
                    ingreso=ingreso,
                    guardia=guardia,
                    registrado_por=guardia.usuario,
                    sede_acceso=sede_obj,
                    usuario=usuario_obj,
                    invitado=invitado_obj,
                    tipo_persona=tipo,
                    tipo_movimiento=tipo_mov,
                    metodo=metodo,
                    nombre_completo=nombre_completo,
                    sede_pertenece=sede_p or sede_obj.nombre,
                    facultad_pertenece=fac_p or None,
                    carrera_pertenece=car_p or None,
                    ci_logistico=ci_log,
                    motivo_logistico=motivo_log,
                    acceso_permitido=True,
                    fecha_hora=fecha_hora,
                )
                creados += 1

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS(f"Dry-run: se crearían {creados} registros."))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Listo: {creados} registros insertados "
                    f"({fecha_inicio} al {fecha_fin})."
                )
            )
