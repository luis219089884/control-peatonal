from django.contrib import admin

from .models import (
    Guardia,
    Ingreso,
    Invitado,
    PersonaFacultad,
    QrToken,
    RegistroIngreso,
)


@admin.register(Ingreso)
class IngresoAdmin(admin.ModelAdmin):
    list_display = ("id_ingreso", "nombre", "facultad", "ubicacion", "activo")
    search_fields = ("nombre", "ubicacion")
    list_filter = ("activo", "facultad")


@admin.register(Guardia)
class GuardiaAdmin(admin.ModelAdmin):
    list_display = ("id_guardia", "usuario", "ingreso", "turno", "fecha_asignacion")
    search_fields = ("usuario__apellidos", "usuario__ci")
    list_filter = ("turno", "ingreso")


@admin.register(PersonaFacultad)
class PersonaFacultadAdmin(admin.ModelAdmin):
    list_display = ("id_persona_facultad", "usuario", "facultad", "carrera", "tipo_vinculo", "activo")
    search_fields = ("usuario__apellidos", "usuario__ci")
    list_filter = ("tipo_vinculo", "activo", "facultad")


@admin.register(Invitado)
class InvitadoAdmin(admin.ModelAdmin):
    list_display = ("id_invitado", "apellidos", "nombres", "ci", "fecha_visita", "ya_ingreso", "activo")
    search_fields = ("apellidos", "nombres", "ci")
    list_filter = ("activo", "ya_ingreso", "fecha_visita")


@admin.register(QrToken)
class QrTokenAdmin(admin.ModelAdmin):
    list_display = ("id_token", "tipo_persona", "generado_en", "expira_en", "usado")
    search_fields = ("token_hash", "usuario__apellidos", "usuario__ci")
    list_filter = ("tipo_persona", "usado")


@admin.register(RegistroIngreso)
class RegistroIngresoAdmin(admin.ModelAdmin):
    list_display = (
        "id_registro", "nombre_completo", "tipo_persona",
        "ingreso", "guardia", "acceso_permitido", "fecha_hora",
    )
    search_fields = ("nombre_completo", "usuario__ci")
    list_filter = ("tipo_persona", "acceso_permitido", "ingreso")
