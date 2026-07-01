"""
Fase 4 — Reset de BD de producción/prueba.

Mantiene: roles, permisos, usuario administrador.
Elimina: registros de acceso, usuarios demo, catálogo académico viejo, portones, etc.
Importa: sedes/facultades/carreras oficiales desde fixture o BD fuente.

Uso típico:
  # 1) En LOCAL (datos oficiales):
  python manage.py exportar_catalogo_academico

  # 2) Apuntar .env a Railway/cloud y ejecutar:
  python manage.py reset_bd_fase4 --dry-run
  python manage.py reset_bd_fase4 --confirm --import-catalog fixtures/catalogo_academico.json

  # O importar directo desde PostgreSQL local (SOURCE_DB_* en .env):
  python manage.py reset_bd_fase4 --confirm --from-source-db
"""
from __future__ import annotations

import shutil
from pathlib import Path

import psycopg2
from decouple import config
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from accesos.models import Guardia, Ingreso, Invitado, PersonaFacultad, QrToken, RegistroIngreso
from usuarios.models import (
    Administrativo,
    Carrera,
    Docente,
    EmpresaExterna,
    Estudiante,
    Facultad,
    FotoRostro,
    PersonalExterno,
    Permiso,
    Rol,
    Sede,
    SincronizacionDTIC,
    Usuario,
)


def _count_deleted(result) -> int:
    if isinstance(result, tuple) and result:
        return result[0]
    return 0


