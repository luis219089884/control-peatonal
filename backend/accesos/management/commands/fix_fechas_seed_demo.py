"""Corrige fecha_hora de registros demo insertados con auto_now_add."""
from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone as dj_tz

from accesos.models import RegistroIngreso

DISTRIBUCION = (
    ("estudiante", 28),
    ("docente", 10),
    ("administrativo", 5),
    ("personal_externo", 4),
    ("invitado", 2),
    ("logistico", 1),
)


def _fechas_en_rango(inicio: date, fin: date, total: int) -> list[date]:
    dias = []
    d = inicio
    while d <= fin:
        dias.append(d)
        d += timedelta(days=1)
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


class Command(BaseCommand):
    help = "Corrige fechas de los últimos N registros demo (jun 1-17)."

    def add_arguments(self, parser):
        parser.add_argument("--cantidad", type=int, default=50)
        parser.add_argument("--fecha-inicio", default="2026-06-01")
        parser.add_argument("--fecha-fin", default="2026-06-17")

    def handle(self, *args, **options):
        random.seed(20260617)
        n = options["cantidad"]
        inicio = date.fromisoformat(options["fecha_inicio"])
        fin = date.fromisoformat(options["fecha_fin"])
        tz = dj_tz.get_current_timezone()
        fechas = _fechas_en_rango(inicio, fin, n)

        ids = list(
            RegistroIngreso.objects.order_by("-id_registro")
            .values_list("id_registro", flat=True)[:n]
        )
        ids.reverse()

        for i, pk in enumerate(ids):
            f = fechas[i]
            hora = _hora_aleatoria()
            fecha_hora = dj_tz.make_aware(datetime.combine(f, hora), tz)
            RegistroIngreso.objects.filter(pk=pk).update(fecha_hora=fecha_hora)

        self.stdout.write(self.style.SUCCESS(f"Fechas corregidas en {len(ids)} registros."))
