from django.db import models
from django.db.models import Q

from usuarios.models import Carrera, Facultad, Sede, Usuario


class Ingreso(models.Model):
    """
    Portón o punto de control perimetral de una sede.
    En Santa Cruz: portones hacia la ciudad (no por facultad).
    En Montero/FINOR: portones de la facultad integral.
    La validación de 'adentro/afuera' se basa en la SEDE, no en la facultad.
    """
    id_ingreso = models.AutoField(primary_key=True)
    # Relación principal: a qué sede pertenece este portón
    sede = models.ForeignKey(
        Sede, on_delete=models.PROTECT, null=True, blank=True,
        related_name="ingresos",
    )
    # Relación de referencia (opcional): qué facultad administra este portón
    facultad = models.ForeignKey(
        Facultad, on_delete=models.PROTECT, null=True, blank=True,
    )
    nombre = models.CharField(max_length=150)
    descripcion = models.CharField(max_length=250, null=True, blank=True)
    ubicacion = models.CharField(max_length=250, null=True, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Portón / Punto de acceso"
        verbose_name_plural = "Portones / Puntos de acceso"

    @property
    def sede_efectiva(self):
        """Devuelve la sede directa o la de la facultad como fallback."""
        if self.sede_id:
            return self.sede
        if self.facultad_id:
            return self.facultad.sede
        return None

    def __str__(self) -> str:
        sede = self.sede or (self.facultad.sede if self.facultad else "—")
        return f"{self.nombre} — {sede}"


class Guardia(models.Model):
    TURNO_CHOICES = (
        ("jornada", "Jornada 07:00 - 22:00"),
        ("manana", "Mañana"),
        ("tarde", "Tarde"),
        ("noche", "Noche"),
    )
    TURNO_DEFAULT = "jornada"

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
    paralelo = models.CharField(max_length=10, null=True, blank=True)
    modalidad_ingreso = models.CharField(max_length=50, null=True, blank=True)
    periodo_ingreso = models.CharField(max_length=20, null=True, blank=True)
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
    TIPO_MOVIMIENTO_CHOICES = (
        ("entrada", "Entrada"),
        ("salida", "Salida"),
    )

    id_token = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, null=True, blank=True)
    invitado = models.ForeignKey(Invitado, on_delete=models.CASCADE, null=True, blank=True)
    token_hash = models.CharField(max_length=500, unique=True)
    tipo_persona = models.CharField(max_length=30, choices=TIPO_PERSONA_CHOICES)
    tipo_movimiento = models.CharField(
        max_length=10, choices=TIPO_MOVIMIENTO_CHOICES, default="entrada",
    )
    generado_en = models.DateTimeField(auto_now_add=True)
    expira_en = models.DateTimeField()
    usado = models.BooleanField(default=False)
    usado_en = models.DateTimeField(null=True, blank=True)
    ip_generacion = models.CharField(max_length=45, null=True, blank=True)

    class Meta:
        verbose_name = "QR token"
        verbose_name_plural = "QR tokens"
        indexes = [
            models.Index(fields=["token_hash"]),
            models.Index(fields=["expira_en", "usado"]),
            models.Index(fields=["usuario", "tipo_movimiento", "generado_en"]),
            models.Index(fields=["invitado", "tipo_movimiento"]),
        ]
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
        return f"Token {self.tipo_movimiento} {self.tipo_persona} — expira {self.expira_en}"


class RegistroIngreso(models.Model):
    """
    Registro unificado de accesos: entradas, salidas, manuales y logísticos.
    - metodo='qr'        → acceso por QR generado por el usuario
    - metodo='manual'    → guardia registró por registro universitario
    - metodo='logistico' → entrega / kiosco / proveedor (sin usuario UAGRM)
    La SEDE del registro (sede_acceso) es la sede del portón por donde pasó.
    Con eso determinamos 'adentro / afuera'.
    """
    TIPO_PERSONA_CHOICES = (
        ("estudiante", "Estudiante"),
        ("docente", "Docente"),
        ("administrativo", "Administrativo"),
        ("personal_externo", "Personal Externo"),
        ("invitado", "Invitado"),
        ("logistico", "Logístico / Entrega"),
    )
    TIPO_MOVIMIENTO_CHOICES = (
        ("entrada", "Entrada"),
        ("salida", "Salida"),
    )
    METODO_CHOICES = (
        ("qr",        "Código QR"),
        ("manual",    "Manual (registro universitario)"),
        ("logistico", "Logístico / Entrega rápida"),
        ("rostro",    "Reconocimiento facial"),
    )

    id_registro = models.AutoField(primary_key=True)

    # QR que originó el acceso (null en manual/logístico)
    token = models.ForeignKey(
        QrToken, on_delete=models.PROTECT, null=True, blank=True,
    )
    ingreso = models.ForeignKey(Ingreso, on_delete=models.PROTECT)
    guardia = models.ForeignKey(
        Guardia, on_delete=models.PROTECT, null=True, blank=True,
    )
    registrado_por = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="registros_operados",
    )

    # Sede donde ocurrió el movimiento (determina "adentro/afuera")
    sede_acceso = models.ForeignKey(
        Sede, on_delete=models.PROTECT, null=True, blank=True,
        related_name="registros_acceso",
    )

    # Persona UAGRM (null en logístico)
    usuario = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, null=True, blank=True,
    )
    invitado = models.ForeignKey(
        Invitado, on_delete=models.PROTECT, null=True, blank=True,
    )

    tipo_persona = models.CharField(max_length=30, choices=TIPO_PERSONA_CHOICES)
    tipo_movimiento = models.CharField(
        max_length=10, choices=TIPO_MOVIMIENTO_CHOICES, default="entrada",
    )
    metodo = models.CharField(
        max_length=15, choices=METODO_CHOICES, default="qr",
    )

    # Datos de la persona (desnormalizados para velocidad en reportes)
    nombre_completo = models.CharField(max_length=200)
    sede_pertenece = models.CharField(max_length=150, null=True, blank=True)
    facultad_pertenece = models.CharField(max_length=200, null=True, blank=True)
    carrera_pertenece = models.CharField(max_length=200, null=True, blank=True)

    # Campos exclusivos de acceso logístico (kiosco / entrega / proveedor)
    ci_logistico = models.CharField(max_length=20, null=True, blank=True)
    motivo_logistico = models.CharField(max_length=100, null=True, blank=True)

    acceso_permitido = models.BooleanField(default=True)
    motivo_rechazo = models.CharField(max_length=250, null=True, blank=True)
    fecha_hora = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Registro de acceso"
        verbose_name_plural = "Registros de acceso"
        indexes = [
            models.Index(fields=["fecha_hora"]),
            models.Index(fields=["usuario", "fecha_hora"]),
            models.Index(fields=["ingreso", "fecha_hora"]),
            models.Index(fields=["sede_acceso", "fecha_hora"]),
            # Índice clave: determinar si alguien está adentro/afuera
            models.Index(fields=["usuario", "sede_acceso", "acceso_permitido", "fecha_hora"]),
            models.Index(fields=["invitado", "sede_acceso", "acceso_permitido", "fecha_hora"]),
            models.Index(fields=["tipo_movimiento", "metodo", "fecha_hora"]),
        ]

    def __str__(self) -> str:
        mov = "↑ Entrada" if self.tipo_movimiento == "entrada" else "↓ Salida"
        ok = "✅" if self.acceso_permitido else "❌"
        return f"{ok} {mov} — {self.nombre_completo} — {self.fecha_hora:%Y-%m-%d %H:%M}"