class Command(BaseCommand):
    help = "Reset Fase 4: limpia datos de prueba y carga catálogo académico oficial."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="OBLIGATORIO para ejecutar el borrado real.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Solo muestra qué se borraría/importaría sin cambiar la BD.",
        )
        parser.add_argument(
            "--admin-email",
            default="admin@uagrm.edu.bo",
            help="Email del administrador que se conservará.",
        )
        parser.add_argument(
            "--import-catalog",
            default="",
            help="Fixture JSON con Sede, Facultad, Carrera (exportar_catalogo_academico).",
        )
        parser.add_argument(
            "--from-source-db",
            action="store_true",
            help="Copiar catálogo desde SOURCE_DB_* definido en .env (PostgreSQL local).",
        )
        parser.add_argument(
            "--keep-empresas",
            action="store_true",
            help="No eliminar empresas externas.",
        )
        parser.add_argument(
            "--clean-media-rostros",
            action="store_true",
            help="Borrar carpeta media/rostros/ tras el reset.",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        confirm: bool = options["confirm"]
        admin_email: str = options["admin_email"]
        import_catalog: str = (options["import_catalog"] or "").strip()
        from_source_db: bool = options["from_source_db"]

        if not dry_run and not confirm:
            raise CommandError(
                "Operación destructiva. Use --dry-run para simular o --confirm para ejecutar."
            )

        if import_catalog and from_source_db:
            raise CommandError("Use solo uno: --import-catalog o --from-source-db.")

        try:
            admin = Usuario.objects.select_related("rol").get(email=admin_email)
        except Usuario.DoesNotExist:
            raise CommandError(f"No existe usuario admin con email: {admin_email}")

        if admin.rol.nombre != "admin":
            raise CommandError(f"El usuario {admin_email} no tiene rol admin.")

        stats = self._preview_counts(admin.id_usuario, options["keep_empresas"])
        self._print_preview(stats, admin)

        if dry_run:
            if import_catalog:
                self.stdout.write(f"\nImportaría fixture: {import_catalog}")
            if from_source_db:
                self.stdout.write("\nImportaría catálogo desde SOURCE_DB_*")
            self.stdout.write(self.style.WARNING("\n[DRY-RUN] No se realizaron cambios."))
            return

        with transaction.atomic():
            deleted = self._delete_data(admin.id_usuario, options["keep_empresas"])
            self.stdout.write(self.style.WARNING("\nDatos eliminados:"))
            for k, v in deleted.items():
                self.stdout.write(f"  {k}: {v}")

            if from_source_db:
                imported = self._import_from_source_db()
            elif import_catalog:
                imported = self._import_from_fixture(import_catalog)
            else:
                imported = None
                self.stdout.write(
                    self.style.WARNING(
                        "\nSin importación de catálogo. "
                        "Use --import-catalog o --from-source-db."
                    )
                )

            self._reset_sequences()

        if options["clean_media_rostros"]:
            media_rostros = Path(__file__).resolve().parents[3] / "media" / "rostros"
            if media_rostros.exists():
                shutil.rmtree(media_rostros)
                self.stdout.write(f"Eliminado: {media_rostros}")

        self.stdout.write(self.style.SUCCESS("\nReset Fase 4 completado."))
        if imported:
            self.stdout.write(
                f"Catálogo importado: {imported['sedes']} sedes, "
                f"{imported['facultades']} facultades, {imported['carreras']} carreras."
            )
        self.stdout.write(
            f"Admin conservado: {admin.apellidos} {admin.nombres} ({admin.email})"
        )
        self.stdout.write(
            "Siguiente: crear portones (Ingreso), guardias y usuarios reales desde admin o DTIC."
        )

    def _preview_counts(self, admin_id: int, keep_empresas: bool) -> dict:
        return {
            "registro_ingreso": RegistroIngreso.objects.count(),
            "qr_token": QrToken.objects.count(),
            "guardia": Guardia.objects.count(),
            "persona_facultad": PersonaFacultad.objects.count(),
            "invitado": Invitado.objects.count(),
            "foto_rostro": FotoRostro.objects.count(),
            "estudiante": Estudiante.objects.exclude(usuario_id=admin_id).count(),
            "docente": Docente.objects.exclude(usuario_id=admin_id).count(),
            "administrativo": Administrativo.objects.exclude(usuario_id=admin_id).count(),
            "personal_externo": PersonalExterno.objects.exclude(usuario_id=admin_id).count(),
            "sincronizacion_dtic": SincronizacionDTIC.objects.count(),
            "usuario": Usuario.objects.exclude(id_usuario=admin_id).count(),
            "ingreso": Ingreso.objects.count(),
            "carrera": Carrera.objects.count(),
            "facultad": Facultad.objects.count(),
            "sede": Sede.objects.count(),
            "empresa_externa": 0 if keep_empresas else EmpresaExterna.objects.count(),
            "rol": Rol.objects.count(),
            "permiso": Permiso.objects.count(),
        }

    def _print_preview(self, stats: dict, admin: Usuario) -> None:
        self.stdout.write(self.style.HTTP_INFO("=== Reset BD Fase 4 ==="))
        self.stdout.write(f"BD destino: {connection.settings_dict.get('HOST')} / {connection.settings_dict.get('NAME')}")
        self.stdout.write(f"Admin a conservar: {admin.email} (id={admin.id_usuario})")
        self.stdout.write(self.style.WARNING("\nRegistros a eliminar:"))
        for k, v in stats.items():
            if k in ("rol", "permiso"):
                continue
            self.stdout.write(f"  {k}: {v}")
        self.stdout.write(self.style.SUCCESS(f"\nSe conservan: roles ({stats['rol']}), permisos ({stats['permiso']})"))

    def _delete_data(self, admin_id: int, keep_empresas: bool) -> dict:
        out = {}
        out["registro_ingreso"] = _count_deleted(RegistroIngreso.objects.all().delete())
        out["qr_token"] = _count_deleted(QrToken.objects.all().delete())
        out["guardia"] = _count_deleted(Guardia.objects.all().delete())
        out["persona_facultad"] = _count_deleted(PersonaFacultad.objects.all().delete())
        out["invitado"] = _count_deleted(Invitado.objects.all().delete())
        out["foto_rostro"] = _count_deleted(FotoRostro.objects.all().delete())
        out["estudiante"] = _count_deleted(Estudiante.objects.exclude(usuario_id=admin_id).delete())
        out["docente"] = _count_deleted(Docente.objects.exclude(usuario_id=admin_id).delete())
        out["administrativo"] = _count_deleted(
            Administrativo.objects.exclude(usuario_id=admin_id).delete()
        )
        out["personal_externo"] = _count_deleted(
            PersonalExterno.objects.exclude(usuario_id=admin_id).delete()
        )
        out["sincronizacion_dtic"] = _count_deleted(SincronizacionDTIC.objects.all().delete())
        out["usuario"] = _count_deleted(Usuario.objects.exclude(id_usuario=admin_id).delete())
        out["ingreso"] = _count_deleted(Ingreso.objects.all().delete())
        out["carrera"] = _count_deleted(Carrera.objects.all().delete())
        out["facultad"] = _count_deleted(Facultad.objects.all().delete())
        out["sede"] = _count_deleted(Sede.objects.all().delete())
        if keep_empresas:
            out["empresa_externa"] = 0
        else:
            out["empresa_externa"] = _count_deleted(EmpresaExterna.objects.all().delete())
        return out

    def _import_from_fixture(self, path: str) -> dict:
        fixture = Path(path)
        if not fixture.is_absolute():
            fixture = Path(__file__).resolve().parents[3] / fixture
        if not fixture.exists():
            raise CommandError(f"Fixture no encontrado: {fixture}")
        call_command("loaddata", str(fixture))
        return {
            "sedes": Sede.objects.count(),
            "facultades": Facultad.objects.count(),
            "carreras": Carrera.objects.count(),
        }

    def _source_conn_params(self) -> dict:
        host = config("SOURCE_DB_HOST", default="")
        if not host:
            raise CommandError(
                "SOURCE_DB_HOST no configurado. Defina SOURCE_DB_* en .env o use --import-catalog."
            )
        return {
            "host": host,
            "port": config("SOURCE_DB_PORT", default="5432"),
            "dbname": config("SOURCE_DB_NAME", default="control_Peatonal"),
            "user": config("SOURCE_DB_USER", default="postgres"),
            "password": config("SOURCE_DB_PASSWORD", default=""),
        }

    def _import_from_source_db(self) -> dict:
        params = self._source_conn_params()
        self.stdout.write(
            f"Importando desde {params['host']}/{params['dbname']} ..."
        )
        conn = psycopg2.connect(**params)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id_sede, nombre, ciudad, departamento, direccion, telefono,
                           es_integral, activo, creado_en
                    FROM usuarios_sede ORDER BY id_sede
                    """
                )
                sedes = cur.fetchall()

                cur.execute(
                    """
                    SELECT id_facultad, sede_id, nombre, descripcion, activo, creado_en
                    FROM usuarios_facultad ORDER BY id_facultad
                    """
                )
                facultades = cur.fetchall()

                cur.execute(
                    """
                    SELECT id_carrera, facultad_id, nombre, codigo, duracion_anios, activo, creado_en
                    FROM usuarios_carrera ORDER BY id_carrera
                    """
                )
                carreras = cur.fetchall()
        finally:
            conn.close()

        sede_map: dict[int, int] = {}
        for row in sedes:
            old_id, nombre, ciudad, depto, direccion, tel, integral, activo, creado = row
            obj = Sede.objects.create(
                nombre=nombre,
                ciudad=ciudad,
                departamento=depto,
                direccion=direccion,
                telefono=tel,
                es_integral=integral,
                activo=activo,
            )
            if creado:
                Sede.objects.filter(pk=obj.pk).update(creado_en=creado)
            sede_map[old_id] = obj.id_sede

        fac_map: dict[int, int] = {}
        for row in facultades:
            old_id, sede_id, nombre, desc, activo, creado = row
            obj = Facultad.objects.create(
                sede_id=sede_map[sede_id],
                nombre=nombre,
                descripcion=desc,
                activo=activo,
            )
            if creado:
                Facultad.objects.filter(pk=obj.pk).update(creado_en=creado)
            fac_map[old_id] = obj.id_facultad

        for row in carreras:
            old_id, fac_id, nombre, codigo, duracion, activo, creado = row
            obj = Carrera.objects.create(
                facultad_id=fac_map[fac_id],
                nombre=nombre,
                codigo=codigo,
                duracion_anios=duracion,
                activo=activo,
            )
            if creado:
                Carrera.objects.filter(pk=obj.pk).update(creado_en=creado)

        return {
            "sedes": len(sedes),
            "facultades": len(facultades),
            "carreras": len(carreras),
        }

    def _reset_sequences(self) -> None:
        """Alinea secuencias PostgreSQL tras bulk insert/import."""
        if connection.vendor != "postgresql":
            return
        tables = [
            ("usuarios_sede", "id_sede"),
            ("usuarios_facultad", "id_facultad"),
            ("usuarios_carrera", "id_carrera"),
            ("usuarios_usuario", "id_usuario"),
            ("accesos_ingreso", "id_ingreso"),
        ]
        with connection.cursor() as cur:
            for table, col in tables:
                cur.execute(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence(%s, %s),
                        COALESCE((SELECT MAX({col}) FROM {table}), 1)
                    )
                    """,
                    [table, col],
                )
