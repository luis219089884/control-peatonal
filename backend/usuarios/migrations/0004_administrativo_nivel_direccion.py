from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0003_empresaexterna_tipo"),
    ]

    operations = [
        migrations.AddField(
            model_name="administrativo",
            name="nivel_jerarquico",
            field=models.CharField(
                choices=[
                    ("autoridad_ejecutiva", "Autoridad Ejecutiva (Rector, Vicerrector, Decano, Vicedecano)"),
                    ("direccion", "Dirección / Secretaría General"),
                    ("jefatura", "Jefatura / Encargado de Unidad"),
                    ("profesional_tecnico", "Profesional Técnico (Analista, Auditor, Contador...)"),
                    ("apoyo_secretarial", "Apoyo Secretarial y Administrativo"),
                    ("operativo", "Operativo / Servicios Generales"),
                ],
                default="apoyo_secretarial",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="administrativo",
            name="facultad",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="usuarios.facultad",
            ),
        ),
        migrations.AddField(
            model_name="administrativo",
            name="codigo_direccion",
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
    ]
