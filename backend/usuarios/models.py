from django.db import models


class Sede(models.Model):
    id_sede = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=150)
    ciudad = models.CharField(max_length=100)
    departamento = models.CharField(max_length=100)
    direccion = models.CharField(max_length=250, null=True, blank=True)
    telefono = models.CharField(max_length=20, null=True, blank=True)
    es_integral = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Sede"
        verbose_name_plural = "Sedes"

    def __str__(self) -> str:
        return self.nombre


class Facultad(models.Model):
    id_facultad = models.AutoField(primary_key=True)
    sede = models.ForeignKey(Sede, on_delete=models.PROTECT)
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Facultad"
        verbose_name_plural = "Facultades"

    def __str__(self) -> str:
        return self.nombre


class Carrera(models.Model):
    id_carrera = models.AutoField(primary_key=True)
    facultad = models.ForeignKey(Facultad, on_delete=models.PROTECT)
    nombre = models.CharField(max_length=200)
    codigo = models.CharField(max_length=20, unique=True)
    duracion_anios = models.IntegerField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Carrera"
        verbose_name_plural = "Carreras"

    def __str__(self) -> str:
        return f"{self.nombre} — {self.facultad}"


class Rol(models.Model):
    id_rol = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.CharField(max_length=250, null=True, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Rol"
        verbose_name_plural = "Roles"

    def __str__(self) -> str:
        return self.nombre


class Permiso(models.Model):
    id_permiso = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.CharField(max_length=250, null=True, blank=True)
    modulo = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        verbose_name = "Permiso"
        verbose_name_plural = "Permisos"

    def __str__(self) -> str:
        return self.nombre


class RolPermiso(models.Model):
    rol = models.ForeignKey(Rol, on_delete=models.CASCADE)
    permiso = models.ForeignKey(Permiso, on_delete=models.CASCADE)

    class Meta:
        verbose_name = "Rol permiso"
        verbose_name_plural = "Roles permisos"
        unique_together = ("rol", "permiso")

    def __str__(self) -> str:
        return f"{self.rol} — {self.permiso}"


class Usuario(models.Model):
    TIPO_USUARIO_CHOICES = (
        ("estudiante", "Estudiante"),
        ("docente", "Docente"),
        ("administrativo", "Administrativo"),
        ("guardia", "Guardia"),
        ("personal_externo", "Personal Externo"),
    )
    SEXO_CHOICES = (
        ("masculino", "Masculino"),
        ("femenino", "Femenino"),
        ("otro", "Otro"),
    )

    id_usuario = models.AutoField(primary_key=True)
    rol = models.ForeignKey(Rol, on_delete=models.PROTECT)
    tipo_usuario = models.CharField(max_length=30, choices=TIPO_USUARIO_CHOICES)
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    ci = models.CharField(max_length=20, unique=True)
    sexo = models.CharField(max_length=15, null=True, blank=True, choices=SEXO_CHOICES)
    estado_civil = models.CharField(max_length=20, null=True, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    nacionalidad = models.CharField(max_length=50, null=True, blank=True)
    direccion = models.CharField(max_length=250, null=True, blank=True)
    email = models.EmailField(max_length=150, unique=True)
    celular = models.CharField(max_length=20, null=True, blank=True)
    telefono = models.CharField(max_length=20, null=True, blank=True)
    password_hash = models.CharField(max_length=255)
    foto_url = models.CharField(max_length=500, null=True, blank=True)
    activo = models.BooleanField(default=True)
    totp_secret = models.CharField(max_length=64, null=True, blank=True)
    totp_activo = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        index_together = (("ci",), ("tipo_usuario", "activo"))

    def __str__(self) -> str:
        return f"{self.apellidos} {self.nombres}"


class Estudiante(models.Model):
    id_estudiante = models.AutoField(primary_key=True)
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE)
    nro_registro = models.CharField(max_length=30, unique=True)
    modalidad_ingreso = models.CharField(max_length=100, null=True, blank=True)
    periodo_ingreso = models.CharField(max_length=10, null=True, blank=True)
    tipo_sangre = models.CharField(max_length=10, null=True, blank=True)
    titulo_bachiller = models.CharField(max_length=50, null=True, blank=True)
    pais = models.CharField(max_length=80, null=True, blank=True)
    departamento_origen = models.CharField(max_length=80, null=True, blank=True)
    provincia_origen = models.CharField(max_length=80, null=True, blank=True)

    class Meta:
        verbose_name = "Estudiante"
        verbose_name_plural = "Estudiantes"
        index_together = (("nro_registro",),)

    def __str__(self) -> str:
        return f"{self.usuario} — {self.nro_registro}"


class Docente(models.Model):
    id_docente = models.AutoField(primary_key=True)
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE)
    codigo_docente = models.CharField(max_length=30, unique=True)
    especialidad = models.CharField(max_length=150, null=True, blank=True)
    categoria = models.CharField(max_length=80, null=True, blank=True)
    fecha_ingreso = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Docente"
        verbose_name_plural = "Docentes"

    def __str__(self) -> str:
        return f"{self.usuario} — {self.codigo_docente}"


class Administrativo(models.Model):
    id_administrativo = models.AutoField(primary_key=True)
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE)
    codigo_admin = models.CharField(max_length=30, unique=True)
    cargo = models.CharField(max_length=150, null=True, blank=True)
    area = models.CharField(max_length=150, null=True, blank=True)
    fecha_ingreso = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Administrativo"
        verbose_name_plural = "Administrativos"

    def __str__(self) -> str:
        return f"{self.usuario} — {self.cargo}"


class EmpresaExterna(models.Model):
    TIPO_CHOICES = (
        ("externa", "Empresa externa / contratista"),
        ("seguridad", "Empresa de seguridad"),
    )

    id_empresa = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=200)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="externa")
    nit = models.CharField(max_length=30, unique=True, null=True, blank=True)
    contacto_nombre = models.CharField(max_length=150, null=True, blank=True)
    contacto_telefono = models.CharField(max_length=20, null=True, blank=True)
    contacto_email = models.EmailField(null=True, blank=True)
    contrato_vigente = models.BooleanField(default=True)
    contrato_desde = models.DateField(null=True, blank=True)
    contrato_hasta = models.DateField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Empresa externa"
        verbose_name_plural = "Empresas externas"

    def __str__(self) -> str:
        return self.nombre


class PersonalExterno(models.Model):
    id_personal = models.AutoField(primary_key=True)
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE)
    empresa = models.ForeignKey(EmpresaExterna, on_delete=models.PROTECT)
    cargo = models.CharField(max_length=150, null=True, blank=True)
    horario = models.CharField(max_length=100, null=True, blank=True)
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Personal externo"
        verbose_name_plural = "Personal externo"

    def __str__(self) -> str:
        return f"{self.usuario} — {self.empresa}"
