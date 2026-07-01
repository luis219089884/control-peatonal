"""
Exporta sedes, facultades y carreras de la BD actual a un fixture JSON.

Uso (en la BD fuente / local con datos oficiales):
  python manage.py exportar_catalogo_academico
  python manage.py exportar_catalogo_academico --output fixtures/catalogo_academico.json
"""
from __future__ import annotations

from pathlib import Path

from django.core import serializers
from django.core.management.base import BaseCommand

from usuarios.models import Carrera, Facultad, Sede


class Command(BaseCommand):
    help = "Exporta Sede, Facultad y Carrera a fixture JSON para Fase 4."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="fixtures/catalogo_academico.json",
            help="Ruta del archivo JSON de salida.",
        )

    def handle(self, *args, **options):
        out = Path(options["output"])
        if not out.is_absolute():
            out = Path(__file__).resolve().parents[3] / out

        sedes = list(Sede.objects.order_by("id_sede"))
        facultades = list(Facultad.objects.select_related("sede").order_by("id_facultad"))
        carreras = list(Carrera.objects.select_related("facultad").order_by("id_carrera"))

        objs = sedes + facultades + carreras
        out.parent.mkdir(parents=True, exist_ok=True)
        json_data = serializers.serialize("json", objs, indent=2, use_natural_foreign_keys=False)
        out.write_text(json_data, encoding="utf-8")

        self.stdout.write(self.style.SUCCESS(f"Exportado: {out}"))
        self.stdout.write(
            f"  Sedes: {len(sedes)} | Facultades: {len(facultades)} | Carreras: {len(carreras)}"
        )
