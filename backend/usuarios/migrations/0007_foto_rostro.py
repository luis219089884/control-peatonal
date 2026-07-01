from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0006_usuario_bloqueo_login"),
    ]

    operations = [
        migrations.CreateModel(
            name="FotoRostro",
            fields=[
                ("id_foto", models.AutoField(primary_key=True, serialize=False)),
                ("angulo", models.CharField(
                    choices=[
                        ("frente", "Frente"),
                        ("izquierda", "Izquierda"),
                        ("derecha", "Derecha"),
                    ],
                    max_length=20,
                )),
                ("archivo", models.CharField(max_length=500)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                ("usuario", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="fotos_rostro",
                    to="usuarios.usuario",
                )),
            ],
            options={
                "verbose_name": "Foto rostro",
                "verbose_name_plural": "Fotos rostro",
                "unique_together": {("usuario", "angulo")},
            },
        ),
    ]
