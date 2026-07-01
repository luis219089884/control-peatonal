from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0008_usuario_rostro_descriptor"),
    ]

    operations = [
        migrations.CreateModel(
            name="TokenRecuperacionPassword",
            fields=[
                ("id_token", models.AutoField(primary_key=True, serialize=False)),
                ("token_hash", models.CharField(db_index=True, max_length=64)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("expira_en", models.DateTimeField()),
                ("usado", models.BooleanField(default=False)),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tokens_recuperacion",
                        to="usuarios.usuario",
                    ),
                ),
            ],
            options={
                "verbose_name": "Token recuperación contraseña",
                "verbose_name_plural": "Tokens recuperación contraseña",
                "indexes": [
                    models.Index(
                        fields=["usuario", "creado_en"],
                        name="usuarios_to_usuario_6a8f2d_idx",
                    ),
                    models.Index(
                        fields=["token_hash"],
                        name="usuarios_to_token_h_0c4e1a_idx",
                    ),
                ],
            },
        ),
    ]
