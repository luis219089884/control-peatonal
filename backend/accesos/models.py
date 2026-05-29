from django.db import models
from django.db.models import Q

from usuarios.models import Carrera, Facultad, Usuario


class Ingreso(models.Model):
    id_ingreso = models.AutoField(primary_key=True)
    facultad = models.ForeignKey(Facultad, on_delete=models.PROTECT)
    nombre = models.CharField(max_length=150)
    descripcion = models.CharField(max_length=250, null=True, blank=True)
    ubicacion = models.CharField(max_length=250, null=True, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ingreso"
        verbose_name_plural = "Ingresos"

    def __str__(self) -> str:
        return f"{self.nombre} — {self.facultad}"


class Guardia(models.Model):
    TURNO_CHOICES = (
        ("manana", "Mañana"),
        ("tarde", "Tarde"),
        ("noche", "Noche"),
    )

    id_guardia = models.AutoField(primary_key=True)
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE)
    ingreso = models.ForeignKey(Ingreso, on_delete=models.PROTECT)
    turno = models.CharField(max_length=20, choices=TURNO_CHOICES)
    fecha_asignacion = models.DateField(auto_now_add=True)

    class Meta:
        verbose_name = "Guardia"
        verbose_name_plural = "Guardias"

    def __str__(self) -> str:
        return f"{self.usuario} — {self.ingreso} ({self.turno})"


class PersonaFacultad(models.Model):
    TIPO_VINCULO_CHOICES = (
        ("estudiante", "Estudiante"),
        ("docente", "Docente"),
        ("administrativo", "Administrativo"),
        ("personal_externo", "Personal Externo"),
    )

    id_persona_facultad = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    facultad = models.ForeignKey(Facultad, on_delete=models.PROTECT)
    carrera = models.ForeignKey(Carrera, on_delete=models.PROTECT, null=True, blank=True)
    tipo_vinculo = models.CharField(max_length=30, choices=TIPO_VINCULO_CHOICES)
    activo = models.BooleanField(default=True)
    desde = models.DateField(auto_now_add=True)
    hasta = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Persona facultad"
        verbose_name_plural = "Personas facultad"
        unique_together = ("usuario", "facultad", "carrera", "tipo_vinculo")

    def __str__(self) -> str:
        return f"{self.usuario} — {self.facultad}"


class Invitado(models.Model):
    id_invitado = models.AutoField(primary_key=True)
    registrado_por = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name="invitados_registrados",
    )
    facultad_destino = models.ForeignKey(Facultad, on_delete=models.PROTECT)
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    ci = models.CharField(max_length=20)
    celular = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    motivo_visita = models.CharField(max_length=300)
    fecha_visita = models.DateField()
    expira_en = models.DateTimeField()
    ya_ingreso = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Invitado"
        verbose_name_plural = "Invitados"
        index_together = (("fecha_visita", "activo"),)

    def __str__(self) -> str:
        return f"{self.apellidos} {self.nombres} — {self.fecha_visita}"


class QrToken(models.Model):
    TIPO_PERSONA_CHOICES = (
        ("estudiante", "Estudiante"),
        ("docente", "Docente"),
        ("administrativo", "Administrativo"),
        ("personal_externo", "Personal Externo"),
        ("invitado", "Invitado"),
    )

    id_token = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, null=True, blank=True)
    invitado = models.ForeignKey(Invitado, on_delete=models.CASCADE, null=True, blank=True)
    token_hash = models.CharField(max_length=500, unique=True)
    tipo_persona = models.CharField(max_length=30, choices=TIPO_PERSONA_CHOICES)
    generado_en = models.DateTimeField(auto_now_add=True)
    expira_en = models.DateTimeField()
    usado = models.BooleanField(default=False)
    usado_en = models.DateTimeField(null=True, blank=True)
    ip_generacion = models.CharField(max_length=45, null=True, blank=True)

    class Meta:
        verbose_name = "QR token"
        verbose_name_plural = "QR tokens"
        index_together = (("token_hash",), ("expira_en", "usado"))
        constraints = [
            models.CheckConstraint(
                check=(
                    (Q(usuario__isnull=False) & Q(invitado__isnull=True))
                    | (Q(usuario__isnull=True) & Q(invitado__isnull=False))
                ),
                name="chk_qr_token_usuario_xor_invitado",
            )
        ]

    def __str__(self) -> str:
        return f"Token {self.tipo_persona} — expira {self.expira_en}"


class RegistroIngreso(models.Model):
    TIPO_PERSONA_CHOICES = (
        ("estudiante", "Estudiante"),
        ("docente", "Docente"),
        ("administrativo", "Administrativo"),
        ("personal_externo", "Personal Externo"),
        ("invitado", "Invitado"),
    )

    id_registro = models.AutoField(primary_key=True)
    token = models.ForeignKey(QrToken, on_delete=models.PROTECT)
    ingreso = models.ForeignKey(Ingreso, on_delete=models.PROTECT)
    guardia = models.ForeignKey(Guardia, on_delete=models.PROTECT)
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT, null=True, blank=True)
    invitado = models.ForeignKey(Invitado, on_delete=models.PROTECT, null=True, blank=True)
    tipo_persona = models.CharField(max_length=30, choices=TIPO_PERSONA_CHOICES)
    nombre_completo = models.CharField(max_length=200)
    sede_pertenece = models.CharField(max_length=150, null=True, blank=True)
    facultad_pertenece = models.CharField(max_length=200, null=True, blank=True)
    carrera_pertenece = models.CharField(max_length=200, null=True, blank=True)
    acceso_permitido = models.BooleanField(default=True)
    motivo_rechazo = models.CharField(max_length=250, null=True, blank=True)
    fecha_hora = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Registro ingreso"
        verbose_name_plural = "Registros ingreso"
        index_together = (
            ("fecha_hora",),
            ("usuario", "fecha_hora"),
            ("ingreso", "fecha_hora"),
        )

    def __str__(self) -> str:
        return f"{self.nombre_completo} — {self.fecha_hora} — {'✅' if self.acceso_permitido else '❌'}"
