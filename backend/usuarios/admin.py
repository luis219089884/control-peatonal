from django.contrib import admin

from .models import (
    Administrativo,
    Carrera,
    Docente,
    EmpresaExterna,
    Estudiante,
    Facultad,
    Permiso,
    PersonalExterno,
    Rol,
    RolPermiso,
    Sede,
    Usuario,
)


@admin.register(Sede)
class SedeAdmin(admin.ModelAdmin):
    list_display = ("id_sede", "nombre", "ciudad", "departamento", "activo")
    search_fields = ("nombre", "ciudad")
    list_filter = ("activo", "es_integral")


@admin.register(Facultad)
class FacultadAdmin(admin.ModelAdmin):
    list_display = ("id_facultad", "nombre", "sede", "activo")
    search_fields = ("nombre",)
    list_filter = ("activo", "sede")


@admin.register(Carrera)
class CarreraAdmin(admin.ModelAdmin):
    list_display = ("id_carrera", "nombre", "codigo", "facultad", "activo")
    search_fields = ("nombre", "codigo")
    list_filter = ("activo", "facultad")


@admin.register(Rol)
class RolAdmin(admin.ModelAdmin):
    list_display = ("id_rol", "nombre", "activo")
    search_fields = ("nombre",)
    list_filter = ("activo",)


@admin.register(Permiso)
class PermisoAdmin(admin.ModelAdmin):
    list_display = ("id_permiso", "nombre", "modulo")
    search_fields = ("nombre", "modulo")


@admin.register(RolPermiso)
class RolPermisoAdmin(admin.ModelAdmin):
    list_display = ("rol", "permiso")
    list_filter = ("rol",)


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("id_usuario", "apellidos", "nombres", "ci", "tipo_usuario", "email", "activo")
    search_fields = ("apellidos", "nombres", "ci", "email")
    list_filter = ("tipo_usuario", "activo", "rol")


@admin.register(Estudiante)
class EstudianteAdmin(admin.ModelAdmin):
    list_display = ("id_estudiante", "usuario", "nro_registro", "periodo_ingreso")
    search_fields = ("nro_registro", "usuario__apellidos", "usuario__ci")


@admin.register(Docente)
class DocenteAdmin(admin.ModelAdmin):
    list_display = ("id_docente", "usuario", "codigo_docente", "especialidad", "categoria")
    search_fields = ("codigo_docente", "usuario__apellidos", "usuario__ci")


@admin.register(Administrativo)
class AdministrativoAdmin(admin.ModelAdmin):
    list_display = ("id_administrativo", "usuario", "codigo_admin", "cargo", "area")
    search_fields = ("codigo_admin", "usuario__apellidos", "usuario__ci")


@admin.register(EmpresaExterna)
class EmpresaExternaAdmin(admin.ModelAdmin):
    list_display = ("id_empresa", "nombre", "nit", "contrato_vigente", "activo")
    search_fields = ("nombre", "nit")
    list_filter = ("contrato_vigente", "activo")


@admin.register(PersonalExterno)
class PersonalExternoAdmin(admin.ModelAdmin):
    list_display = ("id_personal", "usuario", "empresa", "cargo", "fecha_inicio", "fecha_fin")
    search_fields = ("usuario__apellidos", "usuario__ci", "empresa__nombre")
    list_filter = ("empresa",)
