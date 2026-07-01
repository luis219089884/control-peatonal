"""
Crea datos de prueba locales realistas: empresas, portones, usuarios y credenciales.

Uso:
  python manage.py seed_prueba_local
  python manage.py seed_prueba_local --credenciales "C:\\ruta\\CREDENCIALES.txt"
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accesos.models import Guardia, Ingreso, PersonaFacultad
from usuarios.models import (
    Administrativo,
    Carrera,
    Docente,
    EmpresaExterna,
    Estudiante,
    Facultad,
    PersonalExterno,
    Rol,
    Sede,
    Usuario,
)
from usuarios.utils import hash_password

PASSWORD_DEMO = "Prueba2026!"
PASSWORD_ADMIN = "Admin123!"


def _default_credenciales_path() -> Path:
    """Ruta del .txt: repo local o /tmp en Railway (solo backend en /app)."""
    here = Path(__file__).resolve()
    for depth in (5, 4, 3):
        try:
            return here.parents[depth] / "CREDENCIALES_PRUEBA_LOCAL_UAGRM.txt"
        except IndexError:
            continue
    return Path("/tmp/CREDENCIALES_PRUEBA_LOCAL_UAGRM.txt")


@dataclass
class CuentaDemo:
    tipo: str
    rol: str
    nombres: str
    apellidos: str
    ci: str
    email: str
    password: str
    notas: str
    login_tipo: str  # tipo a elegir en pantalla de login


def _get_sede_montero() -> Sede:
    sede = (
        Sede.objects.filter(nombre__icontains="Montero", activo=True).first()
        or Sede.objects.filter(ciudad__icontains="Montero", activo=True).first()
    )
    if not sede:
        raise CommandError("No hay sede Montero en la base de datos.")
    return sede


def _get_facultad_finor(sede: Sede) -> Facultad:
    fac = (
        Facultad.objects.filter(sede=sede, nombre__icontains="Integral del Norte", activo=True).first()
        or Facultad.objects.filter(sede=sede, activo=True).first()
    )
    if not fac:
        raise CommandError("No hay facultades en Montero.")
    return fac


def _get_carrera_finor(codigo: str, sede: Sede) -> Carrera:
    car = (
        Carrera.objects.filter(codigo=codigo, facultad__sede=sede, activo=True)
        .select_related("facultad__sede")
        .first()
    )
    if not car:
        car = (
            Carrera.objects.filter(facultad__sede=sede, activo=True)
            .select_related("facultad__sede")
            .first()
        )
    if not car:
        raise CommandError(f"No hay carreras en Montero (buscado: {codigo}).")
    return car


def _migrar_vinculos_demo_a_montero(
    sede: Sede,
    fac_finor: Facultad,
    car_sis: Carrera,
    car_segunda: Carrera,
) -> None:
    """Actualiza portones y vínculos académicos de usuarios demo ya creados."""
    from accesos.models import RegistroIngreso

    nombres_portones_viejos = (
        "Portón Principal — Av. Ejército",
        "Portón FICCT — Lateral Norte",
    )
    for ing in Ingreso.objects.filter(nombre__in=nombres_portones_viejos):
        ing.sede = sede
        ing.facultad = fac_finor
        if "Ejército" in ing.nombre:
            ing.nombre = "Portón Principal — Montero (6 de Agosto)"
            ing.descripcion = "Acceso peatonal campus Montero (pruebas locales)"
            ing.ubicacion = "Calle 6 de Agosto s/n, Montero"
        else:
            ing.nombre = "Portón FINOR — Acceso Norte"
            ing.descripcion = "Acceso lateral FINOR Montero (pruebas locales)"
            ing.ubicacion = "Campus UAGRM Montero, bloque FINOR"
        ing.save()

    cis_estudiante = {"7845123": car_sis, "8956234": car_segunda}
    for ci, carrera in cis_estudiante.items():
        u = Usuario.objects.filter(ci=ci, tipo_usuario="estudiante").first()
        if not u:
            continue
        PersonaFacultad.objects.filter(usuario=u).delete()
        PersonaFacultad.objects.get_or_create(
            usuario=u,
            facultad=fac_finor,
            carrera=carrera,
            tipo_vinculo="estudiante",
            defaults={"paralelo": "A", "modalidad_ingreso": "Regular", "periodo_ingreso": "2024-1"},
        )

    u_doc = Usuario.objects.filter(ci="4567890", tipo_usuario="docente").first()
    if u_doc:
        PersonaFacultad.objects.filter(usuario=u_doc).delete()
        PersonaFacultad.objects.get_or_create(
            usuario=u_doc,
            facultad=fac_finor,
            carrera=car_sis,
            tipo_vinculo="docente",
            defaults={},
        )

    for ci, porton_nombre in (
        ("6789012", "Portón Principal — Montero (6 de Agosto)"),
        ("6890123", "Portón FINOR — Acceso Norte"),
    ):
        ing = Ingreso.objects.filter(nombre=porton_nombre).first()
        u = Usuario.objects.filter(ci=ci, tipo_usuario="personal_externo").first()
        if ing and u:
            Guardia.objects.filter(usuario=u).update(ingreso=ing)

    adm = Administrativo.objects.filter(usuario__ci="5678901").first()
    if adm:
        adm.facultad = fac_finor
        adm.area = "Secretaría FINOR Montero"
        adm.save(update_fields=["facultad", "area"])

    RegistroIngreso.objects.filter(ingreso__sede=sede).update(sede_acceso=sede)


def _get_carrera_sistemas() -> Carrera:
    sede = _get_sede_montero()
    return _get_carrera_finor("FINOR-SIS", sede)


def _get_carrera_segunda() -> Carrera:
    sede = _get_sede_montero()
    car = _get_carrera_finor("FINOR-IND", sede)
    if car.codigo == "FINOR-SIS":
        return _get_carrera_finor("FINOR-ENF", sede)
    return car


def _get_sede_central() -> Sede:
    return _get_sede_montero()


def _get_facultad_ficct() -> Facultad:
    return _get_facultad_finor(_get_sede_montero())


class Command(BaseCommand):
    help = "Inserta usuarios, portones y empresas de demostración para pruebas locales."

    def add_arguments(self, parser):
        parser.add_argument(
            "--credenciales",
            default=str(_default_credenciales_path()),
            help="Ruta del archivo .txt con credenciales.",
        )
        parser.add_argument(
            "--sin-registros-demo",
            action="store_true",
            help="No ejecutar seed_accesos_demo al final.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        cred_path = Path(options["credenciales"])
        sede = _get_sede_montero()
        fac_finor = _get_facultad_finor(sede)
        car_sis = _get_carrera_finor("FINOR-SIS", sede)
        car_segunda = _get_carrera_segunda()

        _migrar_vinculos_demo_a_montero(sede, fac_finor, car_sis, car_segunda)

        rol_usuario = Rol.objects.get(nombre="usuario")
        rol_guardia = Rol.objects.get(nombre="guardia")
        rol_admin = Rol.objects.get(nombre="admin")

        emp_seg, _ = EmpresaExterna.objects.get_or_create(
            nombre="Seguridad UAGRM",
            defaults={
                "tipo": "seguridad",
                "nit": "1020304050",
                "contacto_nombre": "Coordinación Seguridad",
                "contacto_email": "seguridad@uagrm.edu.bo",
                "contrato_vigente": True,
                "contrato_desde": date(2025, 1, 1),
                "contrato_hasta": date(2027, 12, 31),
                "activo": True,
            },
        )
        emp_ext, _ = EmpresaExterna.objects.get_or_create(
            nombre="Servicios Andinos S.R.L.",
            defaults={
                "tipo": "externa",
                "nit": "1987654321",
                "contacto_nombre": "Recursos Humanos",
                "contacto_email": "rrhh@serviciosandinos.bo",
                "contrato_vigente": True,
                "contrato_desde": date(2025, 6, 1),
                "contrato_hasta": date(2026, 12, 31),
                "activo": True,
            },
        )

        porton_principal, _ = Ingreso.objects.get_or_create(
            nombre="Portón Principal — Montero (6 de Agosto)",
            defaults={
                "sede": sede,
                "facultad": fac_finor,
                "descripcion": "Acceso peatonal campus Montero (pruebas locales)",
                "ubicacion": "Calle 6 de Agosto s/n, Montero",
                "activo": True,
            },
        )
        if porton_principal.sede_id != sede.id_sede:
            porton_principal.sede = sede
            porton_principal.facultad = fac_finor
            porton_principal.save(update_fields=["sede", "facultad"])

        porton_finor, _ = Ingreso.objects.get_or_create(
            nombre="Portón FINOR — Acceso Norte",
            defaults={
                "sede": sede,
                "facultad": fac_finor,
                "descripcion": "Acceso lateral FINOR Montero (pruebas locales)",
                "ubicacion": "Campus UAGRM Montero, bloque FINOR",
                "activo": True,
            },
        )
        if porton_finor.sede_id != sede.id_sede:
            porton_finor.sede = sede
            porton_finor.facultad = fac_finor
            porton_finor.save(update_fields=["sede", "facultad"])

        cuentas: list[CuentaDemo] = []

        # ── Admin existente ──
        admin = Usuario.objects.filter(rol=rol_admin).first()
        if admin:
            cuentas.append(
                CuentaDemo(
                    tipo="Administrador del sistema",
                    rol="admin",
                    nombres=admin.nombres,
                    apellidos=admin.apellidos,
                    ci=admin.ci,
                    email=admin.email or "admin@uagrm.edu.bo",
                    password=PASSWORD_ADMIN,
                    notas="Panel /admin — gestión completa",
                    login_tipo="Administrativo",
                )
            )

        def crear_si_no_existe(
            *,
            tipo_usuario: str,
            rol_obj: Rol,
            ci: str,
            nombres: str,
            apellidos: str,
            email: str,
            notas: str,
            login_tipo: str,
            setup,
        ) -> Usuario:
            existente = Usuario.objects.filter(ci=ci, tipo_usuario=tipo_usuario).first()
            if existente:
                self.stdout.write(f"  Ya existe: {tipo_usuario} CI {ci}")
                usuario = existente
            else:
                usuario = Usuario.objects.create(
                    rol=rol_obj,
                    tipo_usuario=tipo_usuario,
                    nombres=nombres,
                    apellidos=apellidos,
                    ci=ci,
                    email=email,
                    celular="70000000",
                    password_hash=hash_password(PASSWORD_DEMO),
                    activo=True,
                )
                setup(usuario)
                self.stdout.write(self.style.SUCCESS(f"  Creado: {apellidos} {nombres} ({tipo_usuario})"))
            cuentas.append(
                CuentaDemo(
                    tipo=tipo_usuario.replace("_", " ").title(),
                    rol=rol_obj.nombre,
                    nombres=nombres,
                    apellidos=apellidos,
                    ci=ci,
                    email=email,
                    password=PASSWORD_DEMO,
                    notas=notas,
                    login_tipo=login_tipo,
                )
            )
            return usuario

        # ── Estudiantes ──
        def setup_estudiante_maria(u: Usuario) -> None:
            Estudiante.objects.create(
                usuario=u,
                nro_registro="2024-001234",
                modalidad_ingreso="Regular",
                periodo_ingreso="2024-1",
            )
            PersonaFacultad.objects.get_or_create(
                usuario=u,
                facultad=fac_finor,
                carrera=car_sis,
                tipo_vinculo="estudiante",
                defaults={"paralelo": "A", "modalidad_ingreso": "Regular", "periodo_ingreso": "2024-1"},
            )

        crear_si_no_existe(
            tipo_usuario="estudiante",
            rol_obj=rol_usuario,
            ci="7845123",
            nombres="María Elena",
            apellidos="Fernández López",
            email="maria.fernandez@uagrm.edu.bo",
            notas=f"FINOR Montero — {car_sis.nombre} | QR, rostro, perfil, ingresos",
            login_tipo="Estudiante",
            setup=setup_estudiante_maria,
        )

        def setup_estudiante_carlos(u: Usuario) -> None:
            Estudiante.objects.create(
                usuario=u,
                nro_registro="2023-009876",
                modalidad_ingreso="Regular",
                periodo_ingreso="2023-2",
            )
            PersonaFacultad.objects.get_or_create(
                usuario=u,
                facultad=fac_finor,
                carrera=car_segunda,
                tipo_vinculo="estudiante",
                defaults={"paralelo": "B", "modalidad_ingreso": "Regular", "periodo_ingreso": "2023-2"},
            )

        crear_si_no_existe(
            tipo_usuario="estudiante",
            rol_obj=rol_usuario,
            ci="8956234",
            nombres="Carlos Alberto",
            apellidos="Mendoza Ríos",
            email="carlos.mendoza@uagrm.edu.bo",
            notas=f"FINOR Montero — {car_segunda.nombre} | Segundo estudiante de prueba",
            login_tipo="Estudiante",
            setup=setup_estudiante_carlos,
        )

        # ── Docente ──
        def setup_docente(u: Usuario) -> None:
            Docente.objects.create(
                usuario=u,
                codigo_docente="DOC-2024-015",
                especialidad="Bases de Datos",
                categoria="Titular",
            )
            PersonaFacultad.objects.get_or_create(
                usuario=u,
                facultad=fac_finor,
                carrera=car_sis,
                tipo_vinculo="docente",
                defaults={},
            )

        crear_si_no_existe(
            tipo_usuario="docente",
            rol_obj=rol_usuario,
            ci="4567890",
            nombres="Ana Lucía",
            apellidos="Gutiérrez Vega",
            email="ana.gutierrez@uagrm.edu.bo",
            notas="Docente FINOR Montero | Puede registrar invitados",
            login_tipo="Docente",
            setup=setup_docente,
        )

        # ── Administrativo de campus ──
        def setup_admin_campus(u: Usuario) -> None:
            Administrativo.objects.create(
                usuario=u,
                codigo_admin="ADM-CAMP-042",
                nivel_jerarquico="jefatura",
                facultad=fac_finor,
                cargo="Jefe de Unidad Académica",
                area="Secretaría FINOR Montero",
            )

        crear_si_no_existe(
            tipo_usuario="administrativo",
            rol_obj=rol_usuario,
            ci="5678901",
            nombres="Pedro José",
            apellidos="Roca Salazar",
            email="pedro.roca@uagrm.edu.bo",
            notas="Administrativo campus (NO es admin sistema) | Puede registrar invitados",
            login_tipo="Administrativo",
            setup=setup_admin_campus,
        )

        # ── Guardias ──
        def setup_guardia_jorge(u: Usuario) -> None:
            PersonalExterno.objects.create(
                usuario=u,
                empresa=emp_seg,
                cargo="Guardia de seguridad",
                horario="07:00-22:00",
            )
            Guardia.objects.get_or_create(
                usuario=u,
                defaults={"ingreso": porton_principal, "turno": Guardia.TURNO_DEFAULT},
            )

        crear_si_no_existe(
            tipo_usuario="personal_externo",
            rol_obj=rol_guardia,
            ci="6789012",
            nombres="Jorge Luis",
            apellidos="Vargas Mamani",
            email="jorge.vargas@seguridad.uagrm.edu.bo",
            notas=f"Guardia — {porton_principal.nombre} | Panel /panel-guardia",
            login_tipo="Personal Externo",
            setup=setup_guardia_jorge,
        )

        def setup_guardia_sandra(u: Usuario) -> None:
            PersonalExterno.objects.create(
                usuario=u,
                empresa=emp_seg,
                cargo="Guardia de seguridad",
                horario="07:00-22:00",
            )
            Guardia.objects.get_or_create(
                usuario=u,
                defaults={"ingreso": porton_finor, "turno": Guardia.TURNO_DEFAULT},
            )

        crear_si_no_existe(
            tipo_usuario="personal_externo",
            rol_obj=rol_guardia,
            ci="6890123",
            nombres="Sandra Milena",
            apellidos="Morales Cruz",
            email="sandra.morales@seguridad.uagrm.edu.bo",
            notas=f"Guardia — {porton_finor.nombre} | Modo QR y Rostro",
            login_tipo="Personal Externo",
            setup=setup_guardia_sandra,
        )

        # ── Personal externo (no guardia) ──
        def setup_externo(u: Usuario) -> None:
            PersonalExterno.objects.create(
                usuario=u,
                empresa=emp_ext,
                cargo="Técnico de mantenimiento",
                horario="08:00-17:00",
            )

        crear_si_no_existe(
            tipo_usuario="personal_externo",
            rol_obj=rol_usuario,
            ci="7901234",
            nombres="Roberto",
            apellidos="Paz Quiroga",
            email="roberto.paz@serviciosandinos.bo",
            notas=f"Contratista — {emp_ext.nombre} | Acceso QR",
            login_tipo="Personal Externo",
            setup=setup_externo,
        )

        contenido = self._generar_txt(
            cuentas=cuentas,
            portones=[porton_principal, porton_finor],
            empresas=[emp_seg, emp_ext],
            sede=sede,
            fac_finor=fac_finor,
        )
        cred_path.parent.mkdir(parents=True, exist_ok=True)
        cred_path.write_text(contenido, encoding="utf-8")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Archivo de credenciales: {cred_path}"))
        self.stdout.write(self.style.SUCCESS(
            f"Resumen: {Usuario.objects.count()} usuarios, "
            f"{Ingreso.objects.count()} portones, {Guardia.objects.count()} guardias"
        ))

        if not options["sin_registros_demo"]:
            from django.core.management import call_command
            try:
                call_command("seed_accesos_demo", fecha_inicio="2026-06-01", fecha_fin="2026-06-30")
                self.stdout.write(self.style.SUCCESS("Registros de acceso demo insertados (junio 2026)."))
            except CommandError as e:
                self.stdout.write(self.style.WARNING(f"No se insertaron registros demo: {e}"))

    def _generar_txt(self, cuentas, portones, empresas, sede, fac_finor) -> str:
        linea = "=" * 72
        sub = "-" * 72
        bloques = [
            linea,
            "  UAGRM — CONTROL PEATONAL",
            "  CREDENCIALES DE PRUEBA (ENTORNO LOCAL)",
            linea,
            "",
            "  Generado para pruebas en tu computadora (localhost).",
            "  NO usar estas contraseñas en producción.",
            "",
            sub,
            "  ACCESO A LA APLICACIÓN",
            sub,
            "  Frontend : http://localhost:5173",
            "  Backend  : http://localhost:8000/graphql/",
            "",
            sub,
            "  CONTRASEÑA COMÚN (usuarios demo)",
            sub,
            f"  {PASSWORD_DEMO}",
            "",
            "  (Cumple política: 8+ caracteres, mayúscula, minúscula, número y símbolo)",
            "",
            sub,
            "  INFRAESTRUCTURA CREADA (SEDE MONTERO)",
            sub,
            f"  Sede principal : {sede.nombre}",
            f"  Facultad       : {fac_finor.nombre}",
        ]
        for p in portones:
            bloques.append(f"  Portón           : {p.nombre} (id={p.id_ingreso})")
        for e in empresas:
            bloques.append(f"  Empresa          : {e.nombre}")
        bloques.extend([
            "",
            sub,
            "  CÓMO INICIAR SESIÓN",
            sub,
            "  1. Abra http://localhost:5173/login",
            "  2. Elija el TIPO DE CUENTA indicado en cada usuario",
            "  3. Ingrese CI y contraseña",
            "",
            "  Nota: El administrador del sistema también elige «Administrativo»",
            "        en la pantalla de login (su rol interno es admin).",
            "",
            linea,
            "  USUARIOS Y CREDENCIALES",
            linea,
            "",
        ])

        for i, c in enumerate(cuentas, 1):
            bloques.extend([
                f"  [{i}] {c.apellidos} {c.nombres}",
                f"      Tipo en login  : {c.login_tipo}",
                f"      Rol en sistema : {c.rol}",
                f"      CI             : {c.ci}",
                f"      Contraseña     : {c.password}",
                f"      Email          : {c.email}",
                f"      Uso sugerido   : {c.notas}",
                "",
            ])

        bloques.extend([
            linea,
            "  QUÉ PROBAR CON CADA CUENTA",
            linea,
            "",
            "  Admin (00000001)     → Dashboard, usuarios, portones, informes",
            "  Estudiantes          → QR, foto perfil, rostro, Mi Facultad, ingresos",
            "  Docente              → QR, registrar invitado, perfil completo",
            "  Administrativo campus→ QR, registrar invitado (nivel jefatura)",
            "  Guardias             → Panel guardia: escanear QR / modo Rostro",
            "  Personal externo     → QR y acceso peatonal como contratista",
            "",
            "  Recuperar contraseña → Use el email institucional de cualquier usuario",
            "                         (requiere BREVO_API_KEY en backend/.env)",
            "",
            linea,
            "  FIN DEL DOCUMENTO",
            linea,
            "",
        ])
        return "\n".join(bloques)
