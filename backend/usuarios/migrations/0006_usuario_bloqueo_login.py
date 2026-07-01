from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0005_sincronizacion_dtic"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="intentos_fallidos_login",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="usuario",
            name="bloqueado_hasta",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
